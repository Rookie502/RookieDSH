import type {
  DshCapabilitySet,
  DshCredentialStatus,
  DshProvider,
  DshProviderModelGroup,
  DshProviderSnapshot,
  RuntimeBindingInput,
  RuntimeModelBinding,
} from '@shared/runtimeBindingTypes';
import type { ModelEndpoint } from '@shared/modelTypes';
import { getConfig } from '../../config/configManager';
import { addModelEndpoint, listModelEndpoints } from '../../models/ModelRegistry';
import { checkDeepSeekHarnessVersion } from '../RuntimeRegistry';
import { DshApiClient } from './DshApiClient';
import { DshCapabilityProbe, getPath, isRecord, type DshCapabilitySnapshot } from './DshCapabilityProbe';
import { listRuntimeModelBindings, removeRuntimeModelBinding, saveRuntimeModelBinding } from './RuntimeModelBindingRegistry';

const RUNTIME_ID = 'deepseek-harness';
const PI_AI_SETTINGS_NAMESPACE = 'llm-pi-ai';
const OPENAI_COMPLETIONS_API = 'openai-completions';

export class DshProviderBridge {
  private probe: DshCapabilityProbe | null = null;
  private probeBaseUrl: string | null = null;

  async getCapabilities(): Promise<DshCapabilitySet> {
    return (await this.getProbe()).capabilities;
  }

  async listProviders(): Promise<DshProvider[]> {
    const snapshot = await this.getProbe();
    return snapshot.providers.map((entry) => projectProvider(entry, snapshot.settings, snapshot.credentials));
  }

  async getSnapshot(force = false): Promise<DshProviderSnapshot> {
    const snapshot = await this.getProbe(force);
    const modelGroups = await this.readModelGroups();
    return {
      providers: snapshot.providers.map((entry) => projectProvider(entry, snapshot.settings, snapshot.credentials)),
      modelGroups,
      bindings: listRuntimeModelBindings(),
      capabilities: snapshot.capabilities,
      checkedAt: snapshot.checkedAt,
      error: snapshot.error,
    };
  }

  async refresh(): Promise<DshProviderSnapshot> {
    return this.getSnapshot(true);
  }

  async getProviderModels(provider?: string): Promise<DshProviderModelGroup[]> {
    const groups = await this.readModelGroups();
    return provider ? groups.filter((group) => group.provider === provider) : groups;
  }

  async discoverRuntimeModels(input: {
    settingsNs: string;
    provider?: string;
    baseURL?: string;
    api?: string;
  }): Promise<Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }>> {
    const payload: Record<string, unknown> = { settingsNs: input.settingsNs };
    if (input.provider) payload.provider = input.provider;
    if (input.baseURL) payload.baseURL = input.baseURL;
    if (input.api) payload.api = input.api;
    const result = await this.client().call<{ models: Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }> }>('llm.discoverModels', payload);
    return result.models;
  }

  async getCredentialStatus(refs: string[]): Promise<Record<string, DshCredentialStatus>> {
    if (refs.length === 0) return {};
    const result = await this.client().call<{ credentials: Record<string, DshCredentialStatus> }>('credentials.describe', { refs: refs.slice(0, 64) });
    return result.credentials;
  }

  /** Apply an endpoint only after an explicit user action. */
  async applyEndpointBinding(input: RuntimeBindingInput): Promise<RuntimeModelBinding> {
    const endpoint = listModelEndpoints().find((candidate) => candidate.id === input.endpointId);
    if (!endpoint) throw new Error(`Model endpoint not found: ${input.endpointId}`);
    if (endpoint.models.length === 0) throw new Error('Discover endpoint models before binding it to DeepSeek Harness.');

    const snapshot = await this.getProbe();
    const providers = snapshot.providers.map((entry) => projectProvider(entry, snapshot.settings, snapshot.credentials));
    const existing = providers.find((provider) => provider.baseUrl && sameUrl(provider.baseUrl, endpoint.baseUrl));
    const modelId = input.modelId ?? existing?.models[0] ?? endpoint.models[0];
    const nativeProviderId = existing?.provider ?? chooseRoute(input.nativeProviderId ?? endpoint.name, providers.map((provider) => provider.provider));

    if (existing) {
      if (!existing.models.includes(modelId)) {
        return saveRuntimeModelBinding({
          runtimeId: RUNTIME_ID,
          endpointId: endpoint.id,
          nativeProviderId: existing.provider,
          modelId,
          status: 'DRIFT',
          lastError: `DSH provider ${existing.provider} does not advertise model ${modelId}.`,
        });
      }
      return saveRuntimeModelBinding({
        runtimeId: RUNTIME_ID,
        endpointId: endpoint.id,
        nativeProviderId: existing.provider,
        modelId,
        status: 'SYNCED',
      });
    }

    if (!snapshot.settings?.writable) {
      throw new Error('DeepSeek Harness settings are read-only; provider binding is unavailable.');
    }
    const namespace = snapshot.settings.namespaces.find((candidate) => candidate.ns === PI_AI_SETTINGS_NAMESPACE);
    if (!namespace) throw new Error('DeepSeek Harness does not expose the llm-pi-ai provider settings namespace.');

    const profile = {
      displayName: endpoint.name,
      api: OPENAI_COMPLETIONS_API,
      baseURL: endpoint.baseUrl,
      models: endpoint.models.map((id) => ({ id, name: id })),
    };
    await this.client().call('settings.mutate', {
      ns: PI_AI_SETTINGS_NAMESPACE,
      ops: [{ op: 'set', path: ['providers', nativeProviderId], value: profile }],
      expectedRevision: namespace.revision,
    });
    this.invalidate();
    return saveRuntimeModelBinding({
      runtimeId: RUNTIME_ID,
      endpointId: endpoint.id,
      nativeProviderId,
      modelId,
      status: 'SYNCED',
    });
  }

  /** Import only non-secret, endpoint-shaped metadata from a native DSH provider. */
  async importProvider(providerId: string): Promise<ModelEndpoint> {
    const provider = (await this.listProviders()).find((candidate) => candidate.provider === providerId);
    if (!provider) throw new Error(`DeepSeek Harness provider not found: ${providerId}`);
    if (!provider.baseUrl) throw new Error('This DSH provider does not expose an importable HTTP endpoint.');
    const existing = listModelEndpoints().find((endpoint) => sameUrl(endpoint.baseUrl, provider.baseUrl ?? ''));
    if (existing) return existing;
    return addModelEndpoint({
      name: provider.displayName || provider.provider,
      type: endpointType(provider.baseUrl),
      protocol: 'openai-compatible',
      baseUrl: provider.baseUrl,
    });
  }

  /** Credentials cross this method only for one request and are never persisted by RookieDSH. */
  async setCredential(ref: string, value: string): Promise<DshCredentialStatus> {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) throw new Error('Invalid DSH credential reference.');
    if (!value) throw new Error('Credential value is required.');
    await this.client().call('credentials.set', { ref, value });
    const status = await this.getCredentialStatus([ref]);
    return status[ref] ?? { configured: true, source: null, writable: true };
  }

  /** Unbinds only RookieDSH metadata; it never deletes an existing native DSH provider. */
  removeBinding(bindingId: string): boolean {
    return removeRuntimeModelBinding(bindingId);
  }

  invalidate(): void {
    this.probe?.invalidate();
  }

  private client(): DshApiClient {
    return new DshApiClient(getConfig().harness.url);
  }

  private async getProbe(force = false): Promise<DshCapabilitySnapshot> {
    const baseUrl = getConfig().harness.url;
    if (!this.probe || this.probeBaseUrl !== baseUrl) {
      this.probeBaseUrl = baseUrl;
      this.probe = new DshCapabilityProbe(
        this.client(),
        async () => (await checkDeepSeekHarnessVersion()).installedVersion,
      );
    }
    return this.probe.probe(force);
  }

  private async readModelGroups(): Promise<DshProviderModelGroup[]> {
    const result = await this.client().call<{ groups: unknown[]; failures: unknown[] }>('llm.models', {});
    return result.groups.flatMap((group) => {
      if (!isRecord(group) || typeof group.id !== 'string') return [];
      const models = Array.isArray(group.models)
        ? group.models.flatMap((model) => isRecord(model) && typeof model.id === 'string' ? [model.id] : [])
        : [];
      return [{
        provider: group.id,
        name: typeof group.name === 'string' ? group.name : group.id,
        models,
      }];
    });
  }
}

function projectProvider(
  entry: {
    provider: string;
    displayName: string;
    settingsNs: string;
    settingsPath: string[];
    active: boolean;
    declared?: boolean;
  },
  settings: DshCapabilitySnapshot['settings'],
  credentials: Record<string, DshCredentialStatus>,
): DshProvider {
  const namespace = settings?.namespaces.find((candidate) => candidate.ns === entry.settingsNs);
  const profile = getPath(namespace?.value, entry.settingsPath);
  const profileRecord = isRecord(profile) ? profile : {};
  const models = Array.isArray(profileRecord.models)
    ? profileRecord.models.flatMap((model) => isRecord(model) && typeof model.id === 'string' ? [model.id] : [])
    : [];
  const credentialRef = typeof profileRecord.apiKeyEnv === 'string' ? profileRecord.apiKeyEnv : null;
  return {
    provider: entry.provider,
    displayName: entry.displayName,
    settingsNs: entry.settingsNs,
    settingsPath: [...entry.settingsPath],
    active: entry.active,
    declared: entry.declared ?? null,
    baseUrl: typeof profileRecord.baseURL === 'string' ? profileRecord.baseURL : null,
    api: typeof profileRecord.api === 'string' ? profileRecord.api : null,
    models,
    credentialRef,
    credential: credentialRef ? credentials[credentialRef] ?? null : null,
  };
}

function chooseRoute(requested: string, existing: string[]): string {
  const base = slug(requested);
  if (!existing.includes(base)) return base;
  let index = 2;
  while (existing.includes(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const result = normalized || 'rookie-endpoint';
  return /^[a-z]/.test(result) ? result : `rookie-${result}`;
}

function sameUrl(left: string, right: string): boolean {
  try {
    return new URL(left).toString().replace(/\/$/, '') === new URL(right).toString().replace(/\/$/, '');
  } catch {
    return left.replace(/\/$/, '') === right.replace(/\/$/, '');
  }
}

function endpointType(baseUrl: string): ModelEndpoint['type'] {
  try {
    const hostname = new URL(baseUrl).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return 'local';
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) return 'lan';
  } catch {
    // ModelEndpoint validates the URL again.
  }
  return 'cloud';
}

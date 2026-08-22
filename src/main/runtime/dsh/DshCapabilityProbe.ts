import type {
  DshCapabilitySet,
  DshCredentialStatus,
} from '@shared/runtimeBindingTypes';
import { DshApiClient } from './DshApiClient';

export interface DshSettingsNamespace {
  ns: string;
  value: unknown;
  user?: unknown;
  base?: unknown;
  applies: 'live' | 'restart';
  secrets: Array<{ path: string[]; set: boolean }>;
  revision: number;
}

export interface DshProviderDirectoryEntry {
  provider: string;
  displayName: string;
  settingsNs: string;
  settingsPath: string[];
  active: boolean;
  declared?: boolean;
}

export interface DshCapabilitySnapshot {
  capabilities: DshCapabilitySet;
  settings: { writable: boolean; hasDocument: boolean; namespaces: DshSettingsNamespace[] } | null;
  providers: DshProviderDirectoryEntry[];
  credentials: Record<string, DshCredentialStatus>;
  checkedAt: string;
  error: string | null;
}

interface CacheEntry {
  version: string | null;
  snapshot: DshCapabilitySnapshot;
}

/** Probes only the documented, redacted DSH control-plane APIs. */
export class DshCapabilityProbe {
  private cache: CacheEntry | null = null;

  constructor(
    private readonly client: DshApiClient,
    private readonly getVersion: () => Promise<string | null>,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  async probe(force = false): Promise<DshCapabilitySnapshot> {
    const version = await this.getVersion().catch(() => null);
    if (!force && this.cache && this.cache.version === version) return this.cache.snapshot;

    const checkedAt = new Date().toISOString();
    const capabilities: DshCapabilitySet = {
      providerRead: false,
      providerWrite: false,
      credentialRead: false,
      credentialWrite: false,
      modelDiscovery: false,
      defaultModelSelection: false,
      acp: 'unavailable',
      compatibilityWarning: null,
      dshVersion: version,
      probedAt: checkedAt,
    };
    let settings: DshCapabilitySnapshot['settings'] = null;
    let providers: DshProviderDirectoryEntry[] = [];
    let credentials: Record<string, DshCredentialStatus> = {};
    const errors: string[] = [];

    try {
      const result = await this.client.call<{
        writable: boolean;
        hasDocument: boolean;
        namespaces: DshSettingsNamespace[];
      }>('settings.describe', {});
      settings = result;
      capabilities.providerWrite = result.writable;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    try {
      const result = await this.client.call<{ providers: DshProviderDirectoryEntry[] }>('llm.providers', {});
      providers = result.providers;
      capabilities.providerRead = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    try {
      await this.client.call('llm.models', {});
      // The installed DSH package exposes llm.discoverModels in the same
      // documented RPC map as llm.models. The actual network discovery is
      // still performed only by an explicit Discover action.
      capabilities.modelDiscovery = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const refs = collectCredentialRefs(settings?.namespaces ?? []);
    if (refs.length === 0) refs.push('DEEPSEEK_API_KEY');
    try {
      const result = await this.client.call<{ credentials: Record<string, DshCredentialStatus> }>('credentials.describe', { refs });
      credentials = result.credentials;
      capabilities.credentialRead = true;
      capabilities.credentialWrite = Object.values(credentials).some((credential) => credential.writable);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const snapshot: DshCapabilitySnapshot = {
      capabilities,
      settings,
      providers,
      credentials,
      checkedAt,
      error: errors.length > 0 ? errors[0] : null,
    };
    this.cache = { version, snapshot };
    return snapshot;
  }
}

function collectCredentialRefs(namespaces: DshSettingsNamespace[]): string[] {
  const refs = new Set<string>();
  for (const namespace of namespaces) {
    collectStrings(namespace.value, refs, 'apiKeyEnv');
    for (const secret of namespace.secrets) {
      const last = secret.path.at(-1);
      if (last && /^[A-Za-z_][A-Za-z0-9_]*$/.test(last)) refs.add(last);
    }
  }
  return [...refs].slice(0, 64);
}

function collectStrings(value: unknown, output: Set<string>, keyName: string): void {
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, keyName);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === keyName && typeof item === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(item)) output.add(item);
    collectStrings(item, output, keyName);
  }
}

export function getPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

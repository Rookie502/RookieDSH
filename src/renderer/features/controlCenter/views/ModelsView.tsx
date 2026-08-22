import { useEffect, useRef, useState } from 'react';
import type {
  DshCapabilitySet,
  DshProvider,
  ModelEndpoint,
  ModelEndpointInput,
  RuntimeBindingInput,
  RuntimeModelBinding,
} from '@shared/types';
import { t } from '../../../i18n';

interface ModelsViewProps {
  endpoints: ModelEndpoint[];
  onChange: (endpoints: ModelEndpoint[]) => void;
  providers: DshProvider[];
  bindings: RuntimeModelBinding[];
  capabilities: DshCapabilitySet | null;
  onRefreshProviders: () => void;
  onImportProvider: (providerId: string) => Promise<void>;
  onBindEndpoint: (input: RuntimeBindingInput) => Promise<void>;
  onUnbind: (bindingId: string) => Promise<void>;
}

const DEFAULT_ENDPOINT: ModelEndpointInput = {
  name: 'LM Studio',
  type: 'lan',
  protocol: 'openai-compatible',
  baseUrl: 'http://10.18.143.100:1234/v1',
};

type ModelsSection = 'endpoints' | 'providers' | 'bindings';

export default function ModelsView({
  endpoints,
  onChange,
  providers,
  bindings,
  capabilities,
  onRefreshProviders,
  onImportProvider,
  onBindEndpoint,
  onUnbind,
}: ModelsViewProps) {
  const [form, setForm] = useState<ModelEndpointInput>(DEFAULT_ENDPOINT);
  const [activeSection, setActiveSection] = useState<ModelsSection>('endpoints');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerBusy, setProviderBusy] = useState<string | null>(null);
  const healthRefreshInFlight = useRef(false);

  useEffect(() => {
    let disposed = false;
    const refreshHealth = async () => {
      if (healthRefreshInFlight.current) return;
      healthRefreshInFlight.current = true;
      try {
        const current = await window.rookiedsh?.models.list() ?? [];
        if (!disposed) onChange(current);
        const checked = await Promise.all(current.map((endpoint) => window.rookiedsh?.models.check(endpoint.id)));
        if (!disposed) onChange(checked.filter((endpoint): endpoint is ModelEndpoint => Boolean(endpoint)));
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        healthRefreshInFlight.current = false;
        if (!disposed) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void refreshHealth();
    const timer = window.setInterval(() => void refreshHealth(), 20_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [onChange]);

  async function addEndpoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const endpoint = await window.rookiedsh?.models.add(form);
      if (endpoint) {
        onChange([...endpoints, endpoint]);
        setForm(DEFAULT_ENDPOINT);
        setActiveSection('endpoints');
        const checked = await window.rookiedsh?.models.check(endpoint.id);
        if (checked) onChange([...endpoints, checked]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function refreshEndpoints() {
    if (healthRefreshInFlight.current) return;
    healthRefreshInFlight.current = true;
    setRefreshing(true);
    try {
      const current = await window.rookiedsh?.models.list() ?? [];
      onChange(current);
      const checked = await Promise.all(current.map((endpoint) => window.rookiedsh?.models.check(endpoint.id)));
      onChange(checked.filter((endpoint): endpoint is ModelEndpoint => Boolean(endpoint)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      healthRefreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  async function runEndpointAction(id: string, action: 'check' | 'discover') {
    setBusyId(id);
    setError(null);
    try {
      const endpoint = action === 'check'
        ? await window.rookiedsh?.models.check(id)
        : await window.rookiedsh?.models.discover(id);
      if (endpoint) onChange(endpoints.map((item) => item.id === id ? endpoint : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function removeEndpoint(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const removed = await window.rookiedsh?.models.remove(id);
      if (removed) onChange(endpoints.filter((item) => item.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function bindEndpoint(endpoint: ModelEndpoint) {
    if (endpoint.models.length === 0) return;
    setProviderBusy(endpoint.id);
    setError(null);
    try {
      await onBindEndpoint({ endpointId: endpoint.id, modelId: endpoint.models[0] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setProviderBusy(null);
    }
  }

  async function importProvider(provider: DshProvider) {
    setProviderBusy(provider.provider);
    setError(null);
    try {
      await onImportProvider(provider.provider);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setProviderBusy(null);
    }
  }

  const boundProviderIds = new Set(bindings.map((binding) => binding.nativeProviderId));
  const relevantProviders = providers.filter((provider) => provider.active || provider.credential?.configured || boundProviderIds.has(provider.provider));
  const inactiveProviders = providers.filter((provider) => !relevantProviders.includes(provider));

  return (
    <div className="control-center-view-stack">
      <article className="control-card">
        <div className="card-heading">
          <div>
            <div className="card-kicker">{t('models.eyebrow')}</div>
            <h2>{t('models.title')}</h2>
          </div>
          <span className="diagnostics-count">{endpoints.length}</span>
        </div>
        <div className="models-tabs" role="tablist" aria-label={t('models.title')}>
          <Tab active={activeSection === 'endpoints'} onClick={() => setActiveSection('endpoints')}>{t('models.endpointsTab')}</Tab>
          <Tab active={activeSection === 'providers'} onClick={() => setActiveSection('providers')}>{t('models.providersTab')}</Tab>
          <Tab active={activeSection === 'bindings'} onClick={() => setActiveSection('bindings')}>{t('models.bindingsTab')}</Tab>
        </div>
        {error && <div className="inline-error" role="alert">{error}</div>}
      </article>

      {activeSection === 'endpoints' && (
        <>
          <article className="control-card">
            <div className="card-heading">
              <div>
                <div className="card-kicker">{t('models.endpoint')}</div>
                <h2>{t('models.modelEndpointsTitle')}</h2>
              </div>
              <button type="button" className="secondary-button" onClick={() => void refreshEndpoints()} disabled={refreshing}>
                {refreshing ? t('models.checking') : t('models.refresh')}
              </button>
            </div>
            {loading && <p className="muted-text">{t('models.loading')}</p>}
            {!loading && endpoints.length === 0 && <p className="muted-text">{t('models.empty')}</p>}
            <div className="endpoint-list">
              {endpoints.map((endpoint) => (
                <EndpointCard
                  key={endpoint.id}
                  endpoint={endpoint}
                  busy={busyId === endpoint.id}
                  bindingBusy={providerBusy === endpoint.id}
                  canBind={Boolean(capabilities?.providerWrite)}
                  onCheck={() => void runEndpointAction(endpoint.id, 'check')}
                  onDiscover={() => void runEndpointAction(endpoint.id, 'discover')}
                  onRemove={() => void removeEndpoint(endpoint.id)}
                  onBind={() => void bindEndpoint(endpoint)}
                />
              ))}
            </div>
          </article>
          <article className="control-card">
            <div className="card-kicker">{t('models.addEndpoint')}</div>
            <form className="model-endpoint-form" onSubmit={(event) => void addEndpoint(event)}>
              <label className="form-field"><span>{t('models.endpointName')}</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label className="form-field"><span>{t('models.baseUrl')}</span><input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} type="url" required /></label>
              <label className="form-field"><span>{t('models.endpointType')}</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ModelEndpointInput['type'] })}><option value="local">local</option><option value="lan">lan</option><option value="cloud">cloud</option></select></label>
              <div className="card-actions"><button type="submit">{t('models.add')}</button></div>
            </form>
          </article>
        </>
      )}

      {activeSection === 'providers' && (
        <article className="control-card">
          <div className="card-heading">
            <div><div className="card-kicker">{t('models.nativeProviders')}</div><h2>{t('models.harnessProvidersTitle')}</h2></div>
            <button type="button" className="secondary-button" onClick={onRefreshProviders}>{t('models.refresh')}</button>
          </div>
          {!capabilities?.providerRead && <p className="muted-text">{t('models.providerUnavailable')}</p>}
          {capabilities?.providerRead && relevantProviders.length === 0 && <p className="muted-text">{t('models.noRelevantProviders')}</p>}
          <div className="endpoint-list">{relevantProviders.map((provider) => <ProviderRow key={provider.provider} provider={provider} busy={providerBusy === provider.provider} onImport={() => void importProvider(provider)} />)}</div>
          {inactiveProviders.length > 0 && (
            <details className="secondary-resource-list">
              <summary>{t('models.inactiveProviders').replace('{count}', String(inactiveProviders.length))}</summary>
              <div className="compact-provider-list">{inactiveProviders.map((provider) => <ProviderRow key={provider.provider} provider={provider} busy={providerBusy === provider.provider} onImport={() => void importProvider(provider)} compact />)}</div>
            </details>
          )}
        </article>
      )}

      {activeSection === 'bindings' && (
        <article className="control-card">
          <div className="card-heading"><div><div className="card-kicker">{t('models.runtimeBindings')}</div><h2>{t('models.bindingTitle')}</h2></div><span className="diagnostics-count">{bindings.length}</span></div>
          {bindings.length === 0 && <p className="muted-text">{t('models.noBindings')}</p>}
          <div className="endpoint-list">{bindings.map((binding) => <BindingCard key={binding.id} binding={binding} onUnbind={() => void onUnbind(binding.id)} />)}</div>
        </article>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} className={`models-tab${active ? ' active' : ''}`} onClick={onClick}>{children}</button>;
}

function EndpointCard({ endpoint, busy, bindingBusy, canBind, onCheck, onDiscover, onRemove, onBind }: { endpoint: ModelEndpoint; busy: boolean; bindingBusy: boolean; canBind: boolean; onCheck: () => void; onDiscover: () => void; onRemove: () => void; onBind: () => void }) {
  const preview = endpoint.models.slice(0, 3);
  return (
    <div className="endpoint-card compact-resource-card">
      <div className="card-heading"><div><strong>{endpoint.name}</strong><div className="endpoint-url">{endpoint.baseUrl}</div></div><span className={`endpoint-status endpoint-${endpoint.status.toLowerCase()}`}>{formatEndpointStatus(endpoint.status)}</span></div>
      <div className="endpoint-meta"><span>{t('models.endpointType')}: {endpoint.type}</span><span>{t('models.models')}: {endpoint.models.length}</span><span>{t('models.lastChecked')}: {formatDate(endpoint.lastCheckedAt)}</span></div>
      {(endpoint.status === 'STALE' || endpoint.status === 'OFFLINE') && endpoint.models.length > 0 && <div className="cached-note">{t('models.cachedModels')}</div>}
      {(endpoint.lastError ?? endpoint.error) && <div className="inline-error">{endpoint.lastError ?? endpoint.error}</div>}
      {preview.length > 0 && <div className="endpoint-model-preview">{preview.map((model) => <ModelResource key={model} endpoint={endpoint} model={model} />)}{endpoint.models.length > preview.length && <span>+{endpoint.models.length - preview.length}</span>}</div>}
      {endpoint.supportsLoadedModelQuery !== true && <div className="cached-note">{t('models.loadedStateUnavailable')}</div>}
      <details className="resource-details"><summary>{t('models.showModels')}</summary><div className="endpoint-models">{endpoint.models.length === 0 ? <em>{t('models.noModels')}</em> : endpoint.models.map((model) => <ModelResource key={model} endpoint={endpoint} model={model} />)}</div><div className="endpoint-meta"><span>{t('models.lastDiscovered')}: {formatDate(endpoint.lastSuccessAt)}</span></div></details>
      <div className="card-actions"><button type="button" onClick={onCheck} disabled={busy}>{busy ? t('models.checking') : t('models.testConnection')}</button><button type="button" className="secondary-button" onClick={onDiscover} disabled={busy}>{t('models.discover')}</button><button type="button" className="secondary-button" onClick={onRemove} disabled={busy}>{t('models.remove')}</button><button type="button" className="secondary-button" onClick={onBind} disabled={bindingBusy || endpoint.models.length === 0 || !canBind}>{bindingBusy ? t('models.binding') : t('models.bind')}</button></div>
    </div>
  );
}

function ProviderRow({ provider, busy, onImport, compact = false }: { provider: DshProvider; busy: boolean; onImport: () => void; compact?: boolean }) {
  return (
    <div className={`endpoint-card provider-card${compact ? ' compact-provider-card' : ''}`}>
      <div className="card-heading"><div><strong>{provider.displayName}</strong><div className="endpoint-url">{provider.provider}</div></div><span className={provider.active ? 'endpoint-status endpoint-online' : 'endpoint-status'}>{provider.active ? t('models.active') : t('models.inactive')}</span></div>
      <div className="endpoint-meta"><span>{t('models.credential')}: {provider.credential ? provider.credential.configured ? t('models.configured') : t('models.notConfigured') : t('models.notRequired')}</span>{provider.baseUrl && <span className="endpoint-url">{provider.baseUrl}</span>}</div>
      {!compact && <details className="resource-details"><summary>{t('models.showModels')}</summary><div className="endpoint-models">{provider.models.length === 0 ? <em>{t('models.noModels')}</em> : provider.models.map((model) => <code key={model}>{model}</code>)}</div></details>}
      {provider.baseUrl && <div className="card-actions"><button type="button" className="secondary-button" onClick={onImport} disabled={busy}>{t('models.importExisting')}</button></div>}
    </div>
  );
}

function BindingCard({ binding, onUnbind }: { binding: RuntimeModelBinding; onUnbind: () => void }) {
  return <div className="endpoint-card compact-resource-card"><div className="card-heading"><strong>{binding.nativeProviderId}</strong><span className={`endpoint-status endpoint-${binding.status.toLowerCase()}`}>{binding.status}</span></div><div className="endpoint-meta"><span>{t('models.model')}: {binding.modelId}</span><span>{t('models.endpointId')}: {binding.endpointId}</span></div>{binding.lastError && <div className="inline-error">{binding.lastError}</div>}<div className="card-actions"><button type="button" className="secondary-button" onClick={onUnbind}>{t('models.unbind')}</button></div></div>;
}

function formatEndpointStatus(status: ModelEndpoint['status']): string {
  if (status === 'ONLINE') return t('models.endpointOnline');
  if (status === 'OFFLINE') return t('models.endpointOffline');
  if (status === 'STALE') return t('models.stale');
  if (status === 'CHECKING') return t('models.checking');
  return t('models.unknown');
}

function ModelResource({ endpoint, model }: { endpoint: ModelEndpoint; model: string }) {
  const state = endpoint.modelStates[model] ?? 'DISCOVERED';
  const label = state === 'DISCOVERED'
    ? t('models.modelDiscovered')
    : state === 'AVAILABLE'
      ? t('models.modelAvailable')
      : state === 'LOADED'
        ? t('models.modelLoaded')
        : t('models.modelUnknown');
  return <span className="model-resource"><code>{model}</code><small>{label}</small></span>;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : t('common.notAvailable');
}

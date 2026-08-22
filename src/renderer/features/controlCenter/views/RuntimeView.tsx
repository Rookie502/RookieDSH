import type { DshCapabilitySet, RuntimeDiagnostics, RuntimeInfo, RuntimeLogEntry, SoftwareVersion } from '@shared/types';
import RuntimeCard from '../RuntimeCard';
import DiagnosticsCard from '../DiagnosticsCard';
import { t } from '../../../i18n';

interface RuntimeViewProps {
  info: RuntimeInfo;
  now: number;
  diagnostics: RuntimeDiagnostics;
  logs: RuntimeLogEntry[];
  actionError: string | null;
  onRestart: () => void;
  onStop: () => void;
  update: SoftwareVersion | null;
  onViewUpdates: () => void;
  capabilities: DshCapabilitySet | null;
  providerCount: number;
  onManageProviders: () => void;
}

export default function RuntimeView({
  info,
  now,
  diagnostics,
  logs,
  actionError,
  onRestart,
  onStop,
  update,
  onViewUpdates,
  capabilities,
  providerCount,
  onManageProviders,
}: RuntimeViewProps) {
  return (
    <div className="control-center-view-stack">
      <RuntimeCard
        info={info}
        now={now}
        busy={info.status === 'STARTING' || info.status === 'STOPPING'}
        actionError={actionError}
        onRestart={onRestart}
        onStop={onStop}
        update={update}
        onViewUpdates={onViewUpdates}
      />
      <DiagnosticsCard diagnostics={diagnostics} logs={logs} />
      <article className="control-card">
        <div className="card-heading">
          <div>
            <div className="card-kicker">{t('runtime.capabilitiesEyebrow')}</div>
            <h2>{t('runtime.capabilities')}</h2>
          </div>
          <span className="readonly-label">{t('runtime.providersCount')}: {providerCount}</span>
        </div>
        <div className="capability-list">
          <Capability label={t('runtime.providerRead')} value={capabilities?.providerRead ?? false} />
          <Capability label={t('runtime.providerWrite')} value={capabilities?.providerWrite ?? false} />
          <Capability label={t('runtime.credentialWrite')} value={capabilities?.credentialWrite ?? false} />
          <Capability label={t('runtime.modelDiscovery')} value={capabilities?.modelDiscovery ?? false} />
          <Capability label={t('runtime.acp')} value={capabilities?.acp === 'detected'} unknown={capabilities?.acp === 'unknown'} />
        </div>
        {capabilities?.compatibilityWarning && <p className="inline-error">{capabilities.compatibilityWarning}</p>}
        <div className="card-actions">
          <button type="button" className="secondary-button" onClick={onManageProviders}>{t('runtime.manageProviders')}</button>
        </div>
      </article>
    </div>
  );
}

function Capability({ label, value, unknown = false }: { label: string; value: boolean; unknown?: boolean }) {
  return (
    <div className="capability-row">
      <span>{label}</span>
      <strong className={unknown ? 'capability-unknown' : value ? 'capability-supported' : 'capability-unsupported'}>
        {unknown ? '—' : value ? '✓' : '✕'}
      </strong>
    </div>
  );
}

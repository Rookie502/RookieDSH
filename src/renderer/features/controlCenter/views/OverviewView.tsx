import type { RookieDshConfig } from '@shared/configTypes';
import type { CoreOverview, RuntimeDiagnostics, RuntimeInfo, RuntimeLogEntry } from '@shared/types';
import { t } from '../../../i18n';
import CoreOverviewCard from '../CoreOverviewCard';
import DiagnosticsCard from '../DiagnosticsCard';
import ConfigCard from '../ConfigCard';
import { formatDuration } from '../RuntimeCard';

interface OverviewViewProps {
  overview: CoreOverview | null;
  info: RuntimeInfo;
  diagnostics: RuntimeDiagnostics;
  logs: RuntimeLogEntry[];
  config: RookieDshConfig | null;
  now: number;
  runtimeCount: number;
  modelEndpointCount: number;
  onlineModelEndpointCount: number;
  updateAvailable: boolean;
  providerCount: number;
  bindingCount: number;
  providerSyncHealthy: boolean | null;
}

export default function OverviewView({
  overview,
  info,
  diagnostics,
  logs,
  config,
  now,
  runtimeCount,
  modelEndpointCount,
  onlineModelEndpointCount,
  updateAvailable,
  providerCount,
  bindingCount,
  providerSyncHealthy,
}: OverviewViewProps) {
  const uptime = info.startedAt && info.status === 'RUNNING'
    ? formatDuration(Math.max(0, now - Date.parse(info.startedAt)))
    : t('common.notAvailable');

  return (
    <div className="control-center-view-stack">
      <CoreOverviewCard overview={overview} />
      <article className="control-card">
        <div className="card-kicker">{t('overview.eyebrow')}</div>
        <h2>{t('overview.title')}</h2>
        <div className="core-metrics">
          <Metric label={t('overview.runtimeCount')} value={runtimeCount} />
          <Metric label={t('overview.modelEndpointCount')} value={`${onlineModelEndpointCount} / ${modelEndpointCount}`} />
          <Metric label={t('overview.providerCount')} value={providerCount} />
          <Metric label={t('overview.bindingCount')} value={bindingCount} />
          <Metric label={t('overview.updateAvailable')} value={updateAvailable ? t('updates.updateAvailable') : t('overview.noUpdate')} />
          <Metric label={t('overview.providerSync')} value={providerSyncHealthy === null ? t('common.notAvailable') : providerSyncHealthy ? t('overview.healthy') : t('overview.driftDetected')} />
        </div>
      </article>
      <article className="control-card overview-runtime-card">
        <div className="card-heading">
          <div>
            <div className="card-kicker">{t('overview.runtimeStatus')}</div>
            <h2>{t('runtime.title')}</h2>
          </div>
          <span className={`status-badge status-${info.status.toLowerCase()}`}>
            <span className="status-dot" aria-hidden="true" />
            {runtimeStatusLabel(info.status)}
          </span>
        </div>
        <div className="runtime-metrics overview-runtime-metrics">
          <Metric label={t('runtime.pid')} value={info.pid ?? t('common.notAvailable')} />
          <Metric label={t('runtime.port')} value={info.url ? new URL(info.url).port || t('common.notAvailable') : t('common.notAvailable')} />
          <Metric label={t('runtime.uptime')} value={uptime} />
        </div>
      </article>
      <DiagnosticsCard diagnostics={diagnostics} logs={logs} />
      <ConfigCard config={config} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="runtime-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function runtimeStatusLabel(status: RuntimeInfo['status']): string {
  return t(`runtime.status${status.charAt(0)}${status.slice(1).toLowerCase()}`);
}

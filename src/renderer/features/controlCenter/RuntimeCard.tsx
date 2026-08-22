import type { RuntimeInfo, SoftwareVersion } from '@shared/types';
import { t } from '../../i18n';

interface RuntimeCardProps {
  info: RuntimeInfo;
  now: number;
  busy: boolean;
  actionError: string | null;
  onRestart: () => void;
  onStop: () => void;
  update: SoftwareVersion | null;
  onViewUpdates: () => void;
}

export default function RuntimeCard({
  info,
  now,
  busy,
  actionError,
  onRestart,
  onStop,
  update,
  onViewUpdates,
}: RuntimeCardProps) {
  const uptime = info.startedAt && info.status === 'RUNNING'
    ? formatDuration(Math.max(0, now - Date.parse(info.startedAt)))
    : '—';
  const error = info.status === 'FAILED' ? info.error ?? actionError : actionError;

  return (
    <article className="control-card runtime-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">{t('runtime.eyebrow')}</div>
          <h2>{t('runtime.title')}</h2>
        </div>
        <span className={`status-badge status-${info.status.toLowerCase()}`}>
          <span className="status-dot" aria-hidden="true" />
          {formatStatus(info.status)}
        </span>
      </div>

      <div className="runtime-metrics">
        <Metric label={t('runtime.pid')} value={info.pid ?? t('common.notAvailable')} />
        <Metric label={t('runtime.port')} value={info.url ? new URL(info.url).port || t('common.notAvailable') : t('common.notAvailable')} />
        <Metric label={t('runtime.uptime')} value={uptime} />
        <Metric label={t('runtime.readiness')} value={formatReadiness(info.readiness)} />
        <Metric label={t('runtime.version')} value={update?.currentVersion ?? t('common.notAvailable')} />
        <Metric label={t('runtime.compatibility')} value={formatCompatibility(update?.compatibility)} />
      </div>

      {update?.installation && (
        <div className="runtime-installation">
          <InstallationRow label={t('runtime.installation')} value={formatInstallation(update.installation.type)} />
          <InstallationRow label={t('runtime.package')} value={update.installation.packageName} />
          <InstallationRow label={t('runtime.executable')} value={update.installation.executablePath ?? t('common.notAvailable')} />
          <InstallationRow label={t('runtime.updateMethod')} value={update.installation.updateCommand} />
        </div>
      )}

      {info.status === 'FAILED' && (
        <div className="runtime-error" role="alert">
          <strong>{t('runtime.startupFailed')}</strong>
          <span>{t('runtime.reason')}: {info.error ?? t('runtime.unknownError')}</span>
          <span>{t('runtime.suggestion')}</span>
        </div>
      )}
      {error && info.status !== 'FAILED' && <div className="inline-error">{error}</div>}

      <div className="card-actions">
        <button type="button" onClick={onRestart} disabled={busy}>{t('runtime.restart')}</button>
        <button type="button" className="secondary-button" onClick={onStop} disabled={info.status !== 'STARTING' && info.status !== 'RUNNING'}>{t('runtime.stop')}</button>
        {update?.compatibility === 'update-available' && (
          <button type="button" className="secondary-button" onClick={onViewUpdates}>{t('runtime.viewUpdates')}</button>
        )}
      </div>
    </article>
  );
}

function formatCompatibility(value: SoftwareVersion['compatibility'] | undefined): string {
  if (value === 'compatible') return t('runtime.compatible');
  if (value === 'update-available') return t('runtime.updateAvailable');
  return t('runtime.unknownCompatibility');
}

function formatReadiness(value: RuntimeInfo['readiness']): string {
  const key: Record<RuntimeInfo['readiness'], string> = {
    NOT_STARTED: 'NotStarted',
    PROCESS_RUNNING: 'ProcessRunning',
    PORT_READY: 'PortReady',
    WEB_READY: 'WebReady',
    PAGE_READY: 'PageReady',
  };
  return t(`runtime.readiness${key[value]}`);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="runtime-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InstallationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="runtime-installation-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatInstallation(type: NonNullable<SoftwareVersion['installation']>['type']): string {
  if (type === 'npm-global') return t('runtime.npmGlobal');
  return type;
}

function formatStatus(status: RuntimeInfo['status']): string {
  return t(`runtime.status${status.charAt(0)}${status.slice(1).toLowerCase()}`);
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds == null) return '—';
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

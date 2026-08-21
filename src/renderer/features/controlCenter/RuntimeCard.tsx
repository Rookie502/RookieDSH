import type { RuntimeInfo } from '@shared/types';
import { t } from '../../i18n';

interface RuntimeCardProps {
  info: RuntimeInfo;
  now: number;
  busy: boolean;
  actionError: string | null;
  onRestart: () => void;
  onStop: () => void;
}

export default function RuntimeCard({ info, now, busy, actionError, onRestart, onStop }: RuntimeCardProps) {
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
      </div>

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
      </div>
    </article>
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

import type { RuntimeInfo } from '@shared/types';

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
          <div className="card-kicker">Runtime</div>
          <h2>DeepSeek Harness</h2>
        </div>
        <span className={`status-badge status-${info.status.toLowerCase()}`}>
          <span className="status-dot" aria-hidden="true" />
          {formatStatus(info.status)}
        </span>
      </div>

      <div className="runtime-metrics">
        <Metric label="PID" value={info.pid ?? '—'} />
        <Metric label="Port" value={info.url ? new URL(info.url).port || '—' : '—'} />
        <Metric label="Uptime" value={uptime} />
      </div>

      {info.status === 'FAILED' && (
        <div className="runtime-error" role="alert">
          <strong>Harness startup failed</strong>
          <span>Reason: {info.error ?? 'Unknown runtime error'}</span>
          <span>Suggestion: Restart Runtime</span>
        </div>
      )}
      {error && info.status !== 'FAILED' && <div className="inline-error">{error}</div>}

      <div className="card-actions">
        <button type="button" onClick={onRestart} disabled={busy}>Restart Runtime</button>
        <button type="button" className="secondary-button" onClick={onStop} disabled={info.status !== 'STARTING' && info.status !== 'RUNNING'}>Stop Runtime</button>
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
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds == null) return '—';
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

import type { RuntimeDiagnostics, RuntimeLogEntry } from '@shared/types';
import { formatDuration } from './RuntimeCard';

export default function DiagnosticsCard({ diagnostics, logs }: { diagnostics: RuntimeDiagnostics; logs: RuntimeLogEntry[] }) {
  const recentLogs = logs.slice(-20);

  return (
    <article className="control-card diagnostics-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">Diagnostics</div>
          <h2>Runtime health</h2>
        </div>
        <span className="diagnostics-count">{diagnostics.restartCount} restarts</span>
      </div>

      <div className="diagnostics-summary">
        <DiagnosticValue label="Last Startup" value={formatTimestamp(diagnostics.lastStartTime)} />
        <DiagnosticValue label="Startup Duration" value={formatDuration(diagnostics.startupDuration)} />
        <DiagnosticValue label="Last Error" value={diagnostics.lastError ?? 'None'} error={Boolean(diagnostics.lastError)} />
      </div>

      <div className="logs-section">
        <div className="logs-title">Recent Logs</div>
        <pre className="logs-list">
          {recentLogs.length === 0
            ? 'No logs yet.'
            : recentLogs.map((entry) => `[${formatLogTime(entry.timestamp)}] ${entry.message}`).join('\n')}
        </pre>
      </div>
    </article>
  );
}

function DiagnosticValue({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return (
    <div className="diagnostic-value">
      <span>{label}</span>
      <strong className={error ? 'text-error' : ''}>{value}</strong>
    </div>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatLogTime(value: string): string {
  return new Date(value).toLocaleTimeString();
}

import type { RuntimeDiagnostics, RuntimeLogEntry } from '@shared/types';
import { getLanguage, t } from '../../i18n';
import { formatDuration } from './RuntimeCard';

export default function DiagnosticsCard({ diagnostics, logs }: { diagnostics: RuntimeDiagnostics; logs: RuntimeLogEntry[] }) {
  const recentLogs = logs.slice(-20);

  return (
    <article className="control-card diagnostics-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">{t('diagnostics.eyebrow')}</div>
          <h2>{t('diagnostics.title')}</h2>
        </div>
        <span className="diagnostics-count">{diagnostics.restartCount} {t('diagnostics.restarts')}</span>
      </div>

      <div className="diagnostics-summary">
        <DiagnosticValue label={t('diagnostics.lastStartup')} value={formatTimestamp(diagnostics.lastStartTime)} />
        <DiagnosticValue label={t('diagnostics.startupDuration')} value={formatDuration(diagnostics.startupDuration)} />
        <DiagnosticValue label={t('diagnostics.lastError')} value={diagnostics.lastError ?? t('diagnostics.none')} error={Boolean(diagnostics.lastError)} />
      </div>

      <div className="logs-section">
        <div className="logs-title">{t('diagnostics.recentLogs')}</div>
        <pre className="logs-list">
          {recentLogs.length === 0
            ? t('diagnostics.noLogs')
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
  return new Date(value).toLocaleString(getLanguage());
}

function formatLogTime(value: string): string {
  return new Date(value).toLocaleTimeString(getLanguage());
}

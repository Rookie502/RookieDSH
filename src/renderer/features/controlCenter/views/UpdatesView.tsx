import { useEffect, useState } from 'react';
import type { RuntimeUpdateProgress, SoftwareVersion, UpdateHistory, UpdateStatus } from '@shared/types';
import { t } from '../../../i18n';

interface UpdatesViewProps {
  status: UpdateStatus | null;
  checking: boolean;
  updating: boolean;
  onCheck: () => void;
  onUpdate: () => void;
  onRestartRuntime: () => void;
  onViewRuntimeLogs: () => void;
  history: UpdateHistory[];
  progress: RuntimeUpdateProgress;
}

export default function UpdatesView({ status, checking, updating, onCheck, onUpdate, onRestartRuntime, onViewRuntimeLogs, history, progress }: UpdatesViewProps) {
  const [now, setNow] = useState(() => Date.now());
  const rookiedsh = status?.software.find((version) => version.target === 'rookiedsh') ?? null;
  const harness = status?.software.find((version) => version.target === 'deepseek-harness') ?? null;
  const jobActive = isUpdateInProgress(progress.stage);
  const recoveryRequired = progress.outcome === 'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED';
  const elapsed = jobActive && progress.startedAt ? Math.max(0, now - Date.parse(progress.startedAt)) : progress.elapsedMs;

  useEffect(() => {
    if (!jobActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [jobActive]);

  return (
    <div className="control-center-view-stack">
      <article className="control-card">
        <div className="card-heading">
          <div><div className="card-kicker">{t('updates.eyebrow')}</div><h2>{t('updates.title')}</h2></div>
          <button type="button" onClick={onCheck} disabled={checking || jobActive}>{checking ? t('updates.checking') : t('updates.check')}</button>
        </div>
        <div className="update-list">
          <UpdateRow title={t('updates.rookiedsh')} version={rookiedsh} currentLabel={t('updates.currentVersion')} />
          <UpdateRow title={t('updates.harness')} version={harness} currentLabel={t('updates.installedVersion')} />
        </div>
        {harness?.compatibility === 'update-available' && (
          <div className="update-action-row">
            <div><strong>{t('updates.updateAvailableDetail')}</strong><span>{harness.currentVersion ?? t('common.notAvailable')} → {harness.latestVersion ?? t('common.notAvailable')}</span></div>
            <button type="button" onClick={onUpdate} disabled={updating || jobActive}>{updating ? t('updates.installing') : t('updates.installUpdate')}</button>
          </div>
        )}
      </article>

      {progress.stage !== 'IDLE' && (
        <article className="control-card">
          <div className="card-heading"><div><div className="card-kicker">{t('updates.jobProgress')}</div><h2>{progress.message}</h2></div><span className={`update-job-state update-job-${progress.stage.toLowerCase()}`}>{formatOutcome(progress.outcome, progress.stage)}</span></div>
          {jobActive && <div className="update-progress-indeterminate" role="progressbar" aria-label={progress.message}><span /></div>}
          <div className="update-progress-meta"><span>{t('updates.elapsed')}: {formatElapsed(elapsed)}</span><span>{progress.fromVersion ?? t('common.notAvailable')} → {progress.toVersion ?? t('common.notAvailable')}</span></div>
          {recoveryRequired && <div className="update-restart-warning" role="alert"><strong>{t('updates.restartFailed')}</strong><span>{t('updates.runtimeStoppedAfterUpdate')}</span>{progress.error && <span>{progress.error}</span>}<div className="card-actions"><button type="button" onClick={onRestartRuntime}>{t('updates.restartRuntime')}</button><button type="button" className="secondary-button" onClick={onViewRuntimeLogs}>{t('updates.viewLogs')}</button></div></div>}
          {progress.stage === 'FAILED' && progress.error && !recoveryRequired && <div className="inline-error">{progress.error}</div>}
          {progress.logs.length > 0 && <div className="update-job-logs"><div className="logs-title">{t('updates.updateLogs')}</div><div className="logs-list">{progress.logs.slice(-20).map((entry, index) => <div className={`update-log-${entry.level}`} key={`${entry.timestamp}-${index}`}>{formatDate(entry.timestamp)} {entry.message}</div>)}</div></div>}
        </article>
      )}

      {status && status.checks.length > 0 && (
        <article className="control-card">
          <div className="card-kicker">{t('updates.releaseNotes')}</div>
          <div className="update-history">{status.checks.slice(-6).reverse().map((check) => <div className="update-history-row" key={check.id}><span>{check.target === 'rookiedsh' ? t('updates.rookiedsh') : t('updates.harness')}</span><span>{formatDate(check.checkedAt)}</span><span>{formatCompatibility(check.compatibility)}</span></div>)}</div>
        </article>
      )}
      {history.length > 0 && (
        <article className="control-card">
          <div className="card-kicker">{t('updates.runtimeHistory')}</div>
          <div className="update-history">{history.slice(-6).reverse().map((item) => <div className="update-history-row update-history-row-outcome" key={item.id}><span>{item.outcome}</span><span>{item.fromVersion ?? t('common.notAvailable')} → {item.toVersion ?? t('common.notAvailable')}</span><span>{t('updates.installation')}: {item.installationResult}</span><span>{t('updates.restart')}: {item.restartResult}</span><span>{formatDate(item.timestamp)}</span></div>)}</div>
        </article>
      )}
    </div>
  );
}

function UpdateRow({ title, version, currentLabel }: { title: string; version: SoftwareVersion | null; currentLabel: string }) {
  return <section className="update-row"><div className="card-heading"><strong>{title}</strong><span className={`endpoint-status compatibility-${version?.compatibility ?? 'unknown'}`}>{formatCompatibility(version?.compatibility)}</span></div><div className="update-version-grid"><div><span>{currentLabel}</span><strong>{version?.currentVersion ?? t('common.notAvailable')}</strong></div><div><span>{t('updates.latestVersion')}</span><strong>{version?.latestVersion ?? t('updates.noRelease')}</strong></div><div><span>{t('updates.checkedAt')}</span><strong>{version?.checkedAt ? formatDate(version.checkedAt) : t('updates.neverChecked')}</strong></div></div>{version?.releaseNotes && <p className="update-notes">{version.releaseNotes}</p>}{version?.releaseUrl && <span className="update-link">{version.releaseUrl}</span>}{version?.error && <div className="inline-error">{version.error}</div>}</section>;
}

function isUpdateInProgress(stage: RuntimeUpdateProgress['stage']): boolean {
  return stage === 'CHECKING' || stage === 'PREPARING' || stage === 'STOPPING_RUNTIME' || stage === 'INSTALLING' || stage === 'VERIFYING' || stage === 'ROLLING_BACK' || stage === 'RESTARTING_RUNTIME';
}

function formatOutcome(outcome: RuntimeUpdateProgress['outcome'], stage: RuntimeUpdateProgress['stage']): string {
  if (outcome === 'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED') return t('updates.recoveryRequired');
  if (outcome === 'SUCCEEDED') return t('updates.succeeded');
  return stage;
}

function formatCompatibility(value: SoftwareVersion['compatibility'] | undefined): string {
  if (value === 'compatible') return t('updates.compatible');
  if (value === 'update-available') return t('updates.updateAvailable');
  return t('updates.unknown');
}

function formatDate(value: string): string { return new Date(value).toLocaleString(); }

function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1_000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

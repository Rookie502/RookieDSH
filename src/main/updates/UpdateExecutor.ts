import { randomUUID } from 'node:crypto';
import { getConfig } from '../config/configManager';
import { getCoreSnapshot, updateCoreSnapshot } from '../core/store/coreStore';
import { getRuntimeStatus, startRuntime, stopRuntime } from '../runtime/RuntimeManager';
import { syncDeepSeekHarnessRuntime } from '../runtime/RuntimeRegistry';
import { DeepSeekHarnessUpdater } from './providers/DeepSeekHarnessUpdater';
import type {
  RuntimeUpdateCheck,
  RuntimeUpdateHistoryStatus,
  RuntimeUpdateLogEntry,
  RuntimeUpdateInstallationResult,
  RuntimeUpdateOutcome,
  RuntimeUpdateProgress,
  RuntimeUpdateRestartResult,
  RuntimeUpdateResult,
  UpdateHistory,
} from '@shared/updateTypes';
import type { RuntimeInfo } from '@shared/types';

const MAX_UPDATE_LOGS = 100;

const INITIAL_PROGRESS: RuntimeUpdateProgress = {
  stage: 'IDLE',
  message: 'No runtime update is running.',
  fromVersion: null,
  toVersion: null,
  error: null,
  startedAt: null,
  updatedAt: new Date().toISOString(),
  finishedAt: null,
  elapsedMs: 0,
  installedVersion: null,
  restartStatus: 'NOT_REQUIRED',
  installationResult: 'NOT_ATTEMPTED',
  restartResult: 'NOT_REQUIRED',
  outcome: null,
  logs: [],
};

export interface UpdateExecutorOptions {
  requestConfirmation: (check: RuntimeUpdateCheck) => Promise<boolean>;
  onProgress?: (progress: RuntimeUpdateProgress) => void;
  onVersionChanged?: (version: string) => void;
  updater?: DeepSeekHarnessUpdater;
  runtime?: RuntimeLifecycle;
  getUpdateRestartTimeout?: () => number;
  persistHistory?: (history: UpdateHistory) => void;
  syncRuntimeVersion?: (version: string) => void;
}

export interface RuntimeLifecycle {
  getStatus(): RuntimeInfo;
  start(options?: { timeoutMs?: number; reason?: 'normal' | 'update-restart' }): Promise<void>;
  stop(): Promise<void>;
}

export class UpdateExecutor {
  private readonly requestConfirmation: UpdateExecutorOptions['requestConfirmation'];
  private readonly onProgress?: UpdateExecutorOptions['onProgress'];
  private readonly onVersionChanged?: UpdateExecutorOptions['onVersionChanged'];
  private readonly updater: DeepSeekHarnessUpdater;
  private readonly runtime: RuntimeLifecycle;
  private readonly getUpdateRestartTimeout: () => number;
  private readonly persistHistory?: (history: UpdateHistory) => void;
  private readonly syncRuntimeVersion: (version: string) => void;
  private progress: RuntimeUpdateProgress = cloneProgress(INITIAL_PROGRESS);
  private running: Promise<RuntimeUpdateResult> | null = null;
  private readonly listeners = new Set<(progress: RuntimeUpdateProgress) => void>();

  constructor(options: UpdateExecutorOptions) {
    this.requestConfirmation = options.requestConfirmation;
    this.onProgress = options.onProgress;
    this.onVersionChanged = options.onVersionChanged;
    this.updater = options.updater ?? new DeepSeekHarnessUpdater();
    this.runtime = options.runtime ?? { getStatus: getRuntimeStatus, start: startRuntime, stop: stopRuntime };
    this.getUpdateRestartTimeout = options.getUpdateRestartTimeout ?? (() => getConfig().runtime.updateRestartTimeout);
    this.persistHistory = options.persistHistory;
    this.syncRuntimeVersion = options.syncRuntimeVersion ?? ((version) => syncDeepSeekHarnessRuntime(this.runtime.getStatus(), version));
  }

  getProgress(): RuntimeUpdateProgress {
    return cloneProgress(this.progress);
  }

  onProgressChanged(listener: (progress: RuntimeUpdateProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getHistory(): UpdateHistory[] {
    return getCoreSnapshot().updateHistory;
  }

  async executeRuntimeUpdate(): Promise<RuntimeUpdateResult> {
    if (this.running) throw new Error('A DeepSeek Harness update is already in progress.');
    this.running = this.runUpdate();
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  private async runUpdate(): Promise<RuntimeUpdateResult> {
    const startedAt = new Date().toISOString();
    let check: RuntimeUpdateCheck | null = null;
    let backup: Awaited<ReturnType<DeepSeekHarnessUpdater['backup']>> | null = null;
    let shouldRestart = false;
    let fromVersion: string | null = null;
    let toVersion: string | null = null;
    let installationResult: RuntimeUpdateInstallationResult = 'NOT_ATTEMPTED';
    let restartResult: RuntimeUpdateRestartResult = 'NOT_REQUIRED';

    this.setProgress({
      stage: 'CHECKING',
      message: 'Checking DeepSeek Harness update.',
      fromVersion: null,
      toVersion: null,
      error: null,
      startedAt,
      finishedAt: null,
      installedVersion: null,
      restartStatus: 'NOT_REQUIRED',
      installationResult: 'NOT_ATTEMPTED',
      restartResult: 'NOT_REQUIRED',
      outcome: null,
      logs: [],
    });
    this.addLog('Checking the installed and latest DeepSeek Harness versions.');

    try {
      check = await this.updater.check();
      fromVersion = check.installedVersion;
      toVersion = check.latestVersion;
      this.setProgress({
        stage: 'CHECKING',
        message: check.error ?? 'DeepSeek Harness update checked.',
        fromVersion,
        toVersion,
        error: check.error,
      });
      if (check.error) throw new Error(check.error);
      if (!fromVersion || !toVersion) throw new Error('Installed and latest DeepSeek Harness versions are required.');
      if (!check.updateAvailable) throw new Error('DeepSeek Harness is already up to date.');

      if (!await this.requestConfirmation(check)) {
        this.addLog('Update cancelled by the user.', 'warning');
        return this.finish('CANCELLED', fromVersion, toVersion, 'Update cancelled by the user.', startedAt, fromVersion, 'NOT_REQUIRED', 'NOT_ATTEMPTED', 'NOT_REQUIRED', 'FAILED');
      }

      const runtimeStatus = this.runtime.getStatus();
      shouldRestart = runtimeStatus.status === 'RUNNING' || runtimeStatus.status === 'STARTING';
      if (shouldRestart) {
        this.setProgress({ stage: 'STOPPING_RUNTIME', message: 'Stopping DeepSeek Harness before installation.', fromVersion, toVersion, error: null });
        this.addLog('Stopping the runtime before changing installed files.');
        await this.runtime.stop();
      }

      this.setProgress({ stage: 'PREPARING', message: 'Preparing a rollback package for the current version.', fromVersion, toVersion, error: null });
      this.addLog('Creating a rollback archive for the current package.');
      backup = await this.updater.backup(fromVersion);

      this.setProgress({ stage: 'INSTALLING', message: 'Installing the latest DeepSeek Harness package. npm may take several minutes.', fromVersion, toVersion, error: null });
      this.addLog('Installing the selected package with npm.');
      await this.updater.update(toVersion);
      installationResult = 'INSTALL_SUCCEEDED';
      this.setProgress({ installationResult });
      this.addLog('Package installation completed.');

      this.setProgress({ stage: 'VERIFYING', message: 'Verifying the installed DeepSeek Harness version.', fromVersion, toVersion, error: null });
      const verified = await this.updater.verify(toVersion);
      this.addLog(`Verified installed version ${verified.version}.`);
      this.syncRuntimeVersion(verified.version);
      this.onVersionChanged?.(verified.version);

      if (shouldRestart) {
        this.setProgress({ stage: 'RESTARTING_RUNTIME', message: 'Starting DeepSeek Harness and waiting for process, port, and HTTP readiness.', fromVersion, toVersion, error: null, installedVersion: verified.version });
        const updateRestartTimeout = this.getUpdateRestartTimeout();
        this.addLog(`Restarting the runtime with the verified package. Timeout: ${updateRestartTimeout / 1000}s.`);
        try {
          await this.runtime.start({ timeoutMs: updateRestartTimeout, reason: 'update-restart' });
          restartResult = 'RESTART_SUCCEEDED';
        } catch (restartError) {
          const message = restartError instanceof Error ? restartError.message : String(restartError);
          this.addLog(`Package update succeeded, but runtime restart failed: ${message}`, 'error');
          return this.finish(
            'SUCCESS',
            fromVersion,
            toVersion,
            `Runtime restart failed after installation: ${message}`,
            startedAt,
            verified.version,
            'FAILED',
            'INSTALL_SUCCEEDED',
            'RESTART_FAILED',
            'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED',
          );
        }
      }

      this.addLog('DeepSeek Harness update completed successfully.');
      return this.finish('SUCCESS', fromVersion, toVersion, null, startedAt, verified.version, shouldRestart ? 'SUCCEEDED' : 'NOT_REQUIRED', installationResult, restartResult, 'SUCCEEDED');
    } catch (error) {
      const updateError = sanitizeMessage(error instanceof Error ? error.message : String(error));
      this.addLog(updateError, 'error');
      let rollbackError: string | null = null;
      let rollbackCompleted = false;
      let restartStatus: RuntimeUpdateProgress['restartStatus'] = shouldRestart ? 'FAILED' : 'NOT_REQUIRED';
      if (installationResult === 'NOT_ATTEMPTED' && backup) installationResult = 'INSTALL_FAILED';
      if (installationResult === 'NOT_ATTEMPTED' && this.progress.stage === 'INSTALLING') installationResult = 'INSTALL_FAILED';
      try {
        if (backup && fromVersion) {
          this.setProgress({ stage: 'ROLLING_BACK', message: 'Update failed; restoring the previous DeepSeek Harness package.', fromVersion, toVersion, error: updateError });
          this.addLog('Restoring the previous package from the rollback archive.', 'warning');
          await this.stopIfRunning();
          await this.updater.rollback(backup);
          this.setProgress({ stage: 'VERIFYING', message: 'Verifying the rollback version.', fromVersion, toVersion, error: updateError });
          await this.updater.verify(fromVersion);
          this.syncRuntimeVersion(fromVersion);
          this.onVersionChanged?.(fromVersion);
          this.addLog(`Rollback verified at version ${fromVersion}.`, 'warning');
          rollbackCompleted = true;
          restartStatus = shouldRestart ? 'SUCCEEDED' : 'NOT_REQUIRED';
          restartResult = shouldRestart ? 'RESTART_SUCCEEDED' : 'NOT_REQUIRED';
        }
        if (shouldRestart) {
          this.setProgress({ stage: 'RESTARTING_RUNTIME', message: 'Restarting DeepSeek Harness after rollback.', fromVersion, toVersion, error: updateError });
          await this.runtime.start({ timeoutMs: this.getUpdateRestartTimeout(), reason: 'update-restart' });
          restartResult = 'RESTART_SUCCEEDED';
        }
      } catch (rollbackFailure) {
        rollbackError = sanitizeMessage(rollbackFailure instanceof Error ? rollbackFailure.message : String(rollbackFailure));
        restartStatus = shouldRestart ? 'FAILED' : restartStatus;
        restartResult = shouldRestart ? 'RESTART_FAILED' : restartResult;
        this.addLog(`Recovery failed: ${rollbackError}`, 'error');
      }
      const finalError = rollbackError
        ? rollbackCompleted
          ? `${updateError} Rollback completed, but runtime recovery failed: ${rollbackError}`
          : `${updateError} Rollback failed: ${rollbackError}`
        : rollbackCompleted
          ? `${updateError} Rollback completed.`
          : updateError;
      return this.finish(rollbackCompleted ? 'ROLLED_BACK' : 'FAILED', fromVersion, toVersion, finalError, startedAt, rollbackCompleted ? fromVersion : null, restartStatus, installationResult, restartResult, 'FAILED');
    } finally {
      await this.updater.cleanup(backup).catch(() => undefined);
    }
  }

  private setProgress(next: Partial<RuntimeUpdateProgress>): void {
    const startedAt = next.startedAt ?? this.progress.startedAt;
    const updatedAt = new Date().toISOString();
    const elapsedMs = startedAt
      ? Math.max(0, Date.parse(next.finishedAt ?? updatedAt) - Date.parse(startedAt))
      : 0;
    this.progress = {
      ...this.progress,
      ...next,
      updatedAt,
      elapsedMs,
      logs: next.logs ? [...next.logs].slice(-MAX_UPDATE_LOGS) : this.progress.logs,
    };
    this.emitProgress();
  }

  private addLog(message: string, level: RuntimeUpdateLogEntry['level'] = 'info'): void {
    const entry: RuntimeUpdateLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizeMessage(message),
    };
    this.setProgress({ logs: [...this.progress.logs, entry] });
  }

  private emitProgress(): void {
    const snapshot = this.getProgress();
    this.onProgress?.(snapshot);
    for (const listener of this.listeners) listener(snapshot);
  }

  private finish(
    status: RuntimeUpdateHistoryStatus,
    fromVersion: string | null,
    toVersion: string | null,
    error: string | null,
    startedAt: string,
    installedVersion: string | null,
    restartStatus: RuntimeUpdateProgress['restartStatus'],
    installationResult: RuntimeUpdateInstallationResult,
    restartResult: RuntimeUpdateRestartResult,
    outcome: RuntimeUpdateOutcome,
  ): RuntimeUpdateResult {
    const finishedAt = new Date().toISOString();
    const message = status === 'SUCCESS'
      ? restartStatus === 'FAILED'
        ? 'Update installed successfully, but runtime restart failed.'
        : 'DeepSeek Harness update completed successfully.'
      : error ?? 'DeepSeek Harness update failed.';
    this.setProgress({
      stage: outcome,
      message,
      fromVersion,
      toVersion,
      error,
      startedAt,
      finishedAt,
      installedVersion,
      restartStatus,
      installationResult,
      restartResult,
      outcome,
    });
    const history: UpdateHistory = {
      id: randomUUID(),
      component: 'deepseek-harness',
      fromVersion,
      toVersion,
      status,
      timestamp: finishedAt,
      error,
      installationResult,
      restartResult,
      outcome,
    };
    if (this.persistHistory) this.persistHistory(history);
    else updateCoreSnapshot((database) => {
      database.updateHistory.push(history);
      if (database.updateHistory.length > 100) database.updateHistory.splice(0, database.updateHistory.length - 100);
    });
    return { status, history, progress: this.getProgress(), installedVersion, runtimeRestart: restartStatus, installationResult, restartResult, outcome };
  }

  private async stopIfRunning(): Promise<void> {
    const status = this.runtime.getStatus().status;
    if (status === 'RUNNING' || status === 'STARTING') await this.runtime.stop();
  }
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, 'https://[redacted]@');
}

function cloneProgress(progress: RuntimeUpdateProgress): RuntimeUpdateProgress {
  return { ...progress, logs: [...progress.logs] };
}

export function createInitialRuntimeUpdateProgress(): RuntimeUpdateProgress {
  return cloneProgress(INITIAL_PROGRESS);
}

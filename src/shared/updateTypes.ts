export type UpdateTarget = 'rookiedsh' | 'deepseek-harness';
export type CompatibilityStatus = 'compatible' | 'update-available' | 'unknown';
export type DeepSeekHarnessInstallationType = 'npm-global' | 'npx' | 'dsh-command' | 'unknown';

export type RuntimeUpdateStage =
  | 'IDLE'
  | 'CHECKING'
  | 'PREPARING'
  | 'STOPPING_RUNTIME'
  | 'INSTALLING'
  | 'VERIFYING'
  | 'ROLLING_BACK'
  | 'RESTARTING_RUNTIME'
  | 'SUCCEEDED'
  | 'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED'
  | 'FAILED';

export type RuntimeUpdateHistoryStatus = 'SUCCESS' | 'FAILED' | 'ROLLED_BACK' | 'CANCELLED';
export type RuntimeUpdateInstallationResult = 'NOT_ATTEMPTED' | 'INSTALL_SUCCEEDED' | 'INSTALL_FAILED';
export type RuntimeUpdateRestartResult = 'NOT_REQUIRED' | 'RESTART_SUCCEEDED' | 'RESTART_FAILED';
export type RuntimeUpdateOutcome = 'SUCCEEDED' | 'FAILED' | 'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED';

export interface DeepSeekHarnessInstallationInfo {
  type: DeepSeekHarnessInstallationType;
  packageName: string;
  executablePath: string | null;
  updateCommand: string;
}

export interface SoftwareVersion {
  id: string;
  target: UpdateTarget;
  currentVersion: string | null;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
  checkedAt: string | null;
  compatibility: CompatibilityStatus;
  error: string | null;
  installation?: DeepSeekHarnessInstallationInfo | null;
}

export interface UpdateCheck {
  id: string;
  target: UpdateTarget;
  currentVersion: string | null;
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
  checkedAt: string;
  compatibility: CompatibilityStatus;
  error: string | null;
  installation?: DeepSeekHarnessInstallationInfo | null;
}

export interface UpdateStatus {
  software: SoftwareVersion[];
  checks: UpdateCheck[];
}

export interface RuntimeUpdateCheck {
  installedVersion: string | null;
  latestVersion: string | null;
  installationType: DeepSeekHarnessInstallationType;
  updateAvailable: boolean;
  error: string | null;
  installation: DeepSeekHarnessInstallationInfo | null;
}

export interface RuntimeUpdateProgress {
  stage: RuntimeUpdateStage;
  message: string;
  fromVersion: string | null;
  toVersion: string | null;
  error: string | null;
  startedAt: string | null;
  updatedAt: string;
  finishedAt: string | null;
  elapsedMs: number;
  installedVersion: string | null;
  restartStatus: 'NOT_REQUIRED' | 'SUCCEEDED' | 'FAILED';
  installationResult: RuntimeUpdateInstallationResult;
  restartResult: RuntimeUpdateRestartResult;
  outcome: RuntimeUpdateOutcome | null;
  logs: RuntimeUpdateLogEntry[];
}

export interface RuntimeUpdateLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface RuntimeUpdateResult {
  status: RuntimeUpdateHistoryStatus;
  history: UpdateHistory;
  progress: RuntimeUpdateProgress;
  installedVersion: string | null;
  runtimeRestart: 'NOT_REQUIRED' | 'SUCCEEDED' | 'FAILED';
  installationResult: RuntimeUpdateInstallationResult;
  restartResult: RuntimeUpdateRestartResult;
  outcome: RuntimeUpdateOutcome;
}

export interface UpdateHistory {
  id: string;
  component: 'deepseek-harness';
  fromVersion: string | null;
  toVersion: string | null;
  status: RuntimeUpdateHistoryStatus;
  timestamp: string;
  error: string | null;
  installationResult: RuntimeUpdateInstallationResult;
  restartResult: RuntimeUpdateRestartResult;
  outcome: RuntimeUpdateOutcome;
}

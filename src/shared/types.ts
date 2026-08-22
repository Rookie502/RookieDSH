// Shared types between main, preload and renderer.

import type { Language, RookieDshConfig, UpdateConfig } from './configTypes';
import type { ModelEndpoint, ModelEndpointInput } from './modelTypes';
import type {
  DshCapabilitySet,
  DshCredentialStatus,
  DshProvider,
  DshProviderModelGroup,
  DshProviderSnapshot,
  RuntimeBindingInput,
  RuntimeModelBinding,
} from './runtimeBindingTypes';
import type { RuntimeInstance, RuntimeVersionInfo } from './runtimeRegistryTypes';
import type {
  RuntimeUpdateProgress,
  RuntimeUpdateResult,
  SoftwareVersion,
  UpdateHistory,
  UpdateStatus,
} from './updateTypes';
import type {
  CoreEvent,
  CoreOverview,
  Run,
  RunCreateInput,
  Task,
  TaskCreateInput,
  TaskStatus,
  TaskStatusUpdateInput,
  Workspace,
  WorkspaceBindingInput,
  WorkspaceCreateInput,
} from './coreTypes';

export type {
  DshCapabilitySet,
  DshCredentialStatus,
  DshProvider,
  DshProviderModelGroup,
  DshProviderSnapshot,
  RuntimeBindingInput,
  RuntimeModelBinding,
};

export type {
  CoreEvent,
  CoreOverview,
  Run,
  RunCreateInput,
  Task,
  TaskCreateInput,
  TaskStatus,
  TaskStatusUpdateInput,
  Workspace,
  WorkspaceBindingInput,
  WorkspaceCreateInput,
};
export type {
  ModelEndpoint,
  ModelEndpointInput,
  RuntimeInstance,
  RuntimeVersionInfo,
  RuntimeUpdateProgress,
  RuntimeUpdateResult,
  SoftwareVersion,
  UpdateConfig,
  UpdateHistory,
  UpdateStatus,
};

export type RuntimeStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAILED';
export type RuntimeReadiness = 'NOT_STARTED' | 'PROCESS_RUNNING' | 'PORT_READY' | 'WEB_READY' | 'PAGE_READY';

export interface RuntimeInfo {
  status: RuntimeStatus;
  readiness: RuntimeReadiness;
  pid: number | null;
  url: string | null;
  error: string | null;
  startedAt: string | null;
}

export type RuntimeLogStream = 'stdout' | 'stderr' | 'system';

export interface RuntimeLogEntry {
  timestamp: string;
  stream: RuntimeLogStream;
  message: string;
}

export interface RuntimeDiagnosticEvent {
  timestamp: string;
  status: RuntimeStatus;
  message: string;
}

export interface RuntimeDiagnostics {
  lastStartTime: string | null;
  lastStopTime: string | null;
  lastError: string | null;
  /** Startup attempt duration in milliseconds. */
  startupDuration: number | null;
  restartCount: number;
  lastStatus: RuntimeStatus;
  lastStatusChangedAt: string | null;
  recentEvents: RuntimeDiagnosticEvent[];
}

export type ShellPage = 'harness' | 'runtime';

export interface FloatingPosition {
  right: number;
  bottom: number;
}

export type ControlCenterState = 'OPEN' | 'CLOSED';

/** Backwards-compatible name for code that still refers to the old state type. */
export type DshRuntimeState = RuntimeInfo;

export interface RookieDshApi {
  readonly appVersion: string;
  config: {
    get(): Promise<RookieDshConfig>;
    setLanguage(language: Language): Promise<Language>;
    setUpdatePreferences(config: UpdateConfig): Promise<UpdateConfig>;
  };
  runtime: {
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Promise<RuntimeInfo>;
    getLogs(): Promise<RuntimeLogEntry[]>;
    getDiagnostics(): Promise<RuntimeDiagnostics>;
    getCapabilities(): Promise<DshCapabilitySet>;
    onStatusChanged(listener: (info: RuntimeInfo) => void): () => void;
  };
  core: {
    getOverview(): Promise<CoreOverview>;
    workspaces: {
      create(input: WorkspaceCreateInput): Promise<Workspace>;
      list(): Promise<Workspace[]>;
      get(id: string): Promise<Workspace | null>;
      deleteMetadata(id: string): Promise<boolean>;
      bind(id: string, input: WorkspaceBindingInput): Promise<Workspace>;
    };
    tasks: {
      create(input: TaskCreateInput): Promise<Task>;
      list(workspaceId?: string): Promise<Task[]>;
      get(id: string): Promise<Task | null>;
      updateStatus(id: string, input: TaskStatusUpdateInput): Promise<Task>;
    };
    runs: {
      create(input: RunCreateInput): Promise<Run>;
      list(taskId?: string): Promise<Run[]>;
      get(id: string): Promise<Run | null>;
    };
    events: {
      list(limit?: number): Promise<CoreEvent[]>;
    };
  };
  models: {
    list(): Promise<ModelEndpoint[]>;
    add(input: ModelEndpointInput): Promise<ModelEndpoint>;
    remove(id: string): Promise<boolean>;
    check(id: string): Promise<ModelEndpoint>;
    discover(id: string): Promise<ModelEndpoint>;
  };
  runtimeProviders: {
    list(force?: boolean): Promise<DshProviderSnapshot>;
    refresh(): Promise<DshProviderSnapshot>;
    getModels(provider?: string): Promise<DshProviderModelGroup[]>;
    discover(input: { settingsNs: string; provider?: string; baseURL?: string; api?: string }): Promise<Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }>>;
    getCredentialStatus(refs: string[]): Promise<Record<string, DshCredentialStatus>>;
    import(providerId: string): Promise<ModelEndpoint>;
    bind(input: RuntimeBindingInput): Promise<RuntimeModelBinding>;
    unbind(bindingId: string): Promise<boolean>;
    setCredential(ref: string, value: string): Promise<DshCredentialStatus>;
  };
  runtimes: {
    list(): Promise<RuntimeInstance[]>;
    checkVersion(): Promise<RuntimeVersionInfo>;
  };
  updates: {
    getStatus(): Promise<UpdateStatus>;
    check(): Promise<UpdateStatus>;
    updateRuntime(): Promise<RuntimeUpdateResult>;
    getHistory(): Promise<UpdateHistory[]>;
    getProgress(): Promise<RuntimeUpdateProgress>;
    onProgressChanged(listener: (progress: RuntimeUpdateProgress) => void): () => void;
  };
  shell: {
    setPage(page: ShellPage): void;
    getFloatingPosition(): Promise<FloatingPosition>;
    setFloatingPosition(position: FloatingPosition): void;
    beginFloatingDrag(): void;
    endFloatingDrag(): void;
    toggleControlCenter(): void;
    getControlCenterState(): Promise<ControlCenterState>;
    setControlCenterWidth(width: number): void;
    saveControlCenterWidth(width: number): Promise<number>;
    onControlCenterStateChanged(listener: (state: ControlCenterState) => void): () => void;
  };
}

declare global {
  interface Window {
    rookiedsh?: RookieDshApi;
  }
}

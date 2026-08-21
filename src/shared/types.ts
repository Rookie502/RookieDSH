// Shared types between main, preload and renderer.

import type { Language, RookieDshConfig } from './configTypes';
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
  WorkspaceCreateInput,
} from './coreTypes';

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
  WorkspaceCreateInput,
};

export type RuntimeStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAILED';

export interface RuntimeInfo {
  status: RuntimeStatus;
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
  };
  runtime: {
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Promise<RuntimeInfo>;
    getLogs(): Promise<RuntimeLogEntry[]>;
    getDiagnostics(): Promise<RuntimeDiagnostics>;
    onStatusChanged(listener: (info: RuntimeInfo) => void): () => void;
  };
  core: {
    getOverview(): Promise<CoreOverview>;
    workspaces: {
      create(input: WorkspaceCreateInput): Promise<Workspace>;
      list(): Promise<Workspace[]>;
      get(id: string): Promise<Workspace | null>;
      deleteMetadata(id: string): Promise<boolean>;
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

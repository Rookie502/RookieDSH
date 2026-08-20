// Shared types between main, preload and renderer.

import type { RookieDshConfig } from './configTypes';

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

export type ShellPage = 'harness' | 'runtime';

export interface FloatingPosition {
  right: number;
  bottom: number;
}

/** Backwards-compatible name for code that still refers to the old state type. */
export type DshRuntimeState = RuntimeInfo;

export interface RookieDshApi {
  readonly appVersion: string;
  config: {
    get(): Promise<RookieDshConfig>;
  };
  runtime: {
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Promise<RuntimeInfo>;
    getLogs(): Promise<RuntimeLogEntry[]>;
    onStatusChanged(listener: (info: RuntimeInfo) => void): () => void;
  };
  shell: {
    setPage(page: ShellPage): void;
    getFloatingPosition(): Promise<FloatingPosition>;
    setFloatingPosition(position: FloatingPosition): void;
    beginFloatingDrag(): void;
    endFloatingDrag(): void;
    setFloatingPanelOpen(open: boolean): void;
  };
}

declare global {
  interface Window {
    rookiedsh?: RookieDshApi;
  }
}

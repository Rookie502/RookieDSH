/** Configuration shared across the Electron main process and the preload API. */
export interface RuntimeConfig {
  /** Preferred executable name. Windows resolution also checks dsh.cmd/dsh.ps1. */
  command: string;
  /** Executable used when the preferred command cannot be found. */
  fallbackCommand: string;
  port: number;
  autoStart: boolean;
  startupTimeout: number;
  shutdownTimeout: number;
  maxLogEntries: number;
  maxLogMessageLength: number;
}

export interface WindowConfig {
  width: number;
  height: number;
}

export interface FloatingConfig {
  panelWidth: number;
}

export interface HarnessConfig {
  url: string;
}

export interface RookieDshConfig {
  runtime: RuntimeConfig;
  window: WindowConfig;
  floating: FloatingConfig;
  harness: HarnessConfig;
}

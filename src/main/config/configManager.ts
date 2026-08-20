import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RookieDshConfig } from '@shared/configTypes';

const CONFIG_FILE_NAME = 'config.json';

export const DEFAULT_CONFIG: RookieDshConfig = {
  runtime: {
    command: 'dsh',
    fallbackCommand: 'npx',
    port: 3080,
    autoStart: true,
    startupTimeout: 15_000,
    shutdownTimeout: 5_000,
    maxLogEntries: 300,
    maxLogMessageLength: 8_000,
  },
  window: {
    width: 1_200,
    height: 800,
  },
  floating: {
    panelWidth: 280,
  },
  harness: {
    url: 'http://localhost:3080',
  },
};

let cachedConfig: RookieDshConfig | null = null;

function cloneConfig(config: RookieDshConfig): RookieDshConfig {
  return {
    runtime: { ...config.runtime },
    window: { ...config.window },
    floating: { ...config.floating },
    harness: { ...config.harness },
  };
}

function configPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

function writeConfig(config: RookieDshConfig): void {
  const filePath = configPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function integerValue(value: unknown, fallback: number, minimum: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum ? value : fallback;
}

function urlValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : fallback;
  } catch {
    return fallback;
  }
}

function normalizeConfig(value: unknown): RookieDshConfig {
  const root = isRecord(value) ? value : {};
  const runtime = isRecord(root.runtime) ? root.runtime : {};
  const window = isRecord(root.window) ? root.window : {};
  const floating = isRecord(root.floating) ? root.floating : {};
  const harness = isRecord(root.harness) ? root.harness : {};

  return {
    runtime: {
      command: stringValue(runtime.command, DEFAULT_CONFIG.runtime.command),
      fallbackCommand: stringValue(runtime.fallbackCommand, DEFAULT_CONFIG.runtime.fallbackCommand),
      port: integerValue(runtime.port, DEFAULT_CONFIG.runtime.port, 1),
      autoStart: typeof runtime.autoStart === 'boolean' ? runtime.autoStart : DEFAULT_CONFIG.runtime.autoStart,
      startupTimeout: integerValue(runtime.startupTimeout, DEFAULT_CONFIG.runtime.startupTimeout, 1_000),
      shutdownTimeout: integerValue(runtime.shutdownTimeout, DEFAULT_CONFIG.runtime.shutdownTimeout, 1_000),
      maxLogEntries: integerValue(runtime.maxLogEntries, DEFAULT_CONFIG.runtime.maxLogEntries, 1),
      maxLogMessageLength: integerValue(runtime.maxLogMessageLength, DEFAULT_CONFIG.runtime.maxLogMessageLength, 100),
    },
    window: {
      width: integerValue(window.width, DEFAULT_CONFIG.window.width, 640),
      height: integerValue(window.height, DEFAULT_CONFIG.window.height, 480),
    },
    floating: {
      panelWidth: integerValue(floating.panelWidth, DEFAULT_CONFIG.floating.panelWidth, 200),
    },
    harness: {
      url: urlValue(harness.url, DEFAULT_CONFIG.harness.url),
    },
  };
}

/** Return the cached configuration, creating or repairing config.json as needed. */
export function getConfig(): RookieDshConfig {
  if (cachedConfig) return cloneConfig(cachedConfig);

  const filePath = configPath();
  if (!existsSync(filePath)) {
    cachedConfig = cloneConfig(DEFAULT_CONFIG);
    writeConfig(cachedConfig);
    return cloneConfig(cachedConfig);
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    cachedConfig = normalizeConfig(parsed);
    writeConfig(cachedConfig);
  } catch (error) {
    console.warn(`RookieDSH: invalid configuration, restoring defaults (${String(error)}).`);
    cachedConfig = cloneConfig(DEFAULT_CONFIG);
    writeConfig(cachedConfig);
  }

  return cloneConfig(cachedConfig);
}

/** Persist a future configuration update while keeping the same validation rules. */
export function saveConfig(config: RookieDshConfig): RookieDshConfig {
  cachedConfig = normalizeConfig(config);
  writeConfig(cachedConfig);
  return cloneConfig(cachedConfig);
}

export function getConfigFilePath(): string {
  return configPath();
}

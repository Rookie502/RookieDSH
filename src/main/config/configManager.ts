import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CONTROL_CENTER_WIDTH_DEFAULT,
  CONTROL_CENTER_WIDTH_MAX,
  CONTROL_CENTER_WIDTH_MIN,
  type Language,
  type RookieDshConfig,
  type UpdateCheckFrequency,
} from '@shared/configTypes';

const CONFIG_FILE_NAME = 'config.json';
const LEGACY_DEFAULT_STARTUP_TIMEOUT = 15_000;

export const DEFAULT_CONFIG: RookieDshConfig = {
  language: 'en-US',
  runtime: {
    command: 'dsh',
    fallbackCommand: 'npx',
    port: 3080,
    autoStart: true,
    startTimeout: 45_000,
    startupTimeout: 45_000,
    updateRestartTimeout: 120_000,
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
  controlCenter: {
    width: CONTROL_CENTER_WIDTH_DEFAULT,
  },
  harness: {
    url: 'http://localhost:3080',
  },
  updates: {
    autoCheck: true,
    checkFrequency: 'daily',
  },
};

let cachedConfig: RookieDshConfig | null = null;

function cloneConfig(config: RookieDshConfig): RookieDshConfig {
  return {
    language: config.language,
    runtime: { ...config.runtime },
    window: { ...config.window },
    floating: { ...config.floating },
    controlCenter: { ...config.controlCenter },
    harness: { ...config.harness },
    updates: { ...config.updates },
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

export function getSystemLanguage(): Language {
  try {
    return app.getLocale().toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
  } catch {
    return 'en-US';
  }
}

function languageValue(value: unknown, fallback: Language): Language {
  return value === 'zh-CN' || value === 'en-US' ? value : fallback;
}

function updateFrequencyValue(value: unknown, fallback: UpdateCheckFrequency): UpdateCheckFrequency {
  return value === 'daily' || value === 'weekly' || value === 'manual' ? value : fallback;
}

function integerValue(value: unknown, fallback: number, minimum: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum ? value : fallback;
}

function boundedIntegerValue(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum
    ? value
    : fallback;
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
  const controlCenter = isRecord(root.controlCenter) ? root.controlCenter : {};
  const harness = isRecord(root.harness) ? root.harness : {};
  const updates = isRecord(root.updates) ? root.updates : {};
  const defaultLanguage = getSystemLanguage();
  const legacyOrCurrentStartTimeout = runtime.startTimeout ?? runtime.startupTimeout;
  const startTimeoutValue = runtime.startTimeout === undefined
    && legacyOrCurrentStartTimeout === LEGACY_DEFAULT_STARTUP_TIMEOUT
    ? DEFAULT_CONFIG.runtime.startTimeout
    : legacyOrCurrentStartTimeout;

  return {
    language: languageValue(root.language, defaultLanguage),
    runtime: {
      command: stringValue(runtime.command, DEFAULT_CONFIG.runtime.command),
      fallbackCommand: stringValue(runtime.fallbackCommand, DEFAULT_CONFIG.runtime.fallbackCommand),
      port: integerValue(runtime.port, DEFAULT_CONFIG.runtime.port, 1),
      autoStart: typeof runtime.autoStart === 'boolean' ? runtime.autoStart : DEFAULT_CONFIG.runtime.autoStart,
      startTimeout: integerValue(
        startTimeoutValue,
        DEFAULT_CONFIG.runtime.startTimeout,
        1_000,
      ),
      startupTimeout: integerValue(
        startTimeoutValue,
        DEFAULT_CONFIG.runtime.startupTimeout,
        1_000,
      ),
      updateRestartTimeout: integerValue(runtime.updateRestartTimeout, DEFAULT_CONFIG.runtime.updateRestartTimeout, 1_000),
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
    controlCenter: {
      width: boundedIntegerValue(
        controlCenter.width,
        CONTROL_CENTER_WIDTH_DEFAULT,
        CONTROL_CENTER_WIDTH_MIN,
        CONTROL_CENTER_WIDTH_MAX,
      ),
    },
    harness: {
      url: urlValue(harness.url, DEFAULT_CONFIG.harness.url),
    },
    updates: {
      autoCheck: typeof updates.autoCheck === 'boolean' ? updates.autoCheck : DEFAULT_CONFIG.updates.autoCheck,
      checkFrequency: updateFrequencyValue(updates.checkFrequency, DEFAULT_CONFIG.updates.checkFrequency),
    },
  };
}

/** Return the cached configuration, creating or repairing config.json as needed. */
export function getConfig(): RookieDshConfig {
  if (cachedConfig) return cloneConfig(cachedConfig);

  const filePath = configPath();
  if (!existsSync(filePath)) {
    cachedConfig = cloneConfig({ ...DEFAULT_CONFIG, language: getSystemLanguage() });
    writeConfig(cachedConfig);
    return cloneConfig(cachedConfig);
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    cachedConfig = normalizeConfig(parsed);
    writeConfig(cachedConfig);
  } catch (error) {
    console.warn(`RookieDSH: invalid configuration, restoring defaults (${String(error)}).`);
    cachedConfig = cloneConfig({ ...DEFAULT_CONFIG, language: getSystemLanguage() });
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

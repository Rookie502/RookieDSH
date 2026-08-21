import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  RuntimeDiagnosticEvent,
  RuntimeDiagnostics,
  RuntimeInfo,
  RuntimeStatus,
} from '@shared/types';

const DIAGNOSTICS_FILE_NAME = 'diagnostics.json';
const MAX_EVENTS = 100;

const DEFAULT_DIAGNOSTICS: RuntimeDiagnostics = {
  lastStartTime: null,
  lastStopTime: null,
  lastError: null,
  startupDuration: null,
  restartCount: 0,
  lastStatus: 'STOPPED',
  lastStatusChangedAt: null,
  recentEvents: [],
};

let cachedDiagnostics: RuntimeDiagnostics | null = null;

function cloneDiagnostics(diagnostics: RuntimeDiagnostics): RuntimeDiagnostics {
  return {
    ...diagnostics,
    recentEvents: diagnostics.recentEvents.map((event) => ({ ...event })),
  };
}

function diagnosticsPath(): string {
  return path.join(app.getPath('userData'), DIAGNOSTICS_FILE_NAME);
}

function writeDiagnostics(diagnostics: RuntimeDiagnostics): void {
  const filePath = diagnosticsPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validStatus(value: unknown): value is RuntimeStatus {
  return value === 'STOPPED'
    || value === 'STARTING'
    || value === 'RUNNING'
    || value === 'STOPPING'
    || value === 'FAILED';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeDiagnostics(value: unknown): RuntimeDiagnostics {
  const source = isRecord(value) ? value : {};
  const rawEvents = Array.isArray(source.recentEvents) ? source.recentEvents : [];
  const recentEvents: RuntimeDiagnosticEvent[] = rawEvents
    .filter(isRecord)
    .filter((event) => validStatus(event.status) && typeof event.timestamp === 'string' && typeof event.message === 'string')
    .slice(-MAX_EVENTS)
    .map((event) => ({
      timestamp: event.timestamp as string,
      status: event.status as RuntimeStatus,
      message: event.message as string,
    }));

  return {
    lastStartTime: nullableString(source.lastStartTime),
    lastStopTime: nullableString(source.lastStopTime),
    lastError: nullableString(source.lastError),
    startupDuration: typeof source.startupDuration === 'number' && source.startupDuration >= 0
      ? source.startupDuration
      : null,
    restartCount: typeof source.restartCount === 'number' && Number.isInteger(source.restartCount) && source.restartCount >= 0
      ? source.restartCount
      : 0,
    lastStatus: validStatus(source.lastStatus) ? source.lastStatus : 'STOPPED',
    lastStatusChangedAt: nullableString(source.lastStatusChangedAt),
    recentEvents,
  };
}

function loadDiagnostics(): RuntimeDiagnostics {
  if (cachedDiagnostics) return cachedDiagnostics;

  const filePath = diagnosticsPath();
  if (!existsSync(filePath)) {
    cachedDiagnostics = cloneDiagnostics(DEFAULT_DIAGNOSTICS);
    writeDiagnostics(cachedDiagnostics);
    return cachedDiagnostics;
  }

  try {
    cachedDiagnostics = normalizeDiagnostics(JSON.parse(readFileSync(filePath, 'utf8')) as unknown);
    writeDiagnostics(cachedDiagnostics);
  } catch (error) {
    console.warn(`RookieDSH: invalid diagnostics, restoring defaults (${String(error)}).`);
    cachedDiagnostics = cloneDiagnostics(DEFAULT_DIAGNOSTICS);
    writeDiagnostics(cachedDiagnostics);
  }

  return cachedDiagnostics;
}

function statusMessage(info: RuntimeInfo): string {
  if (info.status === 'FAILED') return info.error ?? 'Runtime failed.';
  if (info.status === 'RUNNING') return 'Runtime is running.';
  if (info.status === 'STARTING') return 'Runtime startup started.';
  if (info.status === 'STOPPING') return 'Runtime shutdown started.';
  return 'Runtime stopped.';
}

/** Return persisted diagnostics for the previous and current application runs. */
export function getDiagnostics(): RuntimeDiagnostics {
  return cloneDiagnostics(loadDiagnostics());
}

/** Persist meaningful Runtime state transitions without storing unbounded history. */
export function recordRuntimeStatus(info: RuntimeInfo): void {
  const diagnostics = loadDiagnostics();
  const errorChanged = info.status === 'FAILED' && info.error !== diagnostics.lastError;
  if (info.status === diagnostics.lastStatus && !errorChanged) return;

  const timestamp = new Date().toISOString();
  const event: RuntimeDiagnosticEvent = {
    timestamp,
    status: info.status,
    message: statusMessage(info),
  };
  const next: RuntimeDiagnostics = {
    ...diagnostics,
    lastStatus: info.status,
    lastStatusChangedAt: timestamp,
    recentEvents: [...diagnostics.recentEvents, event].slice(-MAX_EVENTS),
  };

  if (info.status === 'STARTING') {
    next.restartCount = diagnostics.lastStartTime ? diagnostics.restartCount + 1 : diagnostics.restartCount;
    next.lastStartTime = timestamp;
    next.startupDuration = null;
  } else if (info.status === 'RUNNING' || info.status === 'FAILED') {
    if (diagnostics.lastStartTime) {
      next.startupDuration = Math.max(0, Date.parse(timestamp) - Date.parse(diagnostics.lastStartTime));
    }
    if (info.status === 'FAILED') next.lastError = info.error ?? 'Runtime failed.';
  } else if (info.status === 'STOPPED') {
    next.lastStopTime = timestamp;
  }

  cachedDiagnostics = next;
  writeDiagnostics(next);
}

export function getDiagnosticsFilePath(): string {
  return diagnosticsPath();
}

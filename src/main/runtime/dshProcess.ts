import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import { getConfig } from '../config/configManager';
import {
  INITIAL_RUNTIME_INFO,
  type RuntimeInfo,
  type RuntimeLaunchSpec,
  type RuntimeLogEntry,
  type RuntimeLogStream,
  type RuntimeStatusListener,
} from './RuntimeTypes';
import {
  detectDeepSeekHarness,
  isDeepSeekHarnessCommand,
  resolveDeepSeekHarnessLaunchSpec,
} from './DeepSeekHarness';

const POLL_INTERVAL_MS = 250;
const LOG_NOTIFY_DEBOUNCE_MS = 100;
const INITIAL_INFO = INITIAL_RUNTIME_INFO;

let child: ChildProcess | null = null;
let info: RuntimeInfo = { ...INITIAL_INFO };
let startPromise: Promise<void> | null = null;
let stopPromise: Promise<void> | null = null;
let stopRequested = false;
const logs: RuntimeLogEntry[] = [];
const listeners = new Set<RuntimeStatusListener>();
let logNotifyTimer: NodeJS.Timeout | null = null;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function notifyStatusChanged(): void {
  const snapshot = getDshState();
  for (const listener of listeners) listener(snapshot);
}

function setInfo(patch: Partial<RuntimeInfo>): void {
  info = { ...info, ...patch };
  notifyStatusChanged();
}

function scheduleLogNotification(): void {
  if (logNotifyTimer) return;
  logNotifyTimer = setTimeout(() => {
    logNotifyTimer = null;
    notifyStatusChanged();
  }, LOG_NOTIFY_DEBOUNCE_MS);
}

function appendLog(stream: RuntimeLogStream, message: string): void {
  const { maxLogEntries, maxLogMessageLength } = getConfig().runtime;
  const raw = message.trim();
  const trimmed = raw.length > maxLogMessageLength
    ? `${raw.slice(0, maxLogMessageLength)}…`
    : raw;
  if (!trimmed) return;

  logs.push({
    timestamp: new Date().toISOString(),
    stream,
    message: trimmed,
  });

  if (logs.length > maxLogEntries) logs.splice(0, logs.length - maxLogEntries);

  if (stream === 'stderr' && (info.status === 'STARTING' || info.status === 'RUNNING')) {
    info = { ...info, error: trimmed };
  }

  // Batch noisy stdout/stderr bursts into at most one renderer notification per window.
  scheduleLogNotification();
}

interface PortOwner {
  pid: number;
  commandLine: string;
}

function getRuntimePortOwner(port: number): PortOwner | null {
  if (process.platform !== 'win32') return null;

  try {
    const raw = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$connection = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($connection) { $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"; [PSCustomObject]@{ pid = $connection.OwningProcess; commandLine = $owner.CommandLine } | ConvertTo-Json -Compress }`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { pid?: number; commandLine?: string };
    if (typeof parsed.pid !== 'number' || !Number.isInteger(parsed.pid) || typeof parsed.commandLine !== 'string') return null;
    return { pid: parsed.pid, commandLine: parsed.commandLine };
  } catch {
    return null;
  }
}

function probeRuntime(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: 750 }, (response) => {
      response.resume();
      resolve(response.statusCode != null);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPortFree(url: string, port: number, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await probeRuntime(url))) return;
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Runtime port ${port} is still occupied`);
}

async function clearOrphanedHarness(config: ReturnType<typeof getConfig>): Promise<void> {
  const { port, shutdownTimeout } = config.runtime;
  const { url } = config.harness;
  if (!(await probeRuntime(url))) return;

  const owner = getRuntimePortOwner(port);
  if (!owner) {
    throw new Error(`Runtime port ${port} is already in use`);
  }
  if (!isDeepSeekHarnessCommand(owner.commandLine)) {
    throw new Error(`Runtime port ${port} is already in use by PID ${owner.pid}`);
  }

  appendLog('system', `Stopping orphaned DeepSeek Harness process ${owner.pid}.`);
  try {
    execFileSync('taskkill.exe', ['/pid', String(owner.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // The orphan may have exited between detection and cleanup.
  }
  await waitForPortFree(url, port, shutdownTimeout);
}

function terminateProcess(proc: ChildProcess): void {
  if (process.platform === 'win32' && proc.pid != null) {
    try {
      // Wait for the process tree kill to complete. An asynchronous taskkill
      // can outlive Electron during startup failure and leave node dsh alive.
      execFileSync('taskkill.exe', ['/pid', String(proc.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // Fall through to the direct kill below.
    }
  }

  try {
    proc.kill();
  } catch {
    // The process may already have exited.
  }
}

async function waitForReady(proc: ChildProcess, config: ReturnType<typeof getConfig>): Promise<void> {
  const deadline = Date.now() + config.runtime.startupTimeout;
  let processError: Error | null = null;
  let processExited = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;

  const onError = (error: Error) => {
    processError = error;
  };
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    processExited = true;
    exitCode = code;
    exitSignal = signal;
  };

  proc.once('error', onError);
  proc.once('exit', onExit);

  try {
    while (Date.now() < deadline) {
      if (processError) throw processError;
      if (processExited) {
        throw new Error(`Harness process exited before becoming ready (code=${exitCode ?? 'none'}, signal=${exitSignal ?? 'none'})`);
      }
      if (await probeRuntime(config.harness.url)) {
        await delay(100);
        if (processError) throw processError;
        if (processExited) {
          throw new Error(`Harness process exited after becoming ready (code=${exitCode ?? 'none'}, signal=${exitSignal ?? 'none'})`);
        }
        if (await probeRuntime(config.harness.url)) return;
      }
      await delay(POLL_INTERVAL_MS);
    }

    throw new Error(`Harness start timed out after ${config.runtime.startupTimeout / 1000}s`);
  } finally {
    proc.removeListener('error', onError);
    proc.removeListener('exit', onExit);
  }
}

function attachProcessListeners(proc: ChildProcess): void {
  proc.stdout?.on('data', (chunk: Buffer | string) => appendLog('stdout', String(chunk)));
  proc.stderr?.on('data', (chunk: Buffer | string) => appendLog('stderr', String(chunk)));

  proc.on('error', (error) => {
    appendLog('system', `Harness process error: ${error.message}`);
    if (child === proc) child = null;

    if (info.status === 'STOPPING' || stopRequested) {
      setInfo({ ...INITIAL_INFO });
      stopRequested = false;
    } else if (info.status === 'STARTING' || info.status === 'RUNNING') {
      setInfo({ status: 'FAILED', pid: null, url: null, error: error.message });
    }
  });

  proc.on('exit', (code, signal) => {
    if (child === proc) child = null;

    if (info.status === 'STOPPING' || stopRequested) {
      appendLog('system', 'Harness process stopped.');
      stopRequested = false;
      setInfo({ ...INITIAL_INFO });
      return;
    }

    if (info.status === 'STARTING' || info.status === 'RUNNING') {
      const message = `Harness process exited unexpectedly (code=${code ?? 'none'}, signal=${signal ?? 'none'})`;
      appendLog('system', message);
      setInfo({ status: 'FAILED', pid: null, url: null, error: message });
    }
  });
}

/** Detect whether a native DeepSeek Harness CLI is installed. */
export function detectDsh(): boolean {
  return detectDeepSeekHarness(getConfig());
}

/** Subscribe to Runtime state and log changes. Returns an unsubscribe function. */
export function onDshStatusChanged(listener: RuntimeStatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Start the Harness web server. Resolves when the health endpoint is reachable. */
export function startDsh(): Promise<void> {
  if (startPromise) return startPromise;
  if (info.status === 'STOPPING') return Promise.reject(new Error('Harness is stopping'));
  if (child || info.status === 'RUNNING') return Promise.resolve();

  stopRequested = false;
  startPromise = startDshInternal().finally(() => {
    startPromise = null;
  });
  return startPromise;
}

async function startDshInternal(): Promise<void> {
  setInfo({ ...INITIAL_INFO, status: 'STARTING' });

  const config = getConfig();
  let spec: RuntimeLaunchSpec;
  try {
    spec = resolveDeepSeekHarnessLaunchSpec(config);
    appendLog('system', `Starting Harness with ${spec.label}.`);
    await clearOrphanedHarness(config);
    const proc = spawn(spec.command, spec.args, {
      shell: spec.shell,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child = proc;
    attachProcessListeners(proc);

    await waitForReady(proc, config);

    if (child !== proc || info.status !== 'STARTING') {
      throw new Error('Harness start was cancelled');
    }

    setInfo({
      status: 'RUNNING',
      pid: proc.pid ?? null,
      url: config.harness.url,
      error: null,
      startedAt: new Date().toISOString(),
    });
    appendLog('system', `Harness is running at ${config.harness.url}.`);
  } catch (error) {
    const message = toErrorMessage(error);
    if (info.status === 'STARTING') {
      if (child) {
        terminateProcess(child);
        child = null;
      }
      setInfo({ status: 'FAILED', pid: null, url: null, error: message });
      appendLog('system', `Harness failed to start: ${message}`);
    }
    throw error instanceof Error ? error : new Error(message);
  }
}

/** Stop the Harness web server and wait for the child process to exit. */
export function stopDsh(): Promise<void> {
  if (stopPromise) return stopPromise;

  const proc = child;
  if (!proc) {
    if (info.status !== 'STOPPED') setInfo({ ...INITIAL_INFO });
    return Promise.resolve();
  }

  stopRequested = true;
  const shutdownTimeout = getConfig().runtime.shutdownTimeout;
  setInfo({ status: 'STOPPING', error: null });
  appendLog('system', 'Stopping Harness.');

  stopPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.removeListener('exit', finish);
      proc.removeListener('error', finish);
      resolve();
    };
    const timer = setTimeout(() => {
      if (child === proc) {
        terminateProcess(proc);
        child = null;
        stopRequested = false;
        const message = `Harness did not stop within ${shutdownTimeout / 1000}s`;
        appendLog('system', message);
        setInfo({ status: 'FAILED', pid: null, url: null, error: message });
      }
      finish();
    }, shutdownTimeout);

    proc.once('exit', finish);
    proc.once('error', finish);
    terminateProcess(proc);
  }).finally(() => {
    stopPromise = null;
  });

  return stopPromise;
}

/** Best-effort synchronous fallback for abrupt Electron process termination. */
export function cleanupDshSync(): void {
  if (logNotifyTimer) clearTimeout(logNotifyTimer);
  logNotifyTimer = null;

  const proc = child;
  if (!proc) return;

  child = null;
  stopRequested = false;
  if (process.platform === 'win32' && proc.pid != null) {
    try {
      execFileSync('taskkill.exe', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore' });
    } catch {
      // The process may already have exited.
    }
  }
  try {
    proc.kill();
  } catch {
    // The process may already have exited.
  }
}

/** Return the current Runtime information. */
export function getDshState(): RuntimeInfo {
  return { ...info };
}

/** Return the bounded recent Runtime log buffer. */
export function getDshLogs(): RuntimeLogEntry[] {
  return logs.map((entry) => ({ ...entry }));
}

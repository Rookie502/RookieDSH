import { useEffect, useState } from 'react';
import type { RookieDshConfig } from '@shared/configTypes';
import type { RuntimeInfo, RuntimeLogEntry } from '@shared/types';

const INITIAL_INFO: RuntimeInfo = {
  status: 'STOPPED',
  pid: null,
  url: null,
  error: null,
  startedAt: null,
};

/** Archived page kept as a compatibility fallback. Control Center is the active UI. */
export default function Runtime() {
  const [info, setInfo] = useState<RuntimeInfo>(INITIAL_INFO);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);
  const [config, setConfig] = useState<RookieDshConfig | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const runtime = window.rookiedsh?.runtime;
    if (!runtime) return;

    let disposed = false;
    const load = async () => {
      try {
        const [nextInfo, nextLogs] = await Promise.all([runtime.getStatus(), runtime.getLogs()]);
        if (!disposed) {
          setInfo(nextInfo);
          setLogs(nextLogs);
        }
      } catch (error) {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      }
    };

    const unsubscribe = runtime.onStatusChanged((nextInfo) => {
      setInfo(nextInfo);
      void runtime.getLogs().then((nextLogs) => {
        if (!disposed) setLogs(nextLogs);
      }).catch((error: unknown) => {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      });
    });

    void load();
    void window.rookiedsh?.config.get().then(setConfig).catch(() => undefined);
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (info.status !== 'RUNNING') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [info.status]);

  async function handleStop() {
    const runtime = window.rookiedsh?.runtime;
    if (!runtime) return;
    setActionError(null);
    try {
      await runtime.stop();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRestart() {
    const runtime = window.rookiedsh?.runtime;
    if (!runtime) return;
    setActionError(null);
    try {
      await runtime.stop();
      await runtime.start();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  const canRestart = info.status !== 'STARTING' && info.status !== 'STOPPING';
  const canStop = info.status === 'STARTING' || info.status === 'RUNNING';
  const latestError = info.error ?? actionError;
  const uptime = info.startedAt && info.status === 'RUNNING'
    ? formatUptime(now - Date.parse(info.startedAt))
    : '—';

  return (
    <section className="page">
      <h1>Runtime</h1>
      <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
        <p><strong>DeepSeek Harness</strong></p>
        <p><strong>Status:</strong> {formatStatus(info.status)}</p>
        <p><strong>PID:</strong> {info.pid ?? '—'}</p>
        <p><strong>URL:</strong> {info.url ?? '—'}</p>
        <p><strong>Port:</strong> {config?.runtime.port ?? '—'}</p>
        <p><strong>Uptime:</strong> {uptime}</p>
        {latestError && <p style={{ color: 'crimson' }}><strong>Latest error:</strong> {latestError}</p>}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button onClick={handleRestart} disabled={!canRestart}>Restart Runtime</button>
          <button onClick={handleStop} disabled={!canStop}>Stop Runtime</button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <strong>Recent logs</strong>
          <pre style={{ maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {logs.length === 0 ? 'No logs yet.' : logs.map((entry) => (
              `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.stream}: ${entry.message}\n`
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}

function formatStatus(status: RuntimeInfo['status']): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatUptime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CONTROL_CENTER_WIDTH_DEFAULT,
  CONTROL_CENTER_WIDTH_MAX,
  CONTROL_CENTER_WIDTH_MIN,
} from '@shared/configTypes';
import type { RookieDshConfig } from '@shared/configTypes';
import type {
  CoreOverview,
  RuntimeDiagnostics,
  RuntimeInfo,
  RuntimeLogEntry,
} from '@shared/types';
import CoreOverviewCard from './CoreOverviewCard';
import DiagnosticsCard from './DiagnosticsCard';
import ConfigCard from './ConfigCard';
import RuntimeCard from './RuntimeCard';

const INITIAL_INFO: RuntimeInfo = {
  status: 'STOPPED',
  pid: null,
  url: null,
  error: null,
  startedAt: null,
};

const INITIAL_DIAGNOSTICS: RuntimeDiagnostics = {
  lastStartTime: null,
  lastStopTime: null,
  lastError: null,
  startupDuration: null,
  restartCount: 0,
  lastStatus: 'STOPPED',
  lastStatusChangedAt: null,
  recentEvents: [],
};

interface ResizeState {
  pointerId: number;
  startScreenX: number;
  startWidth: number;
  currentWidth: number;
}

function clampControlCenterWidth(width: number): number {
  return Math.min(CONTROL_CENTER_WIDTH_MAX, Math.max(CONTROL_CENTER_WIDTH_MIN, Math.round(width)));
}

export default function ControlCenter() {
  const runtime = window.rookiedsh?.runtime;
  const shell = window.rookiedsh?.shell;
  const [info, setInfo] = useState<RuntimeInfo>(INITIAL_INFO);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostics>(INITIAL_DIAGNOSTICS);
  const [config, setConfig] = useState<RookieDshConfig | null>(null);
  const [coreOverview, setCoreOverview] = useState<CoreOverview | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    if (!runtime) return;

    let disposed = false;
    const refreshDetails = async () => {
      try {
        const [nextLogs, nextDiagnostics, nextConfig, nextOverview] = await Promise.all([
          runtime.getLogs(),
          runtime.getDiagnostics(),
          window.rookiedsh?.config.get(),
          window.rookiedsh?.core.getOverview(),
        ]);
        if (disposed) return;
        setLogs(nextLogs);
        setDiagnostics(nextDiagnostics);
        if (nextConfig) setConfig(nextConfig);
        if (nextOverview) setCoreOverview(nextOverview);
      } catch (error) {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      }
    };

    const unsubscribe = runtime.onStatusChanged((nextInfo) => {
      if (disposed) return;
      setInfo(nextInfo);
      void refreshDetails();
    });

    void Promise.all([
      runtime.getStatus(),
      runtime.getLogs(),
      runtime.getDiagnostics(),
      window.rookiedsh?.config.get(),
      window.rookiedsh?.core.getOverview(),
    ])
      .then(([nextInfo, nextLogs, nextDiagnostics, nextConfig, nextOverview]) => {
        if (disposed) return;
        setInfo(nextInfo);
        setLogs(nextLogs);
        setDiagnostics(nextDiagnostics);
        if (nextConfig) setConfig(nextConfig);
        if (nextOverview) setCoreOverview(nextOverview);
      })
      .catch((error: unknown) => {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [runtime]);

  useEffect(() => {
    if (info.status !== 'RUNNING') return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [info.status]);

  async function restartRuntime() {
    if (!runtime) return;
    setActionError(null);
    try {
      if (info.status === 'RUNNING' || info.status === 'STARTING') await runtime.stop();
      await runtime.start();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function stopRuntime() {
    if (!runtime) return;
    setActionError(null);
    try {
      await runtime.stop();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startWidth = clampControlCenterWidth(config?.controlCenter.width ?? CONTROL_CENTER_WIDTH_DEFAULT);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startWidth,
      currentWidth: startWidth,
    };
    setResizing(true);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const nextWidth = clampControlCenterWidth(resize.startWidth - (event.screenX - resize.startScreenX));
    resize.currentWidth = nextWidth;
    shell?.setControlCenterWidth(nextWidth);
  }

  function finishResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setResizing(false);
    const width = resize.currentWidth;
    void shell?.saveControlCenterWidth(width)
      .then(() => {
        setConfig((current) => current
          ? { ...current, controlCenter: { ...current.controlCenter, width } }
          : current);
      })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : String(error));
      });
  }

  const busy = info.status === 'STARTING' || info.status === 'STOPPING';

  return (
    <section className="control-center" role="dialog" aria-label="Runtime Control Center">
      <div
        className={`control-center-resize-handle${resizing ? ' resizing' : ''}`}
        role="separator"
        aria-label="Resize Control Center"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      />
      <header className="control-center-header">
        <div>
          <div className="control-center-eyebrow">RookieDSH</div>
          <h1>Control Center</h1>
        </div>
        <button
          className="control-center-close"
          type="button"
          onClick={() => shell?.toggleControlCenter()}
          aria-label="Close Control Center"
        >
          ×
        </button>
      </header>

      <div className="control-center-grid">
        <CoreOverviewCard overview={coreOverview} />
        <RuntimeCard
          info={info}
          now={now}
          busy={busy}
          actionError={actionError}
          onRestart={() => void restartRuntime()}
          onStop={() => void stopRuntime()}
        />
        <DiagnosticsCard diagnostics={diagnostics} logs={logs} />
        <ConfigCard config={config} />
      </div>
    </section>
  );
}

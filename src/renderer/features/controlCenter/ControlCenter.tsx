import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { RookieDshConfig } from '@shared/configTypes';
import type {
  FloatingPosition,
  RuntimeDiagnostics,
  RuntimeInfo,
  RuntimeLogEntry,
} from '@shared/types';
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

interface DragState {
  pointerId: number;
  moved: boolean;
  started: boolean;
}

export default function ControlCenter() {
  const runtime = window.rookiedsh?.runtime;
  const shell = window.rookiedsh?.shell;
  const [panelOpen, setPanelOpen] = useState(false);
  const [info, setInfo] = useState<RuntimeInfo>(INITIAL_INFO);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<RuntimeDiagnostics>(INITIAL_DIAGNOSTICS);
  const [config, setConfig] = useState<RookieDshConfig | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dragRef = useRef<DragState | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!runtime) return;

    let disposed = false;
    const refreshDetails = async () => {
      try {
        const [nextLogs, nextDiagnostics, nextConfig] = await Promise.all([
          runtime.getLogs(),
          runtime.getDiagnostics(),
          window.rookiedsh?.config.get(),
        ]);
        if (disposed) return;
        setLogs(nextLogs);
        setDiagnostics(nextDiagnostics);
        if (nextConfig) setConfig(nextConfig);
      } catch (error) {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      }
    };

    const unsubscribe = runtime.onStatusChanged((nextInfo) => {
      if (disposed) return;
      setInfo(nextInfo);
      void refreshDetails();
    });

    void Promise.all([runtime.getStatus(), runtime.getLogs(), runtime.getDiagnostics(), window.rookiedsh?.config.get()])
      .then(([nextInfo, nextLogs, nextDiagnostics, nextConfig]) => {
        if (disposed) return;
        setInfo(nextInfo);
        setLogs(nextLogs);
        setDiagnostics(nextDiagnostics);
        if (nextConfig) setConfig(nextConfig);
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

  function closePanel() {
    setPanelOpen(false);
    shell?.setFloatingPanelOpen(false);
  }

  function togglePanel() {
    const nextOpen = !panelOpen;
    setPanelOpen(nextOpen);
    shell?.setFloatingPanelOpen(nextOpen);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (panelOpen) closePanel();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, moved: false, started: false };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1) drag.moved = true;
    if (drag.moved && !drag.started) {
      drag.started = true;
      shell?.beginFloatingDrag();
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (fabRef.current?.hasPointerCapture(event.pointerId)) {
      fabRef.current.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;

    if (drag.started) {
      shell?.endFloatingDrag();
      void shell?.getFloatingPosition().then((position: FloatingPosition) => {
        try {
          localStorage.setItem('rookiedsh.floatingActionButton.position', JSON.stringify(position));
        } catch {
          // Best effort persistence for the floating control position.
        }
      });
    } else {
      togglePanel();
    }
  }

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

  const busy = info.status === 'STARTING' || info.status === 'STOPPING';

  return (
    <div className={panelOpen ? 'control-center-root panel-open' : 'control-center-root'}>
      {panelOpen && (
        <section className="control-center" role="dialog" aria-label="Runtime Control Center">
          <header className="control-center-header">
            <div>
              <div className="control-center-eyebrow">RookieDSH</div>
              <h1>Control Center</h1>
            </div>
            <button className="control-center-close" type="button" onClick={closePanel} aria-label="Close Control Center">×</button>
          </header>

          <div className="control-center-grid">
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
      )}

      <button
        ref={fabRef}
        className="control-center-fab"
        type="button"
        aria-label="Open Control Center"
        title="Control Center"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePanel();
          }
        }}
      >
        ⚙
      </button>
    </div>
  );
}

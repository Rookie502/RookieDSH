import { useEffect, useState } from 'react';
import type { RookieDshConfig } from '@shared/configTypes';
import type { RuntimeInfo } from '@shared/types';

const INITIAL_INFO: RuntimeInfo = {
  status: 'STARTING',
  pid: null,
  url: null,
  error: null,
  startedAt: null,
};

export default function StartupScreen() {
  const [info, setInfo] = useState<RuntimeInfo>(INITIAL_INFO);
  const [config, setConfig] = useState<RookieDshConfig | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  useEffect(() => {
    const runtime = window.rookiedsh?.runtime;
    if (!runtime) return;

    let disposed = false;
    const unsubscribe = runtime.onStatusChanged((nextInfo) => {
      if (!disposed) setInfo(nextInfo);
    });

    void runtime.getStatus().then((nextInfo) => {
      if (!disposed) setInfo(nextInfo);
    }).catch(() => {
      // The startup state remains visible if the bridge is temporarily unavailable.
    });

    void window.rookiedsh?.config.get().then((nextConfig) => {
      if (!disposed) setConfig(nextConfig);
    }).catch(() => {
      // The runtime status remains useful if configuration loading is delayed.
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (info.status !== 'STARTING') {
      setWaitingSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => {
      setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [info.status]);

  async function retry() {
    setInfo((current) => ({ ...current, status: 'STARTING', error: null }));
    try {
      await window.rookiedsh?.runtime.start();
    } catch (error) {
      setInfo((current) => ({
        ...current,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  const isFailed = info.status === 'FAILED';
  const isStopped = info.status === 'STOPPED';
  const isRunning = info.status === 'RUNNING';

  if (isRunning) return null;

  return (
    <section className="startup-screen" aria-live="polite">
      <div className="startup-card">
        <div className="startup-brand">RookieDSH</div>
        <h1>{isFailed ? 'Runtime unavailable' : isStopped ? 'Runtime stopped' : 'Initializing...'}</h1>
        {!isFailed && !isStopped && (
          <p className="startup-detail">
            Connecting to {config ? `localhost:${config.runtime.port}` : 'Harness'}{waitingSeconds > 0 ? ` · ${waitingSeconds}s` : ''}
          </p>
        )}
        <div className="startup-steps">
          <StartupStep label="Electron ready" state="done" />
          <StartupStep
            label="Starting DeepSeek Harness"
            state={isFailed ? 'failed' : isStopped ? 'pending' : info.status === 'STARTING' ? 'active' : 'done'}
          />
          <StartupStep
            label="Connecting Runtime"
            state={isFailed ? 'failed' : isStopped ? 'pending' : info.status === 'STARTING' ? 'active' : 'pending'}
          />
        </div>
        {isStopped && <p className="startup-detail">Automatic startup is disabled in configuration.</p>}
        {(isFailed || isStopped) && (
          <>
            {isFailed && <p className="startup-error">{info.error ?? 'The Harness runtime failed to start.'}</p>}
            <button type="button" onClick={() => void retry()}>{isStopped ? 'Start Runtime' : 'Retry Runtime'}</button>
          </>
        )}
      </div>
    </section>
  );
}

function StartupStep({ label, state }: { label: string; state: StepState }) {
  const symbol = state === 'done' ? '✓' : state === 'failed' ? '×' : state === 'active' ? '…' : '○';
  return (
    <div className={`startup-step ${state}`}>
      <span className="startup-step-symbol" aria-hidden="true">{symbol}</span>
      <span>{label}</span>
    </div>
  );
}

type StepState = 'pending' | 'active' | 'done' | 'failed';

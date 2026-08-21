import { useEffect, useState } from 'react';
import type { RookieDshConfig } from '@shared/configTypes';
import type { RuntimeInfo } from '@shared/types';
import { detectSystemLanguage, setLanguage as setLocale, t } from '../i18n';

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
  const [language, setLanguage] = useState(() => {
    const initialLanguage = detectSystemLanguage();
    setLocale(initialLanguage);
    return initialLanguage;
  });

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
      if (!disposed) {
        setConfig(nextConfig);
        setLocale(nextConfig.language);
        setLanguage(nextConfig.language);
      }
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
    <section className="startup-screen" aria-live="polite" data-language={language}>
      <div className="startup-card">
        <div className="startup-brand">RookieDSH</div>
        <h1>{isFailed ? t('startup.runtimeUnavailable') : isStopped ? t('startup.runtimeStopped') : t('startup.initializing')}</h1>
        {!isFailed && !isStopped && (
          <p className="startup-detail">
            {t('startup.connectingTo')} {config ? `localhost:${config.runtime.port}` : t('startup.harness')}{waitingSeconds > 0 ? ` · ${waitingSeconds}s` : ''}
          </p>
        )}
        <div className="startup-steps">
          <StartupStep label={t('startup.electronReady')} state="done" />
          <StartupStep
            label={t('startup.startingHarness')}
            state={isFailed ? 'failed' : isStopped ? 'pending' : info.status === 'STARTING' ? 'active' : 'done'}
          />
          <StartupStep
            label={t('startup.connectingRuntime')}
            state={isFailed ? 'failed' : isStopped ? 'pending' : info.status === 'STARTING' ? 'active' : 'pending'}
          />
        </div>
        {isStopped && <p className="startup-detail">{t('startup.automaticStartupDisabled')}</p>}
        {(isFailed || isStopped) && (
          <>
            {isFailed && <p className="startup-error">{info.error ?? t('startup.failedToStart')}</p>}
            <button type="button" onClick={() => void retry()}>{isStopped ? t('startup.startRuntime') : t('startup.retryRuntime')}</button>
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

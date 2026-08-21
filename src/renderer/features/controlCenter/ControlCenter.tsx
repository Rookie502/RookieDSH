import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CONTROL_CENTER_WIDTH_DEFAULT,
  CONTROL_CENTER_WIDTH_MAX,
  CONTROL_CENTER_WIDTH_MIN,
} from '@shared/configTypes';
import type { Language, RookieDshConfig } from '@shared/configTypes';
import type {
  CoreOverview,
  RuntimeDiagnostics,
  RuntimeInfo,
  RuntimeLogEntry,
} from '@shared/types';
import { detectSystemLanguage, setLanguage as setLocale, t } from '../../i18n';
import OverviewView from './views/OverviewView';
import RuntimeView from './views/RuntimeView';
import ModelsView from './views/ModelsView';
import WorkspaceView from './views/WorkspaceView';
import TasksView from './views/TasksView';
import SettingsView from './views/SettingsView';

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

type ControlCenterView = 'overview' | 'runtime' | 'models' | 'workspace' | 'tasks' | 'settings';

const NAV_ITEMS: Array<{ id: ControlCenterView; labelKey: string }> = [
  { id: 'overview', labelKey: 'controlCenter.views.overview' },
  { id: 'runtime', labelKey: 'controlCenter.views.runtime' },
  { id: 'models', labelKey: 'controlCenter.views.models' },
  { id: 'workspace', labelKey: 'controlCenter.views.workspace' },
  { id: 'tasks', labelKey: 'controlCenter.views.tasks' },
  { id: 'settings', labelKey: 'controlCenter.views.settings' },
];

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
  const [activeView, setActiveView] = useState<ControlCenterView>('overview');
  const [language, setLanguageState] = useState<Language>(() => {
    const initialLanguage = detectSystemLanguage();
    setLocale(initialLanguage);
    return initialLanguage;
  });

  function applyConfig(nextConfig: RookieDshConfig) {
    setConfig(nextConfig);
    setLocale(nextConfig.language);
    setLanguageState(nextConfig.language);
  }

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
        if (nextConfig) applyConfig(nextConfig);
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
        if (nextConfig) applyConfig(nextConfig);
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

  async function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    const previousLanguage = language;
    setLocale(nextLanguage);
    setLanguageState(nextLanguage);
    setActionError(null);
    try {
      const persistedLanguage = await window.rookiedsh?.config.setLanguage(nextLanguage);
      if (persistedLanguage) {
        setLocale(persistedLanguage);
        setLanguageState(persistedLanguage);
        setConfig((current) => current ? { ...current, language: persistedLanguage } : current);
      }
    } catch (error) {
      setLocale(previousLanguage);
      setLanguageState(previousLanguage);
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

  return (
    <section className="control-center" role="dialog" aria-label={t('controlCenter.title')}>
      <div
        className={`control-center-resize-handle${resizing ? ' resizing' : ''}`}
        role="separator"
        aria-label={t('controlCenter.resize')}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
      />
      <header className="control-center-header">
        <div>
          <div className="control-center-eyebrow">{t('controlCenter.eyebrow')}</div>
          <h1>{t('controlCenter.title')}</h1>
        </div>
        <div className="control-center-header-actions">
          <div className="language-switch" role="group" aria-label={t('controlCenter.language')}>
            <button
              className={language === 'zh-CN' ? 'active' : ''}
              type="button"
              onClick={() => void changeLanguage('zh-CN')}
            >
              {t('controlCenter.chinese')}
            </button>
            <span aria-hidden="true">|</span>
            <button
              className={language === 'en-US' ? 'active' : ''}
              type="button"
              onClick={() => void changeLanguage('en-US')}
            >
              {t('controlCenter.english')}
            </button>
          </div>
          <button
            className="control-center-close"
            type="button"
            onClick={() => shell?.toggleControlCenter()}
            aria-label={t('controlCenter.close')}
          >
            ×
          </button>
        </div>
      </header>

      <nav className="control-center-nav" aria-label={t('controlCenter.navigation')}>
        {NAV_ITEMS.map((item) => (
          <button
            className={activeView === item.id ? 'active' : ''}
            type="button"
            key={item.id}
            onClick={() => setActiveView(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className="control-center-grid">
        {activeView === 'overview' && (
          <OverviewView
            overview={coreOverview}
            info={info}
            diagnostics={diagnostics}
            logs={logs}
            config={config}
            now={now}
          />
        )}
        {activeView === 'runtime' && (
          <RuntimeView
            info={info}
            now={now}
            diagnostics={diagnostics}
            logs={logs}
            actionError={actionError}
            onRestart={() => void restartRuntime()}
            onStop={() => void stopRuntime()}
          />
        )}
        {activeView === 'models' && <ModelsView />}
        {activeView === 'workspace' && <WorkspaceView />}
        {activeView === 'tasks' && <TasksView />}
        {activeView === 'settings' && <SettingsView config={config} language={language} />}
      </div>
    </section>
  );
}

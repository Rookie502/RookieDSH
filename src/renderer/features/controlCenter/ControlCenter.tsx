import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CONTROL_CENTER_WIDTH_DEFAULT,
  CONTROL_CENTER_WIDTH_MAX,
  CONTROL_CENTER_WIDTH_MIN,
} from '@shared/configTypes';
import type { Language, RookieDshConfig, UpdateConfig } from '@shared/configTypes';
import type {
  CoreOverview,
  ModelEndpoint,
  RuntimeInstance,
  RuntimeDiagnostics,
  RuntimeInfo,
  RuntimeLogEntry,
  RuntimeUpdateProgress,
  UpdateHistory,
  SoftwareVersion,
  UpdateStatus,
  DshCapabilitySet,
  DshProviderSnapshot,
  RuntimeBindingInput,
} from '@shared/types';
import { detectSystemLanguage, setLanguage as setLocale, t } from '../../i18n';
import OverviewView from './views/OverviewView';
import RuntimeView from './views/RuntimeView';
import ModelsView from './views/ModelsView';
import WorkspaceView from './views/WorkspaceView';
import TasksView from './views/TasksView';
import SettingsView from './views/SettingsView';
import UpdatesView from './views/UpdatesView';

const INITIAL_INFO: RuntimeInfo = {
  status: 'STOPPED',
  readiness: 'NOT_STARTED',
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

const INITIAL_UPDATE_PROGRESS: RuntimeUpdateProgress = {
  stage: 'IDLE',
  message: '',
  fromVersion: null,
  toVersion: null,
  error: null,
  startedAt: null,
  updatedAt: new Date().toISOString(),
  finishedAt: null,
  elapsedMs: 0,
  installedVersion: null,
  restartStatus: 'NOT_REQUIRED',
  installationResult: 'NOT_ATTEMPTED',
  restartResult: 'NOT_REQUIRED',
  outcome: null,
  logs: [],
};

interface ResizeState {
  pointerId: number;
  startScreenX: number;
  startWidth: number;
  currentWidth: number;
}

type ControlCenterView = 'overview' | 'runtime' | 'models' | 'workspace' | 'tasks' | 'updates' | 'settings';

const NAV_ITEMS: Array<{ id: ControlCenterView; labelKey: string }> = [
  { id: 'overview', labelKey: 'controlCenter.views.overview' },
  { id: 'runtime', labelKey: 'controlCenter.views.runtime' },
  { id: 'models', labelKey: 'controlCenter.views.models' },
  { id: 'workspace', labelKey: 'controlCenter.views.workspace' },
  { id: 'tasks', labelKey: 'controlCenter.views.tasks' },
  { id: 'updates', labelKey: 'controlCenter.views.updates' },
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
  const [modelEndpoints, setModelEndpoints] = useState<ModelEndpoint[]>([]);
  const [runtimeInstances, setRuntimeInstances] = useState<RuntimeInstance[]>([]);
  const [providerSnapshot, setProviderSnapshot] = useState<DshProviderSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<DshCapabilitySet | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateHistory, setUpdateHistory] = useState<UpdateHistory[]>([]);
  const [updateProgress, setUpdateProgress] = useState<RuntimeUpdateProgress>(INITIAL_UPDATE_PROGRESS);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<ResizeState | null>(null);
  const [activeView, setActiveView] = useState<ControlCenterView>('overview');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [language, setLanguageState] = useState<Language>(() => {
    const initialLanguage = detectSystemLanguage();
    setLocale(initialLanguage);
    return initialLanguage;
  });

  async function refreshProviderSnapshot(force = false): Promise<DshProviderSnapshot | null> {
    try {
      const next = force
        ? await window.rookiedsh?.runtimeProviders.refresh()
        : await window.rookiedsh?.runtimeProviders.list(false);
      if (next) {
        setProviderSnapshot(next);
        setCapabilities(next.capabilities);
        return next;
      }
    } catch (error) {
      setProviderSnapshot((current) => current ?? {
        providers: [],
        modelGroups: [],
        bindings: [],
        capabilities: capabilities ?? {
          providerRead: false,
          providerWrite: false,
          credentialRead: false,
          credentialWrite: false,
          modelDiscovery: false,
          defaultModelSelection: false,
          acp: 'unknown',
          compatibilityWarning: error instanceof Error ? error.message : String(error),
          dshVersion: null,
          probedAt: null,
        },
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }

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
        const [nextLogs, nextDiagnostics, nextConfig, nextOverview, nextModelEndpoints, nextRuntimeInstances, nextUpdateStatus, nextHistory, nextProgress] = await Promise.all([
          runtime.getLogs(),
          runtime.getDiagnostics(),
          window.rookiedsh?.config.get(),
          window.rookiedsh?.core.getOverview(),
          window.rookiedsh?.models.list(),
          window.rookiedsh?.runtimes.list(),
          window.rookiedsh?.updates.getStatus(),
          window.rookiedsh?.updates.getHistory(),
          window.rookiedsh?.updates.getProgress(),
        ]);
        if (disposed) return;
        setLogs(nextLogs);
        setDiagnostics(nextDiagnostics);
        if (nextConfig) applyConfig(nextConfig);
        if (nextOverview) setCoreOverview(nextOverview);
        if (nextModelEndpoints) setModelEndpoints(nextModelEndpoints);
        if (nextRuntimeInstances) setRuntimeInstances(nextRuntimeInstances);
        if (nextUpdateStatus) setUpdateStatus(nextUpdateStatus);
        if (nextHistory) setUpdateHistory(nextHistory);
        if (nextProgress) setUpdateProgress(nextProgress);
        void refreshProviderSnapshot();
      } catch (error) {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      }
    };

    const unsubscribe = runtime.onStatusChanged((nextInfo) => {
      if (disposed) return;
      setInfo(nextInfo);
      void refreshDetails();
    });
    const unsubscribeUpdateProgress = window.rookiedsh?.updates.onProgressChanged((nextProgress) => {
      if (!disposed) setUpdateProgress(nextProgress);
    });

    void Promise.all([
      runtime.getStatus(),
      runtime.getLogs(),
      runtime.getDiagnostics(),
      window.rookiedsh?.config.get(),
      window.rookiedsh?.core.getOverview(),
      window.rookiedsh?.models.list(),
      window.rookiedsh?.runtimes.list(),
      window.rookiedsh?.updates.getStatus(),
      window.rookiedsh?.updates.getHistory(),
      window.rookiedsh?.updates.getProgress(),
    ])
      .then(([nextInfo, nextLogs, nextDiagnostics, nextConfig, nextOverview, nextModelEndpoints, nextRuntimeInstances, nextUpdateStatus, nextHistory, nextProgress]) => {
        if (disposed) return;
        setInfo(nextInfo);
        setLogs(nextLogs);
        setDiagnostics(nextDiagnostics);
        if (nextConfig) applyConfig(nextConfig);
        if (nextOverview) setCoreOverview(nextOverview);
        if (nextModelEndpoints) setModelEndpoints(nextModelEndpoints);
        if (nextRuntimeInstances) setRuntimeInstances(nextRuntimeInstances);
        if (nextUpdateStatus) setUpdateStatus(nextUpdateStatus);
        if (nextHistory) setUpdateHistory(nextHistory);
        if (nextProgress) setUpdateProgress(nextProgress);
      })
      .catch((error: unknown) => {
        if (!disposed) setActionError(error instanceof Error ? error.message : String(error));
      });
    void refreshProviderSnapshot();

    return () => {
      disposed = true;
      unsubscribe();
      unsubscribeUpdateProgress?.();
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

  async function checkUpdates() {
    setCheckingUpdates(true);
    setActionError(null);
    try {
      setUpdateStatus(await window.rookiedsh?.updates.check() ?? null);
      setRuntimeInstances(await window.rookiedsh?.runtimes.list() ?? []);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function updateRuntime() {
    setActionError(null);
    try {
      const result = await window.rookiedsh?.updates.updateRuntime();
      if (!result) return;
      setUpdateProgress(result.progress);
      setUpdateHistory(await window.rookiedsh?.updates.getHistory() ?? []);
      // Re-read the installed package even after a failed/recovered update.
      // npm may have completed the installation before a later verification
      // or runtime restart step failed, so the cached status can be stale.
      let refreshedStatus: UpdateStatus | undefined;
      try {
        refreshedStatus = await window.rookiedsh?.updates.check();
      } catch {
        // Keep the update result visible even when the registry is temporarily unavailable.
        refreshedStatus = await window.rookiedsh?.updates.getStatus();
      }
      setUpdateStatus(refreshedStatus ?? await window.rookiedsh?.updates.getStatus() ?? null);
      setRuntimeInstances(await window.rookiedsh?.runtimes.list() ?? []);
      await refreshProviderSnapshot(true);
      if (result.history.error && result.status !== 'SUCCESS') setActionError(result.history.error);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveUpdatePreferences(nextUpdates: UpdateConfig) {
    setActionError(null);
    try {
      const saved = await window.rookiedsh?.config.setUpdatePreferences(nextUpdates);
      if (saved) setConfig((current) => current ? { ...current, updates: saved } : current);
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
            runtimeCount={runtimeInstances.length}
            modelEndpointCount={modelEndpoints.length}
            onlineModelEndpointCount={modelEndpoints.filter((endpoint) => endpoint.status === 'ONLINE').length}
            updateAvailable={Boolean(updateStatus?.software.some((version) => version.compatibility === 'update-available'))}
            providerCount={providerSnapshot?.providers.length ?? 0}
            bindingCount={providerSnapshot?.bindings.length ?? 0}
            providerSyncHealthy={providerSnapshot ? providerSnapshot.bindings.every((binding) => binding.status === 'SYNCED') : null}
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
            update={updateStatus?.software.find((version) => version.target === 'deepseek-harness') ?? null}
            onViewUpdates={() => setActiveView('updates')}
            capabilities={capabilities ?? providerSnapshot?.capabilities ?? null}
            providerCount={providerSnapshot?.providers.length ?? 0}
            onManageProviders={() => setActiveView('models')}
          />
        )}
        {activeView === 'models' && (
          <ModelsView
            endpoints={modelEndpoints}
            onChange={setModelEndpoints}
            providers={providerSnapshot?.providers ?? []}
            bindings={providerSnapshot?.bindings ?? []}
            capabilities={providerSnapshot?.capabilities ?? null}
            onRefreshProviders={() => void refreshProviderSnapshot(true)}
            onImportProvider={async (providerId) => {
              const endpoint = await window.rookiedsh?.runtimeProviders.import(providerId);
              if (endpoint) setModelEndpoints(await window.rookiedsh?.models.list() ?? [endpoint]);
              await refreshProviderSnapshot(true);
            }}
            onBindEndpoint={async (input: RuntimeBindingInput) => {
              await window.rookiedsh?.runtimeProviders.bind(input);
              await refreshProviderSnapshot(true);
            }}
            onUnbind={async (bindingId) => {
              await window.rookiedsh?.runtimeProviders.unbind(bindingId);
              await refreshProviderSnapshot(true);
            }}
          />
        )}
        {activeView === 'workspace' && <WorkspaceView />}
        {activeView === 'tasks' && <TasksView />}
        {activeView === 'updates' && (
          <UpdatesView
            status={updateStatus}
            checking={checkingUpdates}
            onCheck={() => void checkUpdates()}
            updating={[
              'CHECKING',
              'PREPARING',
              'STOPPING_RUNTIME',
              'INSTALLING',
              'VERIFYING',
              'ROLLING_BACK',
              'RESTARTING_RUNTIME',
            ].includes(updateProgress.stage)}
            onUpdate={() => void updateRuntime()}
            onRestartRuntime={() => void restartRuntime()}
            onViewRuntimeLogs={() => setActiveView('runtime')}
            history={updateHistory}
            progress={updateProgress}
          />
        )}
        {activeView === 'settings' && <SettingsView config={config} language={language} onUpdatePreferences={(nextUpdates) => void saveUpdatePreferences(nextUpdates)} />}
      </div>
    </section>
  );
}

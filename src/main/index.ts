import { app, BrowserView, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import path from 'node:path';
import {
  CONTROL_CENTER_WIDTH_DEFAULT,
  CONTROL_CENTER_WIDTH_MAX,
  CONTROL_CENTER_WIDTH_MIN,
  type Language,
  type RookieDshConfig,
} from '@shared/configTypes';
import type {
  ControlCenterState,
  FloatingPosition,
  ShellPage,
  TaskStatusUpdateInput,
  WorkspaceCreateInput,
  TaskCreateInput,
  RunCreateInput,
} from '@shared/types';
import { getConfig, saveConfig } from './config/configManager';
import {
  createRun,
  createTask,
  createWorkspace,
  deleteWorkspaceMetadata,
  getCoreOverview,
  getRun,
  getTask,
  getWorkspace,
  listEvents,
  listRuns,
  listTasks,
  listWorkspaces,
  recordEvent,
  updateTaskStatus,
} from './core/services/coreService';
import { getDiagnostics, recordRuntimeStatus } from './diagnostics/diagnosticsManager';
import {
  cleanupDshSync,
  getRuntimeLogs,
  getRuntimeStatus,
  onDshStatusChanged,
  startRuntime,
  stopRuntime,
} from './runtime/RuntimeManager';

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.ROOKIE_DSH_DEV_SERVER_URL ?? 'http://localhost:5173';
const STARTUP_STARTED_AT = Number(process.env.ROOKIE_DSH_DEV_STARTED_AT) || Date.now();
const FLOATING_EDGE_GAP = 16;
const FLOATING_BUTTON_SIZE = 56;
const FLOATING_VIEW_SIZE = FLOATING_BUTTON_SIZE;

let mainWindow: BrowserWindow | null = null;
let harnessView: BrowserView | null = null;
let floatingView: BrowserView | null = null;
let controlCenterView: BrowserView | null = null;
let harnessAttached = false;
let floatingAttached = false;
let controlCenterAttached = false;
let harnessNeedsReload = true;
let currentShellPage: ShellPage = 'harness';
let controlCenterState: ControlCenterState = 'CLOSED';
let controlCenterWidth = CONTROL_CENTER_WIDTH_DEFAULT;
let floatingDragTimer: NodeJS.Timeout | null = null;
let floatingDragOrigin: {
  cursorX: number;
  cursorY: number;
  position: FloatingPosition;
} | null = null;
let floatingPosition: FloatingPosition = {
  right: FLOATING_EDGE_GAP,
  bottom: FLOATING_EDGE_GAP,
};

function broadcastRuntimeStatus(info: ReturnType<typeof getRuntimeStatus>): void {
  const targets = [
    ...BrowserWindow.getAllWindows().map((win) => win.webContents),
    floatingView?.webContents,
    controlCenterView?.webContents,
  ];
  for (const contents of targets) {
    if (contents && !contents.isDestroyed()) contents.send('runtime:statusChanged', info);
  }
}

function updateHarnessBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !harnessView || harnessView.webContents.isDestroyed()) return;

  const { width, height } = mainWindow.getContentBounds();
  harnessView.setBounds({
    x: 0,
    y: 0,
    width,
    height,
  });
}

function updateFloatingBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !floatingView || floatingView.webContents.isDestroyed()) return;

  const { width, height } = mainWindow.getContentBounds();
  const viewWidth = FLOATING_VIEW_SIZE;
  const viewHeight = FLOATING_VIEW_SIZE;
  floatingView.setBounds({
    x: Math.max(0, width - floatingPosition.right - viewWidth),
    y: Math.max(0, height - floatingPosition.bottom - viewHeight),
    width: viewWidth,
    height: viewHeight,
  });
}

function updateControlCenterBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !controlCenterView || controlCenterView.webContents.isDestroyed()) return;
  if (!controlCenterAttached || controlCenterState !== 'OPEN') return;

  const { width, height } = mainWindow.getContentBounds();
  const panelWidth = controlCenterWidth;
  controlCenterView.setBounds({
    x: Math.max(0, width - panelWidth),
    y: 0,
    width: Math.min(panelWidth, width),
    height,
  });
}

function clampControlCenterWidth(value: number): number {
  return Math.min(
    CONTROL_CENTER_WIDTH_MAX,
    Math.max(CONTROL_CENTER_WIDTH_MIN, Math.round(value)),
  );
}

function setControlCenterWidth(width: number, persist: boolean): number {
  if (!Number.isFinite(width)) return controlCenterWidth;
  const nextWidth = clampControlCenterWidth(width);
  controlCenterWidth = nextWidth;

  if (persist) {
    const config = getConfig();
    saveConfig({
      ...config,
      controlCenter: {
        ...config.controlCenter,
        width: nextWidth,
      },
    });
  }

  updateControlCenterBounds();
  return nextWidth;
}

function bringFloatingViewToFront(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !floatingView || floatingView.webContents.isDestroyed()) return;
  if (floatingAttached) {
    try {
      mainWindow.removeBrowserView(floatingView);
    } catch {
      floatingAttached = false;
    }
  }
  try {
    mainWindow.addBrowserView(floatingView);
  } catch {
    return;
  }
  floatingAttached = true;
  updateFloatingBounds();
}

function bringControlCenterViewToFront(): void {
  if (
    !mainWindow
    || mainWindow.isDestroyed()
    || !controlCenterView
    || controlCenterView.webContents.isDestroyed()
    || controlCenterState !== 'OPEN'
  ) return;

  if (controlCenterAttached) {
    try {
      mainWindow.removeBrowserView(controlCenterView);
    } catch {
      controlCenterAttached = false;
    }
  }
  try {
    mainWindow.addBrowserView(controlCenterView);
  } catch {
    return;
  }
  controlCenterAttached = true;
  updateControlCenterBounds();
}

function showControlCenterView(): void {
  bringControlCenterViewToFront();
  bringFloatingViewToFront();
}

function hideControlCenterView(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !controlCenterView || !controlCenterAttached) return;
  try {
    mainWindow.removeBrowserView(controlCenterView);
  } catch {
    // The BrowserView may already be detached during window teardown.
  }
  controlCenterAttached = false;
}

function setControlCenterState(nextState: ControlCenterState): void {
  if (controlCenterState === nextState) return;
  controlCenterState = nextState;

  if (nextState === 'OPEN') showControlCenterView();
  else hideControlCenterView();

  const targets = [floatingView?.webContents, controlCenterView?.webContents];
  for (const contents of targets) {
    if (contents && !contents.isDestroyed()) contents.send('shell:controlCenterStateChanged', controlCenterState);
  }
}

function showHarnessView(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !harnessView || harnessView.webContents.isDestroyed()) return;
  if (harnessNeedsReload) {
    harnessNeedsReload = false;
    void harnessView.webContents.loadURL(getConfig().harness.url).catch((error: unknown) => {
      harnessNeedsReload = true;
      console.error('Harness UI load failed:', error);
    });
  }
  if (harnessAttached) return;
  try {
    mainWindow.addBrowserView(harnessView);
  } catch {
    return;
  }
  harnessAttached = true;
  updateHarnessBounds();
  if (controlCenterState === 'OPEN') bringControlCenterViewToFront();
  bringFloatingViewToFront();
}

function hideHarnessView(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !harnessView || !harnessAttached) return;
  try {
    mainWindow.removeBrowserView(harnessView);
  } catch {
    // The window may already be destroying.
  }
  harnessAttached = false;
}

function stopFloatingDrag(): void {
  if (floatingDragTimer) clearInterval(floatingDragTimer);
  floatingDragTimer = null;
  floatingDragOrigin = null;
}

function updateFloatingDrag(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !floatingDragOrigin) return;

  const cursor = screen.getCursorScreenPoint();
  const { width, height } = mainWindow.getContentBounds();
  const maxRight = Math.max(FLOATING_EDGE_GAP, width - FLOATING_BUTTON_SIZE - FLOATING_EDGE_GAP);
  const maxBottom = Math.max(FLOATING_EDGE_GAP, height - FLOATING_BUTTON_SIZE - FLOATING_EDGE_GAP);
  const nextPosition: FloatingPosition = {
    right: Math.min(
      Math.max(FLOATING_EDGE_GAP, floatingDragOrigin.position.right - (cursor.x - floatingDragOrigin.cursorX)),
      maxRight,
    ),
    bottom: Math.min(
      Math.max(FLOATING_EDGE_GAP, floatingDragOrigin.position.bottom - (cursor.y - floatingDragOrigin.cursorY)),
      maxBottom,
    ),
  };

  if (nextPosition.right === floatingPosition.right && nextPosition.bottom === floatingPosition.bottom) return;
  floatingPosition = nextPosition;
  updateFloatingBounds();
}

function disposeEmbeddedViews(): void {
  stopFloatingDrag();

  const win = mainWindow;
  if (!win || win.isDestroyed()) {
    harnessView = null;
    floatingView = null;
    controlCenterView = null;
    harnessAttached = false;
    floatingAttached = false;
    controlCenterAttached = false;
    return;
  }

  if (harnessView) {
    if (!harnessView.webContents.isDestroyed()) harnessView.webContents.stop();
    if (harnessAttached) {
      try {
        win.removeBrowserView(harnessView);
      } catch {
        // The BrowserView may already be detached during window teardown.
      }
    }
    harnessAttached = false;
  }
  if (floatingView) {
    if (!floatingView.webContents.isDestroyed()) floatingView.webContents.stop();
    if (floatingAttached) {
      try {
        win.removeBrowserView(floatingView);
      } catch {
        // The BrowserView may already be detached during window teardown.
      }
    }
    floatingAttached = false;
    floatingView = null;
  }
  if (controlCenterView) {
    if (!controlCenterView.webContents.isDestroyed()) controlCenterView.webContents.stop();
    if (controlCenterAttached) {
      try {
        win.removeBrowserView(controlCenterView);
      } catch {
        // The BrowserView may already be detached during window teardown.
      }
    }
    controlCenterAttached = false;
    controlCenterView = null;
  }
  harnessView = null;
}

function createHarnessView(): BrowserView {
  if (harnessView && !harnessView.webContents.isDestroyed()) return harnessView;

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(getConfig().harness.url)) event.preventDefault();
  });
  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    harnessNeedsReload = true;
    console.error(`Harness UI failed to load (${errorCode}): ${errorDescription}`);
  });
  view.webContents.on('did-finish-load', () => {
    console.log(`ROOKIE_DSH_METRIC harness-ready-ms=${Date.now() - STARTUP_STARTED_AT}`);
  });
  harnessView = view;
  return view;
}

function createFloatingView(win: BrowserWindow): BrowserView {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  floatingView = view;
  win.addBrowserView(view);
  floatingAttached = true;
  updateFloatingBounds();
  const floatingPage = isDev
    ? view.webContents.loadURL(`${DEV_SERVER_URL}/floating.html`)
    : view.webContents.loadFile(path.join(__dirname, '../renderer/floating.html'));
  floatingPage.catch((error: unknown) => {
    console.error('Floating action button load failed:', error);
  });
  return view;
}

function createControlCenterView(win: BrowserWindow): BrowserView {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  controlCenterView = view;
  // Keep the overlay detached until Main toggles it open. This is explicit
  // because BrowserView attachment is a window concern, not a renderer concern.
  try {
    win.removeBrowserView(view);
  } catch {
    // A newly created view is normally already detached.
  }
  const controlCenterPage = isDev
    ? view.webContents.loadURL(`${DEV_SERVER_URL}/controlCenter.html`)
    : view.webContents.loadFile(path.join(__dirname, '../renderer/controlCenter.html'));
  controlCenterPage.catch((error: unknown) => {
    console.error('Control Center load failed:', error);
  });
  return view;
}

function createMainWindow(config: RookieDshConfig): BrowserWindow {
  controlCenterWidth = clampControlCenterWidth(config.controlCenter.width);
  const win = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: 960,
    minHeight: 640,
    title: 'RookieDSH',
    show: true,
    backgroundColor: '#1e1f24',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  createFloatingView(win);
  createControlCenterView(win);
  win.webContents.on('did-finish-load', () => {
    console.log(`ROOKIE_DSH_METRIC electron-ready-ms=${Date.now() - STARTUP_STARTED_AT}`);
  });
  win.on('resize', () => {
    updateHarnessBounds();
    updateControlCenterBounds();
    updateFloatingBounds();
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.show();
  win.focus();
  if (process.platform === 'win32') win.moveTop();

  return win;
}

ipcMain.handle('runtime:start', async () => {
  await startRuntime();
});

ipcMain.handle('runtime:stop', async () => {
  await stopRuntime();
});

ipcMain.handle('runtime:getStatus', () => getRuntimeStatus());
ipcMain.handle('runtime:getLogs', () => getRuntimeLogs());
ipcMain.handle('runtime:getDiagnostics', () => getDiagnostics());
ipcMain.handle('config:get', () => getConfig());
ipcMain.handle('config:setLanguage', (_event, language: Language) => {
  const config = getConfig();
  return saveConfig({ ...config, language }).language;
});

ipcMain.handle('core:overview', () => getCoreOverview());
ipcMain.handle('workspace:create', (_event, input: WorkspaceCreateInput) => createWorkspace(input));
ipcMain.handle('workspace:list', () => listWorkspaces());
ipcMain.handle('workspace:get', (_event, id: string) => getWorkspace(id));
ipcMain.handle('workspace:deleteMetadata', (_event, id: string) => deleteWorkspaceMetadata(id));
ipcMain.handle('task:create', (_event, input: TaskCreateInput) => createTask(input));
ipcMain.handle('task:list', (_event, workspaceId?: string) => listTasks(workspaceId));
ipcMain.handle('task:get', (_event, id: string) => getTask(id));
ipcMain.handle('task:updateStatus', (_event, id: string, input: TaskStatusUpdateInput) => updateTaskStatus(id, input.status));
ipcMain.handle('run:create', (_event, input: RunCreateInput) => createRun(input));
ipcMain.handle('run:list', (_event, taskId?: string) => listRuns(taskId));
ipcMain.handle('run:get', (_event, id: string) => getRun(id));
ipcMain.handle('event:list', (_event, limit?: number) => listEvents(limit));

ipcMain.on('shell:setPage', (_event, page: ShellPage) => {
  currentShellPage = page;
  if (page === 'runtime') {
    hideHarnessView();
  } else if (getRuntimeStatus().status === 'RUNNING') {
    showHarnessView();
  }
});

ipcMain.handle('shell:getFloatingPosition', () => ({ ...floatingPosition }));

ipcMain.on('shell:setFloatingPosition', (_event, position: FloatingPosition) => {
  if (!Number.isFinite(position.right) || !Number.isFinite(position.bottom)) return;
  floatingPosition = {
    right: Math.max(FLOATING_EDGE_GAP, position.right),
    bottom: Math.max(FLOATING_EDGE_GAP, position.bottom),
  };
  updateFloatingBounds();
});

ipcMain.on('shell:beginFloatingDrag', () => {
  stopFloatingDrag();
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const cursor = screen.getCursorScreenPoint();
  floatingDragOrigin = {
    cursorX: cursor.x,
    cursorY: cursor.y,
    position: { ...floatingPosition },
  };
  floatingDragTimer = setInterval(updateFloatingDrag, 16);
  updateFloatingDrag();
});

ipcMain.on('shell:endFloatingDrag', () => {
  stopFloatingDrag();
});

ipcMain.on('shell:toggleControlCenter', () => {
  setControlCenterState(controlCenterState === 'OPEN' ? 'CLOSED' : 'OPEN');
});

ipcMain.handle('shell:getControlCenterState', () => controlCenterState);
ipcMain.on('shell:setControlCenterWidth', (_event, width: number) => {
  setControlCenterWidth(width, false);
});
ipcMain.handle('shell:saveControlCenterWidth', (_event, width: number) => (
  setControlCenterWidth(width, true)
));

let lastProjectedRuntimeStatus: string | null = null;

onDshStatusChanged((info) => {
  recordRuntimeStatus(info);
  if (lastProjectedRuntimeStatus !== info.status) {
    lastProjectedRuntimeStatus = info.status;
    try {
      recordEvent({
        source: 'runtime',
        type: 'runtime.statusChanged',
        payload: {
          status: info.status,
          pid: info.pid,
          url: info.url,
          error: info.error,
        },
        nativeId: info.pid ? String(info.pid) : undefined,
      });
    } catch (error) {
      console.warn(`RookieDSH: failed to persist runtime event (${String(error)}).`);
    }
  }
  broadcastRuntimeStatus(info);

  if (info.status === 'RUNNING' && currentShellPage === 'harness') showHarnessView();
  if (info.status === 'STOPPED' || info.status === 'FAILED') {
    harnessNeedsReload = true;
    hideHarnessView();
  }
});

function bootstrap(): void {
  const config = getConfig();
  const win = createMainWindow(config);
  if (!config.runtime.autoStart) return;

  void startRuntime().then(() => {
    if (isQuitting || win.isDestroyed()) return;
    createHarnessView();
    if (getRuntimeStatus().status === 'RUNNING' && currentShellPage === 'harness') showHarnessView();
  }).catch((error: unknown) => {
    console.error('Harness runtime failed to start:', error);
    if (!win.isDestroyed()) win.focus();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  void bootstrap();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;
function requestQuit(): void {
  if (isQuitting) return;

  isQuitting = true;
  disposeEmbeddedViews();
  void stopRuntime().finally(() => app.quit());
}

app.on('before-quit', (event) => {
  if (isQuitting) return;

  event.preventDefault();
  requestQuit();
});

process.on('SIGINT', requestQuit);
process.on('SIGTERM', requestQuit);
process.on('exit', cleanupDshSync);

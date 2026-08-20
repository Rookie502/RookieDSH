import { app, BrowserView, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import path from 'node:path';
import type { FloatingPosition, ShellPage } from '@shared/types';
import {
  cleanupDshSync,
  getDshLogs,
  getDshState,
  onDshStatusChanged,
  startDsh,
  stopDsh,
} from './runtime/dshProcess';

const isDev = !app.isPackaged;
const HARNESS_URL = 'http://localhost:3080';
const DEV_SERVER_URL = process.env.ROOKIE_DSH_DEV_SERVER_URL ?? 'http://localhost:5173';
const STARTUP_STARTED_AT = Number(process.env.ROOKIE_DSH_DEV_STARTED_AT) || Date.now();
const FLOATING_EDGE_GAP = 16;
const FLOATING_BUTTON_SIZE = 56;
const FLOATING_VIEW_SIZE = FLOATING_BUTTON_SIZE;
const FLOATING_PANEL_WIDTH = 280;

let mainWindow: BrowserWindow | null = null;
let harnessView: BrowserView | null = null;
let floatingView: BrowserView | null = null;
let harnessAttached = false;
let floatingAttached = false;
let harnessNeedsReload = true;
let currentShellPage: ShellPage = 'harness';
let floatingPanelOpen = false;
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

function updateHarnessBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !harnessView || harnessView.webContents.isDestroyed()) return;

  const { width, height } = mainWindow.getContentBounds();
  const settingsWidth = floatingPanelOpen ? FLOATING_PANEL_WIDTH : 0;
  harnessView.setBounds({
    x: 0,
    y: 0,
    width: Math.max(0, width - settingsWidth),
    height,
  });
}

function updateFloatingBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !floatingView || floatingView.webContents.isDestroyed()) return;

  const { width, height } = mainWindow.getContentBounds();
  if (floatingPanelOpen) {
    floatingView.setBounds({
      x: Math.max(0, width - FLOATING_PANEL_WIDTH),
      y: 0,
      width: Math.min(FLOATING_PANEL_WIDTH, width),
      height,
    });
    return;
  }

  const viewWidth = FLOATING_VIEW_SIZE;
  const viewHeight = FLOATING_VIEW_SIZE;
  floatingView.setBounds({
    x: Math.max(0, width - floatingPosition.right - viewWidth),
    y: Math.max(0, height - floatingPosition.bottom - viewHeight),
    width: viewWidth,
    height: viewHeight,
  });
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

function showHarnessView(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !harnessView || harnessView.webContents.isDestroyed()) return;
  if (harnessNeedsReload) {
    harnessNeedsReload = false;
    void harnessView.webContents.loadURL(HARNESS_URL).catch((error: unknown) => {
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
    harnessAttached = false;
    floatingAttached = false;
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
    if (!url.startsWith(HARNESS_URL)) event.preventDefault();
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

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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
  win.webContents.on('did-finish-load', () => {
    console.log(`ROOKIE_DSH_METRIC electron-ready-ms=${Date.now() - STARTUP_STARTED_AT}`);
  });
  win.on('resize', () => {
    updateHarnessBounds();
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
  await startDsh();
});

ipcMain.handle('runtime:stop', async () => {
  await stopDsh();
});

ipcMain.handle('runtime:getStatus', () => getDshState());
ipcMain.handle('runtime:getLogs', () => getDshLogs());

ipcMain.on('shell:setPage', (_event, page: ShellPage) => {
  currentShellPage = page;
  if (page === 'runtime') {
    hideHarnessView();
  } else if (getDshState().status === 'RUNNING') {
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

ipcMain.on('shell:setFloatingPanelOpen', (_event, open: boolean) => {
  floatingPanelOpen = open;
  updateHarnessBounds();
  updateFloatingBounds();
});

onDshStatusChanged((info) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('runtime:statusChanged', info);
  }

  if (info.status === 'RUNNING' && currentShellPage === 'harness') showHarnessView();
  if (info.status === 'STOPPED' || info.status === 'FAILED') {
    harnessNeedsReload = true;
    hideHarnessView();
  }
});

function bootstrap(): void {
  const win = createMainWindow();
  void startDsh().then(() => {
    if (isQuitting || win.isDestroyed()) return;
    createHarnessView();
    if (getDshState().status === 'RUNNING' && currentShellPage === 'harness') showHarnessView();
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
  void stopDsh().finally(() => app.quit());
}

app.on('before-quit', (event) => {
  if (isQuitting) return;

  event.preventDefault();
  requestQuit();
});

process.on('SIGINT', requestQuit);
process.on('SIGTERM', requestQuit);
process.on('exit', cleanupDshSync);

import { contextBridge, ipcRenderer } from 'electron';
import type {
  FloatingPosition,
  RookieDshApi,
  RuntimeInfo,
  RuntimeLogEntry,
  ShellPage,
} from '@shared/types';

const api: RookieDshApi = {
  get appVersion() {
    return '0.1.0';
  },
  runtime: {
    start: () => ipcRenderer.invoke('runtime:start') as Promise<void>,
    stop: () => ipcRenderer.invoke('runtime:stop') as Promise<void>,
    getStatus: () => ipcRenderer.invoke('runtime:getStatus') as Promise<RuntimeInfo>,
    getLogs: () => ipcRenderer.invoke('runtime:getLogs') as Promise<RuntimeLogEntry[]>,
    onStatusChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, info: RuntimeInfo) => listener(info);
      ipcRenderer.on('runtime:statusChanged', handler);
      return () => ipcRenderer.removeListener('runtime:statusChanged', handler);
    },
  },
  shell: {
    setPage: (page: ShellPage) => { ipcRenderer.send('shell:setPage', page); },
    getFloatingPosition: () => ipcRenderer.invoke('shell:getFloatingPosition') as Promise<FloatingPosition>,
    setFloatingPosition: (position: FloatingPosition) => { ipcRenderer.send('shell:setFloatingPosition', position); },
    beginFloatingDrag: () => { ipcRenderer.send('shell:beginFloatingDrag'); },
    endFloatingDrag: () => { ipcRenderer.send('shell:endFloatingDrag'); },
    setFloatingPanelOpen: (open: boolean) => { ipcRenderer.send('shell:setFloatingPanelOpen', open); },
  },
};

contextBridge.exposeInMainWorld('rookiedsh', api);

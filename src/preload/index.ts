import { contextBridge, ipcRenderer } from 'electron';
import type { RookieDshConfig } from '@shared/configTypes';
import type {
  CoreOverview,
  ControlCenterState,
  FloatingPosition,
  RookieDshApi,
  Run,
  RunCreateInput,
  Task,
  TaskCreateInput,
  TaskStatusUpdateInput,
  RuntimeInfo,
  RuntimeDiagnostics,
  RuntimeLogEntry,
  ShellPage,
  Workspace,
  WorkspaceCreateInput,
} from '@shared/types';

const api: RookieDshApi = {
  get appVersion() {
    return '0.3.2';
  },
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<RookieDshConfig>,
  },
  runtime: {
    start: () => ipcRenderer.invoke('runtime:start') as Promise<void>,
    stop: () => ipcRenderer.invoke('runtime:stop') as Promise<void>,
    getStatus: () => ipcRenderer.invoke('runtime:getStatus') as Promise<RuntimeInfo>,
    getLogs: () => ipcRenderer.invoke('runtime:getLogs') as Promise<RuntimeLogEntry[]>,
    getDiagnostics: () => ipcRenderer.invoke('runtime:getDiagnostics') as Promise<RuntimeDiagnostics>,
    onStatusChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, info: RuntimeInfo) => listener(info);
      ipcRenderer.on('runtime:statusChanged', handler);
      return () => ipcRenderer.removeListener('runtime:statusChanged', handler);
    },
  },
  core: {
    getOverview: () => ipcRenderer.invoke('core:overview') as Promise<CoreOverview>,
    workspaces: {
      create: (input: WorkspaceCreateInput) => ipcRenderer.invoke('workspace:create', input) as Promise<Workspace>,
      list: () => ipcRenderer.invoke('workspace:list') as Promise<Workspace[]>,
      get: (id: string) => ipcRenderer.invoke('workspace:get', id) as Promise<Workspace | null>,
      deleteMetadata: (id: string) => ipcRenderer.invoke('workspace:deleteMetadata', id) as Promise<boolean>,
    },
    tasks: {
      create: (input: TaskCreateInput) => ipcRenderer.invoke('task:create', input) as Promise<Task>,
      list: (workspaceId?: string) => ipcRenderer.invoke('task:list', workspaceId) as Promise<Task[]>,
      get: (id: string) => ipcRenderer.invoke('task:get', id) as Promise<Task | null>,
      updateStatus: (id: string, input: TaskStatusUpdateInput) => ipcRenderer.invoke('task:updateStatus', id, input) as Promise<Task>,
    },
    runs: {
      create: (input: RunCreateInput) => ipcRenderer.invoke('run:create', input) as Promise<Run>,
      list: (taskId?: string) => ipcRenderer.invoke('run:list', taskId) as Promise<Run[]>,
      get: (id: string) => ipcRenderer.invoke('run:get', id) as Promise<Run | null>,
    },
    events: {
      list: (limit?: number) => ipcRenderer.invoke('event:list', limit) as Promise<import('@shared/coreTypes').CoreEvent[]>,
    },
  },
  shell: {
    setPage: (page: ShellPage) => { ipcRenderer.send('shell:setPage', page); },
    getFloatingPosition: () => ipcRenderer.invoke('shell:getFloatingPosition') as Promise<FloatingPosition>,
    setFloatingPosition: (position: FloatingPosition) => { ipcRenderer.send('shell:setFloatingPosition', position); },
    beginFloatingDrag: () => { ipcRenderer.send('shell:beginFloatingDrag'); },
    endFloatingDrag: () => { ipcRenderer.send('shell:endFloatingDrag'); },
    toggleControlCenter: () => { ipcRenderer.send('shell:toggleControlCenter'); },
    getControlCenterState: () => ipcRenderer.invoke('shell:getControlCenterState') as Promise<ControlCenterState>,
    setControlCenterWidth: (width: number) => { ipcRenderer.send('shell:setControlCenterWidth', width); },
    saveControlCenterWidth: (width: number) => ipcRenderer.invoke('shell:saveControlCenterWidth', width) as Promise<number>,
    onControlCenterStateChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ControlCenterState) => listener(state);
      ipcRenderer.on('shell:controlCenterStateChanged', handler);
      return () => ipcRenderer.removeListener('shell:controlCenterStateChanged', handler);
    },
  },
};

contextBridge.exposeInMainWorld('rookiedsh', api);

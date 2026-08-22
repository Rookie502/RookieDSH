import { contextBridge, ipcRenderer } from 'electron';
import type { Language, RookieDshConfig, UpdateConfig } from '@shared/configTypes';
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
  DshCapabilitySet,
  DshCredentialStatus,
  DshProviderModelGroup,
  DshProviderSnapshot,
  RuntimeBindingInput,
  RuntimeModelBinding,
  ModelEndpoint,
  ModelEndpointInput,
  RuntimeInstance,
  RuntimeVersionInfo,
  RuntimeUpdateProgress,
  RuntimeUpdateResult,
  UpdateHistory,
  UpdateStatus,
  ShellPage,
  WorkspaceBindingInput,
  Workspace,
  WorkspaceCreateInput,
} from '@shared/types';

const api: RookieDshApi = {
  get appVersion() {
    return '0.5.2';
  },
  config: {
    get: () => ipcRenderer.invoke('config:get') as Promise<RookieDshConfig>,
    setLanguage: (language: Language) => ipcRenderer.invoke('config:setLanguage', language) as Promise<Language>,
    setUpdatePreferences: (config: UpdateConfig) => ipcRenderer.invoke('config:setUpdatePreferences', config) as Promise<UpdateConfig>,
  },
  runtime: {
    start: () => ipcRenderer.invoke('runtime:start') as Promise<void>,
    stop: () => ipcRenderer.invoke('runtime:stop') as Promise<void>,
    getStatus: () => ipcRenderer.invoke('runtime:getStatus') as Promise<RuntimeInfo>,
    getLogs: () => ipcRenderer.invoke('runtime:getLogs') as Promise<RuntimeLogEntry[]>,
    getDiagnostics: () => ipcRenderer.invoke('runtime:getDiagnostics') as Promise<RuntimeDiagnostics>,
    getCapabilities: () => ipcRenderer.invoke('runtime:getCapabilities') as Promise<DshCapabilitySet>,
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
      bind: (id: string, input: WorkspaceBindingInput) => ipcRenderer.invoke('workspace:bind', id, input) as Promise<Workspace>,
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
  models: {
    list: () => ipcRenderer.invoke('models:list') as Promise<ModelEndpoint[]>,
    add: (input: ModelEndpointInput) => ipcRenderer.invoke('models:add', input) as Promise<ModelEndpoint>,
    remove: (id: string) => ipcRenderer.invoke('models:remove', id) as Promise<boolean>,
    check: (id: string) => ipcRenderer.invoke('models:check', id) as Promise<ModelEndpoint>,
    discover: (id: string) => ipcRenderer.invoke('models:discover', id) as Promise<ModelEndpoint>,
  },
  runtimeProviders: {
    list: (force = false) => ipcRenderer.invoke('runtimeProviders:list', force) as Promise<DshProviderSnapshot>,
    refresh: () => ipcRenderer.invoke('runtimeProviders:refresh') as Promise<DshProviderSnapshot>,
    getModels: (provider?: string) => ipcRenderer.invoke('runtimeProviders:getModels', provider) as Promise<DshProviderModelGroup[]>,
    discover: (input: { settingsNs: string; provider?: string; baseURL?: string; api?: string }) => ipcRenderer.invoke('runtimeProviders:discover', input) as Promise<Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number }>>,
    getCredentialStatus: (refs: string[]) => ipcRenderer.invoke('runtimeProviders:getCredentialStatus', refs) as Promise<Record<string, DshCredentialStatus>>,
    import: (providerId: string) => ipcRenderer.invoke('runtimeProviders:import', providerId) as Promise<ModelEndpoint>,
    bind: (input: RuntimeBindingInput) => ipcRenderer.invoke('runtimeProviders:bind', input) as Promise<RuntimeModelBinding>,
    unbind: (bindingId: string) => ipcRenderer.invoke('runtimeProviders:unbind', bindingId) as Promise<boolean>,
    setCredential: (ref: string, value: string) => ipcRenderer.invoke('runtimeProviders:setCredential', ref, value) as Promise<DshCredentialStatus>,
  },
  runtimes: {
    list: () => ipcRenderer.invoke('runtime:list') as Promise<RuntimeInstance[]>,
    checkVersion: () => ipcRenderer.invoke('runtime:checkVersion') as Promise<RuntimeVersionInfo>,
  },
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:getStatus') as Promise<UpdateStatus>,
    check: () => ipcRenderer.invoke('updates:check') as Promise<UpdateStatus>,
    updateRuntime: () => ipcRenderer.invoke('updates:updateRuntime') as Promise<RuntimeUpdateResult>,
    getHistory: () => ipcRenderer.invoke('updates:getHistory') as Promise<UpdateHistory[]>,
    getProgress: () => ipcRenderer.invoke('updates:getProgress') as Promise<RuntimeUpdateProgress>,
    onProgressChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: RuntimeUpdateProgress) => listener(progress);
      ipcRenderer.on('updates:progressChanged', handler);
      return () => ipcRenderer.removeListener('updates:progressChanged', handler);
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

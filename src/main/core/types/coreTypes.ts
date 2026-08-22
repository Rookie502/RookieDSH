import type {
  CoreEvent,
  CoreEventInput,
  CoreMetadata,
  CoreOverview,
  Run,
  RunCreateInput,
  RunStatus,
  RuntimeType,
  Task,
  TaskCreateInput,
  TaskStatus,
  TaskStatusUpdateInput,
  Workspace,
  WorkspaceBindingInput,
  WorkspaceCreateInput,
} from '@shared/coreTypes';

export type {
  CoreEvent,
  CoreEventInput,
  CoreMetadata,
  CoreOverview,
  Run,
  RunCreateInput,
  RunStatus,
  RuntimeType,
  Task,
  TaskCreateInput,
  TaskStatus,
  TaskStatusUpdateInput,
  Workspace,
  WorkspaceBindingInput,
  WorkspaceCreateInput,
};

export interface CoreDatabaseDocument {
  storageFormat: 'json-v1';
  schemaVersion: number;
  workspaces: Workspace[];
  tasks: Task[];
  runs: Run[];
  events: CoreEvent[];
  runtimeInstances: import('@shared/runtimeRegistryTypes').RuntimeInstance[];
  modelEndpoints: import('@shared/modelTypes').ModelEndpoint[];
  softwareVersions: import('@shared/updateTypes').SoftwareVersion[];
  updateChecks: import('@shared/updateTypes').UpdateCheck[];
  updateHistory: import('@shared/updateTypes').UpdateHistory[];
  runtimeModelBindings: import('@shared/runtimeBindingTypes').RuntimeModelBinding[];
}

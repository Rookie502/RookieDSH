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
  WorkspaceCreateInput,
};

export interface CoreDatabaseDocument {
  storageFormat: 'json-v1';
  schemaVersion: 1;
  workspaces: Workspace[];
  tasks: Task[];
  runs: Run[];
  events: CoreEvent[];
}

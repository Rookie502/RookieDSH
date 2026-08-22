export type CoreMetadata = Record<string, string | number | boolean | null>;

export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  metadata: CoreMetadata;
  runtimeId?: string | null;
  modelEndpointId?: string | null;
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = 'CREATED' | 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
export type RuntimeType = 'dsh' | 'codex' | 'future';

export interface Run {
  id: string;
  taskId: string;
  runtimeId?: string;
  status: RunStatus;
  runtimeType: RuntimeType;
  nativeRuntimeId?: string;
  startedAt: string | null;
  endedAt: string | null;
  error?: string;
}

export type CoreEventSource = 'rookiedsh' | 'runtime' | 'adapter';

export interface CoreEvent {
  id: string;
  source: CoreEventSource;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  nativeId?: string;
}

export interface CoreOverview {
  workspaceCount: number;
  activeRunCount: number;
  completedTaskCount: number;
  latestEvent: CoreEvent | null;
}

export interface WorkspaceCreateInput {
  name: string;
  path: string;
  metadata?: CoreMetadata;
}

export interface WorkspaceBindingInput {
  runtimeId?: string | null;
  modelEndpointId?: string | null;
}

export interface TaskCreateInput {
  workspaceId: string;
  title: string;
  description?: string;
}

export interface RunCreateInput {
  taskId: string;
  runtimeId?: string;
  runtimeType: RuntimeType;
  nativeRuntimeId?: string;
}

export interface TaskStatusUpdateInput {
  status: TaskStatus;
}

export interface CoreEventInput {
  source: CoreEventSource;
  type: string;
  payload: Record<string, unknown>;
  nativeId?: string;
}

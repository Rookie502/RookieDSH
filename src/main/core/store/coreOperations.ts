import type {
  CoreEvent,
  CoreEventInput,
  CoreOverview,
  Run,
  RunCreateInput,
  Task,
  TaskCreateInput,
  TaskStatus,
  Workspace,
  WorkspaceBindingInput,
  WorkspaceCreateInput,
} from '@shared/coreTypes';
import type { CoreDatabaseDocument } from '../types/coreTypes';

const CORE_EVENT_LIMIT = 5_000;
const TASK_STATUSES: readonly TaskStatus[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];
const RUNTIME_TYPES: readonly RunCreateInput['runtimeType'][] = ['dsh', 'codex', 'future'];

export function createWorkspaceRecord(
  database: CoreDatabaseDocument,
  input: WorkspaceCreateInput,
  id: string,
  timestamp: string,
): Workspace {
  const name = input.name.trim();
  const workspacePath = input.path.trim();
  if (!name) throw new Error('Workspace name is required.');
  if (!workspacePath) throw new Error('Workspace path is required.');

  const workspace: Workspace = {
    id,
    name,
    path: workspacePath,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: input.metadata ?? {},
  };
  database.workspaces.push(workspace);
  return workspace;
}

export function deleteWorkspaceRecord(database: CoreDatabaseDocument, id: string): boolean {
  const index = database.workspaces.findIndex((workspace) => workspace.id === id);
  if (index < 0) return false;
  database.workspaces.splice(index, 1);
  return true;
}

export function bindWorkspaceRecord(
  database: CoreDatabaseDocument,
  id: string,
  input: WorkspaceBindingInput,
  timestamp: string,
): Workspace {
  const workspace = database.workspaces.find((candidate) => candidate.id === id);
  if (!workspace) throw new Error(`Workspace not found: ${id}`);
  if (input.runtimeId !== undefined && input.runtimeId !== null
    && !database.runtimeInstances.some((runtime) => runtime.id === input.runtimeId)) {
    throw new Error(`Runtime not found: ${input.runtimeId}`);
  }
  if (input.modelEndpointId !== undefined && input.modelEndpointId !== null
    && !database.modelEndpoints.some((endpoint) => endpoint.id === input.modelEndpointId)) {
    throw new Error(`Model endpoint not found: ${input.modelEndpointId}`);
  }
  if (input.runtimeId !== undefined) workspace.runtimeId = input.runtimeId;
  if (input.modelEndpointId !== undefined) workspace.modelEndpointId = input.modelEndpointId;
  workspace.updatedAt = timestamp;
  return workspace;
}

export function createTaskRecord(
  database: CoreDatabaseDocument,
  input: TaskCreateInput,
  id: string,
  timestamp: string,
): Task {
  if (!database.workspaces.some((workspace) => workspace.id === input.workspaceId)) {
    throw new Error(`Workspace not found: ${input.workspaceId}`);
  }
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required.');

  const task: Task = {
    id,
    workspaceId: input.workspaceId,
    title,
    description: input.description?.trim() ?? '',
    status: 'PENDING',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  database.tasks.push(task);
  return task;
}

export function updateTaskStatusRecord(
  database: CoreDatabaseDocument,
  id: string,
  status: TaskStatus,
  timestamp: string,
): Task {
  if (!TASK_STATUSES.includes(status)) throw new Error(`Unsupported task status: ${status}`);
  const task = database.tasks.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`Task not found: ${id}`);
  task.status = status;
  task.updatedAt = timestamp;
  return task;
}

export function createRunRecord(
  database: CoreDatabaseDocument,
  input: RunCreateInput,
  id: string,
): Run {
  if (!RUNTIME_TYPES.includes(input.runtimeType)) throw new Error(`Unsupported runtime type: ${input.runtimeType}`);
  if (!database.tasks.some((task) => task.id === input.taskId)) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  const run: Run = {
    id,
    taskId: input.taskId,
    runtimeId: input.runtimeId,
    status: 'CREATED',
    runtimeType: input.runtimeType,
    nativeRuntimeId: input.nativeRuntimeId,
    startedAt: null,
    endedAt: null,
  };
  database.runs.push(run);
  return run;
}

export function createEventRecord(
  database: CoreDatabaseDocument,
  input: CoreEventInput,
  id: string,
  timestamp: string,
): CoreEvent {
  const event: CoreEvent = {
    id,
    source: input.source,
    type: input.type,
    timestamp,
    payload: input.payload,
    nativeId: input.nativeId,
  };
  database.events.push(event);
  if (database.events.length > CORE_EVENT_LIMIT) {
    database.events.splice(0, database.events.length - CORE_EVENT_LIMIT);
  }
  return event;
}

export function getOverview(database: CoreDatabaseDocument): CoreOverview {
  const activeStatuses = new Set(['RUNNING', 'WAITING_APPROVAL']);
  return {
    workspaceCount: database.workspaces.length,
    activeRunCount: database.runs.filter((run) => activeStatuses.has(run.status)).length,
    completedTaskCount: database.tasks.filter((task) => task.status === 'COMPLETED').length,
    latestEvent: database.events.length > 0 ? database.events[database.events.length - 1] : null,
  };
}

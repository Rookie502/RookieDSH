import { randomUUID } from 'node:crypto';
import type { Task, TaskCreateInput, TaskStatus } from '@shared/coreTypes';
import { createTaskRecord, updateTaskStatusRecord } from '../store/coreOperations';
import { getCoreSnapshot, updateCoreSnapshot } from '../store/coreStore';

export function listTasks(workspaceId?: string): Task[] {
  const tasks = getCoreSnapshot().tasks;
  return workspaceId ? tasks.filter((task) => task.workspaceId === workspaceId) : tasks;
}

export function getTask(id: string): Task | null {
  return getCoreSnapshot().tasks.find((task) => task.id === id) ?? null;
}

export function createTask(input: TaskCreateInput): Task {
  let created: Task | null = null;
  updateCoreSnapshot((database) => {
    created = createTaskRecord(database, input, randomUUID(), new Date().toISOString());
  });
  if (!created) throw new Error('Task creation did not produce a record.');
  return created;
}

export function updateTaskStatus(id: string, status: TaskStatus): Task {
  let updated: Task | null = null;
  updateCoreSnapshot((database) => {
    updated = updateTaskStatusRecord(database, id, status, new Date().toISOString());
  });
  if (!updated) throw new Error('Task status update did not produce a record.');
  return updated;
}

import { randomUUID } from 'node:crypto';
import type { Workspace, WorkspaceBindingInput, WorkspaceCreateInput } from '@shared/coreTypes';
import { bindWorkspaceRecord, createWorkspaceRecord, deleteWorkspaceRecord } from '../store/coreOperations';
import { getCoreSnapshot, updateCoreSnapshot } from '../store/coreStore';

export function listWorkspaces(): Workspace[] {
  return getCoreSnapshot().workspaces;
}

export function getWorkspace(id: string): Workspace | null {
  return getCoreSnapshot().workspaces.find((workspace) => workspace.id === id) ?? null;
}

export function createWorkspace(input: WorkspaceCreateInput): Workspace {
  let created: Workspace | null = null;
  updateCoreSnapshot((database) => {
    created = createWorkspaceRecord(database, input, randomUUID(), new Date().toISOString());
  });
  if (!created) throw new Error('Workspace creation did not produce a record.');
  return created;
}

/** Removes only the RookieDSH registry record; it never deletes the real folder. */
export function deleteWorkspaceMetadata(id: string): boolean {
  let deleted = false;
  updateCoreSnapshot((database) => {
    deleted = deleteWorkspaceRecord(database, id);
  });
  return deleted;
}

export function bindWorkspace(id: string, input: WorkspaceBindingInput): Workspace {
  let updated: Workspace | null = null;
  updateCoreSnapshot((database) => {
    updated = bindWorkspaceRecord(database, id, input, new Date().toISOString());
  });
  if (!updated) throw new Error('Workspace binding did not produce a record.');
  return updated;
}

import { randomUUID } from 'node:crypto';
import type { Run, RunCreateInput } from '@shared/coreTypes';
import { createRunRecord } from '../store/coreOperations';
import { getCoreSnapshot, updateCoreSnapshot } from '../store/coreStore';

export function listRuns(taskId?: string): Run[] {
  const runs = getCoreSnapshot().runs;
  return taskId ? runs.filter((run) => run.taskId === taskId) : runs;
}

export function getRun(id: string): Run | null {
  return getCoreSnapshot().runs.find((run) => run.id === id) ?? null;
}

export function createRun(input: RunCreateInput): Run {
  let created: Run | null = null;
  updateCoreSnapshot((database) => {
    created = createRunRecord(database, input, randomUUID());
  });
  if (!created) throw new Error('Run creation did not produce a record.');
  return created;
}

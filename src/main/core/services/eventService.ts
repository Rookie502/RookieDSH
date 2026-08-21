import { randomUUID } from 'node:crypto';
import type { CoreEvent, CoreEventInput } from '@shared/coreTypes';
import { createEventRecord, getOverview } from '../store/coreOperations';
import { getCoreSnapshot, updateCoreSnapshot } from '../store/coreStore';

export function listEvents(limit = 50): CoreEvent[] {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return getCoreSnapshot().events.slice(-safeLimit).reverse();
}

export function recordEvent(input: CoreEventInput): CoreEvent {
  let created: CoreEvent | null = null;
  updateCoreSnapshot((database) => {
    created = createEventRecord(database, input, randomUUID(), new Date().toISOString());
  });
  if (!created) throw new Error('Event creation did not produce a record.');
  return created;
}

export function getCoreOverview() {
  return getOverview(getCoreSnapshot());
}

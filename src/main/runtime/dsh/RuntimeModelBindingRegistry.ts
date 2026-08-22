import { randomUUID } from 'node:crypto';
import type { RuntimeModelBinding, RuntimeModelBindingStatus } from '@shared/runtimeBindingTypes';
import { getCoreSnapshot, updateCoreSnapshot } from '../../core/store/coreStore';

export function listRuntimeModelBindings(): RuntimeModelBinding[] {
  return getCoreSnapshot().runtimeModelBindings;
}

export function saveRuntimeModelBinding(input: {
  runtimeId: string;
  endpointId: string;
  nativeProviderId: string;
  modelId: string;
  status?: RuntimeModelBindingStatus;
  lastError?: string | null;
}): RuntimeModelBinding {
  const timestamp = new Date().toISOString();
  let saved: RuntimeModelBinding | null = null;
  updateCoreSnapshot((database) => {
    const existing = database.runtimeModelBindings.find((binding) => (
      binding.runtimeId === input.runtimeId
      && binding.endpointId === input.endpointId
      && binding.nativeProviderId === input.nativeProviderId
      && binding.modelId === input.modelId
    ));
    const next: RuntimeModelBinding = existing ?? {
      id: randomUUID(),
      runtimeId: input.runtimeId,
      endpointId: input.endpointId,
      nativeProviderId: input.nativeProviderId,
      modelId: input.modelId,
      status: 'UNBOUND',
      lastSyncedAt: null,
      lastError: null,
    };
    next.status = input.status ?? 'SYNCED';
    next.lastError = input.lastError ?? null;
    next.lastSyncedAt = next.status === 'SYNCED' ? timestamp : next.lastSyncedAt;
    if (!existing) database.runtimeModelBindings.push(next);
    saved = next;
  });
  if (!saved) throw new Error('Runtime model binding was not saved.');
  return saved;
}

export function removeRuntimeModelBinding(id: string): boolean {
  let removed = false;
  updateCoreSnapshot((database) => {
    const index = database.runtimeModelBindings.findIndex((binding) => binding.id === id);
    if (index < 0) return;
    database.runtimeModelBindings.splice(index, 1);
    removed = true;
  });
  return removed;
}

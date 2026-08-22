import type { ModelEndpointStatus, ModelResourceState } from '@shared/modelTypes';

/** A successful endpoint probe is trusted for one minute. The renderer may
 * refresh more often while visible, but old persisted results are never
 * presented as currently online. */
export const MODEL_ENDPOINT_HEALTH_TTL_MS = 60_000;

export type ModelEndpointKnownStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export function deriveEndpointStatus(
  lastKnownStatus: ModelEndpointKnownStatus,
  lastCheckedAt: string | null,
  now = Date.now(),
  ttlMs = MODEL_ENDPOINT_HEALTH_TTL_MS,
): ModelEndpointStatus {
  if (!lastCheckedAt) return lastKnownStatus === 'OFFLINE' ? 'OFFLINE' : 'UNKNOWN';
  const checkedAt = Date.parse(lastCheckedAt);
  if (!Number.isFinite(checkedAt) || now - checkedAt > ttlMs) return 'STALE';
  return lastKnownStatus;
}

export function normalizeKnownStatus(value: unknown): ModelEndpointKnownStatus {
  return value === 'ONLINE' || value === 'OFFLINE' ? value : 'UNKNOWN';
}

export function createDiscoveredModelStates(models: string[]): Record<string, ModelResourceState> {
  return Object.fromEntries(models.map((model) => [model, 'DISCOVERED']));
}

export function getModelResourceState(states: Record<string, ModelResourceState>, model: string): ModelResourceState {
  return states[model] ?? 'DISCOVERED';
}

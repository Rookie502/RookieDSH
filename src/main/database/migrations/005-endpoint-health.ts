import type { CoreDatabaseDocument } from '../../core/types/coreTypes';
import type { ModelEndpoint } from '@shared/modelTypes';
import { createDiscoveredModelStates, normalizeKnownStatus } from '../../models/endpointHealth';

export const ENDPOINT_HEALTH_SCHEMA_VERSION = 5;

/** Adds endpoint probe freshness metadata without discarding cached models. */
export function migrateToEndpointHealthSchema(
  database: Omit<CoreDatabaseDocument, 'schemaVersion'> & { schemaVersion: number },
): CoreDatabaseDocument {
  return {
    ...database,
    schemaVersion: ENDPOINT_HEALTH_SCHEMA_VERSION,
    modelEndpoints: database.modelEndpoints.map((endpoint) => {
      const legacyEndpoint = endpoint as ModelEndpoint & {
        lastKnownStatus?: unknown;
        lastSuccessAt?: unknown;
        lastError?: unknown;
        modelStates?: unknown;
        supportsLoadedModelQuery?: unknown;
      };
      const lastKnownStatus = normalizeKnownStatus(
        legacyEndpoint.lastKnownStatus ?? endpoint.status,
      );
      const lastError = typeof legacyEndpoint.lastError === 'string'
        ? legacyEndpoint.lastError
        : endpoint.error;
      return {
        ...endpoint,
        lastKnownStatus,
        modelStates: normalizeModelStates(legacyEndpoint.modelStates, endpoint.models),
        supportsLoadedModelQuery: typeof legacyEndpoint.supportsLoadedModelQuery === 'boolean'
          ? legacyEndpoint.supportsLoadedModelQuery
          : false,
        lastSuccessAt: typeof legacyEndpoint.lastSuccessAt === 'string'
          ? legacyEndpoint.lastSuccessAt
          : lastKnownStatus === 'ONLINE' ? endpoint.lastCheckedAt : null,
        lastError,
      };
    }),
  };
}

function normalizeModelStates(value: unknown, models: string[]): Record<string, import('@shared/modelTypes').ModelResourceState> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const result: Record<string, import('@shared/modelTypes').ModelResourceState> = {};
    for (const [model, state] of Object.entries(value)) {
      if (state === 'DISCOVERED' || state === 'AVAILABLE' || state === 'LOADED' || state === 'UNKNOWN') result[model] = state;
    }
    for (const model of models) result[model] ??= 'DISCOVERED';
    return result;
  }
  return createDiscoveredModelStates(models);
}

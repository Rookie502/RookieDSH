import type { CoreDatabaseDocument } from '../../core/types/coreTypes';

export const RESOURCE_SCHEMA_VERSION = 2;

/** Adds resource registries while preserving all v1 control-plane records. */
export function migrateToResourceSchema(database: Omit<CoreDatabaseDocument, 'schemaVersion' | 'runtimeInstances' | 'modelEndpoints' | 'softwareVersions' | 'updateChecks' | 'runtimeModelBindings'> & {
  schemaVersion: number;
  runtimeInstances?: CoreDatabaseDocument['runtimeInstances'];
  modelEndpoints?: CoreDatabaseDocument['modelEndpoints'];
  softwareVersions?: CoreDatabaseDocument['softwareVersions'];
  updateChecks?: CoreDatabaseDocument['updateChecks'];
  runtimeModelBindings?: CoreDatabaseDocument['runtimeModelBindings'];
}): CoreDatabaseDocument {
  return {
    storageFormat: 'json-v1',
    schemaVersion: RESOURCE_SCHEMA_VERSION,
    workspaces: database.workspaces,
    tasks: database.tasks,
    runs: database.runs,
    events: database.events,
    runtimeInstances: database.runtimeInstances ?? [],
    modelEndpoints: database.modelEndpoints ?? [],
    softwareVersions: database.softwareVersions ?? [],
    updateChecks: database.updateChecks ?? [],
    updateHistory: database.updateHistory ?? [],
    runtimeModelBindings: database.runtimeModelBindings ?? [],
  };
}

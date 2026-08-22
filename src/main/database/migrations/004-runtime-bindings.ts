import type { CoreDatabaseDocument } from '../../core/types/coreTypes';

export const RUNTIME_BINDINGS_SCHEMA_VERSION = 4;

/** Adds local runtime-to-model binding metadata without touching native DSH data. */
export function migrateToRuntimeBindingsSchema(
  database: Omit<CoreDatabaseDocument, 'schemaVersion' | 'runtimeModelBindings'> & {
    schemaVersion: number;
    runtimeModelBindings?: CoreDatabaseDocument['runtimeModelBindings'];
  },
): CoreDatabaseDocument {
  return {
    ...database,
    schemaVersion: RUNTIME_BINDINGS_SCHEMA_VERSION,
    runtimeModelBindings: database.runtimeModelBindings ?? [],
  };
}

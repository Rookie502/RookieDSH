import type { CoreDatabaseDocument } from '../../core/types/coreTypes';

export const UPDATE_HISTORY_SCHEMA_VERSION = 3;

/** Adds runtime update history while preserving all v1/v2 records. */
export function migrateToUpdateHistorySchema(
  database: Omit<CoreDatabaseDocument, 'schemaVersion' | 'updateHistory'> & {
    schemaVersion: number;
    updateHistory?: CoreDatabaseDocument['updateHistory'];
  },
): CoreDatabaseDocument {
  return {
    ...database,
    schemaVersion: UPDATE_HISTORY_SCHEMA_VERSION,
    updateHistory: database.updateHistory ?? [],
  };
}

import { readDatabase, updateDatabase } from '../database';
import type { CoreDatabaseDocument } from '../../core/types/coreTypes';

export function readCoreDatabase(): CoreDatabaseDocument {
  return readDatabase();
}

export function updateCoreDatabase(
  mutator: (database: CoreDatabaseDocument) => void,
): CoreDatabaseDocument {
  return updateDatabase(mutator);
}

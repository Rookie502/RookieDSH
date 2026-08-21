import { readCoreDatabase, updateCoreDatabase } from '../../database/repositories/coreRepository';
import type { CoreDatabaseDocument } from '../types/coreTypes';

export function getCoreSnapshot(): CoreDatabaseDocument {
  return readCoreDatabase();
}

export function updateCoreSnapshot(mutator: (database: CoreDatabaseDocument) => void): CoreDatabaseDocument {
  return updateCoreDatabase(mutator);
}

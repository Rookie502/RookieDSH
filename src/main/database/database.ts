import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CoreDatabaseDocument } from '../core/types/coreTypes';
import { RESOURCE_SCHEMA_VERSION, migrateToResourceSchema } from './migrations/002-resources';
import { UPDATE_HISTORY_SCHEMA_VERSION, migrateToUpdateHistorySchema } from './migrations/003-update-history';
import { migrateToRuntimeBindingsSchema, RUNTIME_BINDINGS_SCHEMA_VERSION } from './migrations/004-runtime-bindings';
import { ENDPOINT_HEALTH_SCHEMA_VERSION, migrateToEndpointHealthSchema } from './migrations/005-endpoint-health';
import { migrateToUpdateOutcomeSchema, UPDATE_OUTCOME_SCHEMA_VERSION } from './migrations/006-update-outcomes';

const DATABASE_FILE_NAME = 'rookiedsh.db';

const EMPTY_DATABASE: CoreDatabaseDocument = {
  storageFormat: 'json-v1',
  schemaVersion: UPDATE_OUTCOME_SCHEMA_VERSION,
  workspaces: [],
  tasks: [],
  runs: [],
  events: [],
  runtimeInstances: [],
  modelEndpoints: [],
  softwareVersions: [],
  updateChecks: [],
  updateHistory: [],
  runtimeModelBindings: [],
};

let cachedDatabase: CoreDatabaseDocument | null = null;

function cloneDatabase(database: CoreDatabaseDocument): CoreDatabaseDocument {
  return JSON.parse(JSON.stringify(database)) as CoreDatabaseDocument;
}

function databasePath(): string {
  const dataDirectory = process.env.ROOKIE_DSH_DATA_DIR?.trim() || app.getPath('userData');
  return path.join(dataDirectory, DATABASE_FILE_NAME);
}

function writeDatabase(database: CoreDatabaseDocument): void {
  const filePath = databasePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
}

function isDatabase(value: unknown): value is CoreDatabaseDocument {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Partial<CoreDatabaseDocument>;
  if (source.schemaVersion === UPDATE_HISTORY_SCHEMA_VERSION && !Array.isArray(source.updateHistory)) return false;
  if (source.schemaVersion === RUNTIME_BINDINGS_SCHEMA_VERSION && !Array.isArray(source.runtimeModelBindings)) return false;
  if (source.schemaVersion === ENDPOINT_HEALTH_SCHEMA_VERSION && !Array.isArray(source.runtimeModelBindings)) return false;
  if (source.schemaVersion === UPDATE_OUTCOME_SCHEMA_VERSION && !Array.isArray(source.updateHistory)) return false;
  return source.storageFormat === 'json-v1'
    && (source.schemaVersion === 1
      || source.schemaVersion === RESOURCE_SCHEMA_VERSION
      || source.schemaVersion === UPDATE_HISTORY_SCHEMA_VERSION
      || source.schemaVersion === RUNTIME_BINDINGS_SCHEMA_VERSION
      || source.schemaVersion === ENDPOINT_HEALTH_SCHEMA_VERSION
      || source.schemaVersion === UPDATE_OUTCOME_SCHEMA_VERSION)
    && Array.isArray(source.workspaces)
    && Array.isArray(source.tasks)
    && Array.isArray(source.runs)
    && Array.isArray(source.events);
}

function loadDatabase(): CoreDatabaseDocument {
  if (cachedDatabase) return cachedDatabase;

  const filePath = databasePath();
  if (!existsSync(filePath)) {
    cachedDatabase = cloneDatabase(EMPTY_DATABASE);
    writeDatabase(cachedDatabase);
    return cachedDatabase;
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!isDatabase(parsed)) throw new Error('Unsupported database format');
    cachedDatabase = cloneDatabase(migrateToUpdateOutcomeSchema(migrateToEndpointHealthSchema(migrateToRuntimeBindingsSchema(migrateToUpdateHistorySchema(migrateToResourceSchema(parsed))))));
    if (parsed.schemaVersion !== UPDATE_OUTCOME_SCHEMA_VERSION) writeDatabase(cachedDatabase);
  } catch (error) {
    console.warn(`RookieDSH: invalid core database, restoring empty store (${String(error)}).`);
    cachedDatabase = cloneDatabase(EMPTY_DATABASE);
    writeDatabase(cachedDatabase);
  }

  return cachedDatabase;
}

export function readDatabase(): CoreDatabaseDocument {
  return cloneDatabase(loadDatabase());
}

export function updateDatabase(mutator: (database: CoreDatabaseDocument) => void): CoreDatabaseDocument {
  const next = cloneDatabase(loadDatabase());
  mutator(next);
  cachedDatabase = next;
  writeDatabase(next);
  return cloneDatabase(next);
}

export function getDatabaseFilePath(): string {
  return databasePath();
}

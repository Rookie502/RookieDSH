import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CoreDatabaseDocument } from '../core/types/coreTypes';
import { CORE_SCHEMA_VERSION } from './migrations/001-initial';

const DATABASE_FILE_NAME = 'rookiedsh.db';

const EMPTY_DATABASE: CoreDatabaseDocument = {
  storageFormat: 'json-v1',
  schemaVersion: CORE_SCHEMA_VERSION,
  workspaces: [],
  tasks: [],
  runs: [],
  events: [],
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
  return source.storageFormat === 'json-v1'
    && source.schemaVersion === CORE_SCHEMA_VERSION
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
    cachedDatabase = cloneDatabase(parsed);
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

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'rookiedsh-core-'));
const bundlePath = path.join(tempDirectory, 'coreOperations.cjs');

try {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main/core/store/coreOperations.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
  });

  const operations = await import(pathToFileURL(bundlePath).href);
  const database = {
    storageFormat: 'json-v1',
    schemaVersion: 1,
    workspaces: [],
    tasks: [],
    runs: [],
    events: [],
  };
  const timestamp = '2026-08-21T00:00:00.000Z';

  const workspace = operations.createWorkspaceRecord(database, {
    name: 'Smoke Workspace',
    path: 'C:\\SmokeWorkspace',
  }, 'workspace-1', timestamp);
  const task = operations.createTaskRecord(database, {
    workspaceId: workspace.id,
    title: 'Foundation smoke task',
  }, 'task-1', timestamp);
  operations.updateTaskStatusRecord(database, task.id, 'COMPLETED', timestamp);
  const run = operations.createRunRecord(database, {
    taskId: task.id,
    runtimeType: 'dsh',
  }, 'run-1');
  operations.createEventRecord(database, {
    source: 'rookiedsh',
    type: 'core.smoke',
    payload: { ok: true },
  }, 'event-1', timestamp);

  const overview = operations.getOverview(database);
  assert.equal(run.status, 'CREATED');
  assert.equal(overview.workspaceCount, 1);
  assert.equal(overview.activeRunCount, 0);
  assert.equal(overview.completedTaskCount, 1);
  assert.equal(overview.latestEvent?.type, 'core.smoke');
  assert.equal(operations.deleteWorkspaceRecord(database, workspace.id), true);
  assert.equal(database.workspaces.length, 0);
  console.log('Core smoke test passed.');
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

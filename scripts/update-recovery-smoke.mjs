import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirectory = await fs.mkdtemp(path.join(root, 'update-recovery-'));
const bundlePath = path.join(tempDirectory, 'UpdateExecutor.cjs');

try {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main/updates/UpdateExecutor.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['electron'],
  });

  const { UpdateExecutor } = await import(pathToFileURL(bundlePath).href);
  let runtimeStatus = 'RUNNING';
  let rejectUpdateRestart = true;
  const history = [];
  const runtime = {
    getStatus: () => ({ status: runtimeStatus, readiness: runtimeStatus === 'RUNNING' ? 'PAGE_READY' : 'NOT_STARTED', pid: null, url: null, error: null, startedAt: null }),
    async stop() { runtimeStatus = 'STOPPED'; },
    async start(options = {}) {
      if (options.reason === 'update-restart' && rejectUpdateRestart) {
        rejectUpdateRestart = false;
        runtimeStatus = 'FAILED';
        throw new Error('Harness start timed out after 120s');
      }
      runtimeStatus = 'RUNNING';
    },
  };
  const updater = {
    async check() { return { installedVersion: '0.1.1-rc.1', latestVersion: '0.1.1-rc.2', installationType: 'npm-global', updateAvailable: true, error: null, installation: null }; },
    async backup(version) { return { directory: tempDirectory, archivePath: path.join(tempDirectory, 'backup.tgz'), version, installationType: 'npm-global' }; },
    async update() {},
    async verify(version) { return { version, installation: {} }; },
    async rollback() {},
    async cleanup() {},
  };

  const executor = new UpdateExecutor({
    requestConfirmation: async () => true,
    updater,
    runtime,
    getUpdateRestartTimeout: () => 120_000,
    syncRuntimeVersion: () => {},
    persistHistory: (item) => history.push(item),
  });
  const result = await executor.executeRuntimeUpdate();
  assert.equal(result.outcome, 'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED');
  assert.equal(result.installationResult, 'INSTALL_SUCCEEDED');
  assert.equal(result.restartResult, 'RESTART_FAILED');
  assert.equal(result.history.installationResult, 'INSTALL_SUCCEEDED');
  assert.equal(result.history.restartResult, 'RESTART_FAILED');
  assert.equal(result.progress.stage, 'SUCCEEDED_RUNTIME_RECOVERY_REQUIRED');
  assert.equal(history.length, 1);

  await runtime.start();
  assert.equal(runtimeStatus, 'RUNNING');
  console.log('Runtime update recovery smoke test passed.');
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

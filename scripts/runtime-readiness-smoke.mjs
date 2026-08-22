import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirectory = await fs.mkdtemp(path.join(root, 'runtime-readiness-'));
const bundlePath = path.join(tempDirectory, 'dshProcess.cjs');

try {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main/runtime/dshProcess.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['electron'],
  });
  const readiness = await import(pathToFileURL(bundlePath).href);
  const config = { runtime: { startTimeout: 60_000, startupTimeout: 60_000 } };
  assert.equal(readiness.resolveRuntimeStartTimeout(config), 60_000);
  assert.equal(readiness.resolveRuntimeStartTimeout(config, { timeoutMs: 120_000, reason: 'update-restart' }), 120_000);
  assert.equal(readiness.isRuntimeReadinessTimedOut(0, 59_999, 60_000), false);
  assert.equal(readiness.isRuntimeReadinessTimedOut(0, 60_001, 60_000), true);
  console.log('Runtime readiness timeout smoke test passed.');
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

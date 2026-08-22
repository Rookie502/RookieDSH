import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'rookiedsh-resource-'));
  const bundlePath = path.join(tempDirectory, 'endpointHealth.cjs');

try {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main/models/endpointHealth.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
  });

  const health = await import(pathToFileURL(bundlePath).href);
  const now = Date.parse('2026-08-22T00:00:00.000Z');
  assert.equal(health.deriveEndpointStatus('ONLINE', '2026-08-21T23:59:45.000Z', now), 'ONLINE');
  assert.equal(health.deriveEndpointStatus('ONLINE', '2026-08-21T23:57:00.000Z', now), 'STALE');
  assert.equal(health.deriveEndpointStatus('OFFLINE', '2026-08-21T23:59:45.000Z', now), 'OFFLINE');
  assert.equal(health.deriveEndpointStatus('ONLINE', null, now), 'UNKNOWN');
  assert.equal(health.normalizeKnownStatus('unexpected'), 'UNKNOWN');
  const states = health.createDiscoveredModelStates(['qwen3.8-27b']);
  assert.equal(states['qwen3.8-27b'], 'DISCOVERED');
  assert.equal(health.getModelResourceState(states, 'qwen3.8-27b'), 'DISCOVERED');
  assert.notEqual(health.getModelResourceState(states, 'qwen3.8-27b'), 'LOADED');
  console.log('Endpoint health freshness smoke test passed.');
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

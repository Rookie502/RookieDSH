import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDirectory = await fs.mkdtemp(path.join(root, 'update-smoke-'));
const bundlePath = path.join(tempDirectory, 'InstallProvider.cjs');

try {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main/updates/providers/InstallProvider.ts')],
    outfile: bundlePath,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['electron'],
  });

  const { InstallProvider } = await import(pathToFileURL(bundlePath).href);
  const calls = [];
  let shouldFailInstall = true;
  const runner = {
    async run(command, args) {
      calls.push([command, ...args]);
      if (command === 'npm' && args[0] === 'pack') {
        const destination = args[args.indexOf('--pack-destination') + 1];
        await fs.writeFile(path.join(destination, 'deepseek-ai-dsh-0.1.0.tgz'), 'mock archive');
        return { stdout: 'deepseek-ai-dsh-0.1.0.tgz', stderr: '' };
      }
      if (command === 'npm' && args[0] === 'install' && shouldFailInstall) {
        shouldFailInstall = false;
        throw new Error('mock install failure');
      }
      return { stdout: 'ok', stderr: '' };
    },
  };

  const provider = new InstallProvider(runner);
  const installation = {
    type: 'npm-global',
    command: 'dsh.cmd',
    label: 'dsh.cmd',
    npmManaged: true,
    updateSupported: true,
    error: null,
  };
  const backup = await provider.backup('0.1.0', installation);
  await assert.rejects(provider.update('0.2.0', installation), /mock install failure/);
  assert.ok(calls.some((call) => call[0] === 'npm' && call[1] === 'install' && call.includes('@deepseek-ai/dsh@latest') && call.includes('--no-audit') && call.includes('--no-fund')));
  await provider.rollback(backup);
  assert.ok(calls.some((call) => call[0] === 'npm' && call[1] === 'install' && call.includes(backup.archivePath)));
  await provider.cleanup(backup.directory);
  console.log('Runtime update failure/rollback smoke test passed.');
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

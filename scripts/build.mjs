import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const viteVin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd: root, stdio: 'inherit' });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

const typecheckCode = await run(tscBin, ['--noEmit']);
if (typecheckCode !== 0) process.exit(typecheckCode);

// Main and preload must be bundled as .cjs because package.json declares type=module.
await esbuild.build({
  entryPoints: [path.join(root, 'src/main/index.ts')],
  outfile: path.join(root, 'out/main/index.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  external: ['electron'],
});

const buildCode = await run(viteVin, ['build']);
if (buildCode !== 0) process.exit(buildCode);

await esbuild.build({
  entryPoints: [path.join(root, 'src/preload/index.ts')],
  outfile: path.join(root, 'out/preload/index.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  external: ['electron'],
});
process.exit(0);

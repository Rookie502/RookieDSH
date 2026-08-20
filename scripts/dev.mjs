import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});

let startedElectron = false;
function startElectron() {
  if (startedElectron) return;
  startedElectron = true;

  // Build main + preload as bundled .cjs files before launching Electron.
  const esbuildBin = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
  const buildMain = spawn(process.execPath, [
    esbuildBin,
    path.join(root, 'src/main/index.ts'),
    '--outfile=out/main/index.cjs',
    '--bundle',
    '--format=cjs',
    '--platform=node',
    '--target=node20',
    '--external:electron',
  ], { cwd: root, stdio: 'inherit' });

  buildMain.on('close', (code) => {
    if (code !== 0) { vite.kill(); return; }

    const buildPreload = spawn(process.execPath, [
      esbuildBin,
      path.join(root, 'src/preload/index.ts'),
      '--outfile=out/preload/index.cjs',
      '--bundle',
      '--format=cjs',
      '--platform=node',
      '--target=node20',
      '--external:electron',
    ], { cwd: root, stdio: 'inherit' });

    buildPreload.on('close', (code2) => {
      if (code2 !== 0) { vite.kill(); return; }

      const electron = spawn(electronBin, ['.'], { cwd: root, stdio: 'inherit' });
      electron.on('exit', () => vite.kill());
    });
  });
}

vite.stdout?.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!startedElectron && String(chunk).includes('ready in')) startElectron();
});

let code = 0;
vite.on('close', (c) => {
  if (typeof c === 'number') code = c;
  process.exit(code);
});

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBin = path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const esbuildBin = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const devStartedAt = Date.now();

function probePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findVitePort() {
  if (await probePort(5173)) return 5173;

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new Error('Unable to allocate a Vite port')));
    });
  });
}

const vitePort = await findVitePort();

let viteProcess = null;
let electronProcess = null;
const viteUrl = `http://localhost:${vitePort}`;
let viteReady = false;
let electronStarted = false;
let shuttingDown = false;
const buildProcesses = new Set();

function terminate(child) {
  if (!child || child.exitCode !== null || child.killed) return;

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  terminate(electronProcess);
  terminate(viteProcess);
  for (const buildProcess of buildProcesses) terminate(buildProcess);

  setTimeout(() => process.exit(code), 0);
}

function runBuild(entryPoint, outfile) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      esbuildBin,
      entryPoint,
      `--outfile=${outfile}`,
      '--bundle',
      '--format=cjs',
      '--platform=node',
      '--target=node20',
      '--external:electron',
    ], { cwd: root, stdio: 'inherit' });

    buildProcesses.add(child);
    child.once('close', (code) => {
      buildProcesses.delete(child);
      resolve(code ?? 1);
    });
  });
}

async function startElectron() {
  if (electronStarted || shuttingDown) return;
  electronStarted = true;

  const [mainCode, preloadCode] = await Promise.all([
    runBuild(path.join(root, 'src/main/index.ts'), 'out/main/index.cjs'),
    runBuild(path.join(root, 'src/preload/index.ts'), 'out/preload/index.cjs'),
  ]);

  if (shuttingDown) return;
  if (mainCode !== 0 || preloadCode !== 0) {
    shutdown(1);
    return;
  }

  const electronEnvironment = { ...process.env };
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;
  console.log('RookieDSH: launching Electron window...');
  electronProcess = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...electronEnvironment,
      ROOKIE_DSH_DEV_SERVER_URL: viteUrl,
      ROOKIE_DSH_DEV_STARTED_AT: String(devStartedAt),
    },
  });
  electronProcess.once('spawn', () => console.log('RookieDSH: Electron process started.'));
  electronProcess.once('error', () => shutdown(1));
  electronProcess.once('close', (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });
}

viteProcess = spawn(process.execPath, [
  path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host',
  '127.0.0.1',
  '--port',
  String(vitePort),
  '--strictPort',
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});

let viteOutput = '';
function maybeStartElectron() {
  if (!electronStarted && viteReady && viteUrl) void startElectron();
}

viteProcess.stdout?.on('data', (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);
  viteOutput = `${viteOutput}${text}`.slice(-4_000);

  if (viteOutput.includes('ready in') && !viteReady) {
    viteReady = true;
    console.log(`RookieDSH: Vite internal server ready at ${viteUrl} (do not open this URL directly).`);
  }
  maybeStartElectron();
});

viteProcess.once('error', () => shutdown(1));
viteProcess.once('close', (code) => {
  if (!shuttingDown) shutdown(code ?? 1);
});

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

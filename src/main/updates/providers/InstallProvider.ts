import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getConfig } from '../../config/configManager';
import { resolveDeepSeekHarnessLaunchSpec } from '../../runtime/DeepSeekHarness';
import type { DeepSeekHarnessInstallationType } from '@shared/updateTypes';

const execFileAsync = promisify(execFile);
const INSTALL_COMMAND_TIMEOUT_MS = 10 * 60 * 1_000;
export const DEEPSEEK_HARNESS_PACKAGE_NAME = '@deepseek-ai/dsh';
export const DEEPSEEK_HARNESS_UPDATE_COMMAND = 'npm install -g @deepseek-ai/dsh@latest --no-audit --no-fund';

export interface DeepSeekHarnessInstallation {
  type: DeepSeekHarnessInstallationType;
  command: string;
  label: string;
  packageName: string;
  packageVersion: string | null;
  executablePath: string | null;
  updateCommand: string;
  npmManaged: boolean;
  updateSupported: boolean;
  error: string | null;
}

export interface InstallBackup {
  directory: string;
  archivePath: string;
  version: string;
  installationType: DeepSeekHarnessInstallationType;
}

export interface InstallCommandRunner {
  run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }>;
}

export class InstallProvider {
  constructor(private readonly runner: InstallCommandRunner = new ProcessInstallCommandRunner()) {}

  async detect(): Promise<DeepSeekHarnessInstallation> {
    const npmGlobal = await this.detectNpmGlobal();
    if (npmGlobal) return npmGlobal;

    const launchSpec = resolveDeepSeekHarnessLaunchSpec(getConfig());
    const label = launchSpec.label;
    const commandName = path.basename(launchSpec.command).toLowerCase();
    const isNpx = label.toLowerCase().includes('fallback') || commandName.startsWith('npx');
    if (isNpx) {
      return {
        type: 'npx',
        command: launchSpec.command,
        label,
        packageName: DEEPSEEK_HARNESS_PACKAGE_NAME,
        packageVersion: null,
        executablePath: launchSpec.command,
        updateCommand: `npx --yes ${DEEPSEEK_HARNESS_PACKAGE_NAME}@latest`,
        npmManaged: false,
        updateSupported: true,
        error: null,
      };
    }

    const isDshCommand = /(^|[\\/])dsh(?:\.cmd|\.ps1)?$/i.test(launchSpec.command)
      || label.toLowerCase().includes('dsh');
    if (isDshCommand) {
      return {
        type: 'dsh-command',
        command: launchSpec.command,
        label,
        packageName: DEEPSEEK_HARNESS_PACKAGE_NAME,
        packageVersion: null,
        executablePath: launchSpec.command,
        updateCommand: DEEPSEEK_HARNESS_UPDATE_COMMAND,
        npmManaged: false,
        updateSupported: false,
        error: 'The dsh command was found, but its npm global installation could not be verified.',
      };
    }
    return {
      type: 'unknown',
      command: launchSpec.command,
      label,
      packageName: DEEPSEEK_HARNESS_PACKAGE_NAME,
      packageVersion: null,
      executablePath: launchSpec.command,
      updateCommand: DEEPSEEK_HARNESS_UPDATE_COMMAND,
      npmManaged: false,
      updateSupported: false,
      error: 'Unable to identify a supported DeepSeek Harness installation.',
    };
  }

  async backup(version: string, installation: DeepSeekHarnessInstallation): Promise<InstallBackup> {
    if (!version) throw new Error('Cannot back up DeepSeek Harness without an installed version.');
    if (!installation.updateSupported) throw new Error(installation.error ?? 'This installation cannot be updated safely.');

    const directory = await mkdtemp(path.join(os.tmpdir(), 'rookiedsh-dsh-update-'));
    try {
      await this.runner.run('npm', ['pack', packageSpec(version), '--pack-destination', directory, '--ignore-scripts']);
      const archive = readdirSync(directory).find((file) => file.endsWith('.tgz'));
      if (!archive) throw new Error('npm pack did not produce a backup archive.');
      return {
        directory,
        archivePath: path.join(directory, archive),
        version,
        installationType: installation.type,
      };
    } catch (error) {
      await this.cleanup(directory);
      throw error;
    }
  }

  async update(version: string, installation: DeepSeekHarnessInstallation): Promise<void> {
    if (!installation.updateSupported) throw new Error(installation.error ?? 'This installation cannot be updated safely.');
    if (installation.type === 'npx') {
      await this.runner.run('npx', ['--yes', packageSpec('latest'), '--version']);
      return;
    }
    await this.runner.run('npm', ['install', '-g', packageSpec('latest'), '--no-audit', '--no-fund']);
  }

  async rollback(backup: InstallBackup): Promise<void> {
    if (backup.installationType === 'npx') {
      await this.runner.run('npx', ['--yes', backup.archivePath, '--version']);
      return;
    }
    await this.runner.run('npm', ['install', '--global', backup.archivePath]);
  }

  async runVersionCommand(installation: DeepSeekHarnessInstallation): Promise<string> {
    if (installation.type === 'npx') {
      const result = await this.runner.run('npx', ['--yes', packageSpec(installation.packageVersion ?? 'latest'), '--version']);
      return `${result.stdout}\n${result.stderr}`;
    }

    const executable = (installation.executablePath ?? installation.command) || 'dsh';
    const isPowerShellScript = executable.toLowerCase().endsWith('.ps1');
    const result = isPowerShellScript
      ? await this.runner.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', executable, '--version'])
      : await this.runner.run(executable, ['--version']);
    return `${result.stdout}\n${result.stderr}`;
  }

  async cleanup(directory: string | null): Promise<void> {
    if (!directory) return;
    await rm(directory, { recursive: true, force: true });
  }

  private async detectNpmGlobal(): Promise<DeepSeekHarnessInstallation | null> {
    try {
      const rootResult = await this.runner.run('npm', ['root', '-g']);
      const globalRoot = extractGlobalRoot(rootResult.stdout);
      if (!globalRoot) return null;

      const packageDirectory = path.join(globalRoot, '@deepseek-ai', 'dsh');
      if (!existsSync(packageDirectory)) return null;

      const packageJsonVersion = await readPackageVersion(packageDirectory);
      const listedVersion = await this.readGlobalPackageVersion();
      const packageVersion = listedVersion ?? packageJsonVersion;
      const executablePath = resolveNpmGlobalExecutable(globalRoot);
      return {
        type: 'npm-global',
        command: executablePath ?? 'dsh',
        label: 'npm global @deepseek-ai/dsh',
        packageName: DEEPSEEK_HARNESS_PACKAGE_NAME,
        packageVersion,
        executablePath,
        updateCommand: DEEPSEEK_HARNESS_UPDATE_COMMAND,
        npmManaged: true,
        updateSupported: true,
        error: packageVersion ? null : 'The npm global package was found, but its version could not be read.',
      };
    } catch {
      return null;
    }
  }

  private async readGlobalPackageVersion(): Promise<string | null> {
    try {
      const result = await this.runner.run('npm', ['list', '-g', '--depth=0', '--json']);
      const payload: unknown = JSON.parse(result.stdout);
      if (!isRecord(payload) || !isRecord(payload.dependencies)) return null;
      const packageEntry = payload.dependencies[DEEPSEEK_HARNESS_PACKAGE_NAME];
      return isRecord(packageEntry) && typeof packageEntry.version === 'string'
        ? packageEntry.version
        : null;
    } catch {
      return null;
    }
  }
}

/** Single source for the installed DSH version. Prefer the executable because
 * npm metadata can lag behind a completed global install. */
export async function readInstalledDeepSeekHarnessVersion(installer = new InstallProvider()): Promise<{
  installedVersion: string | null;
  installation: DeepSeekHarnessInstallation;
  error: string | null;
}> {
  const installation = await installer.detect();
  let installedVersion: string | null = null;
  let error: string | null = null;
  if (installation.updateSupported) {
    try {
      const output = await installer.runVersionCommand(installation);
      installedVersion = output.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0] ?? null;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
  }
  installedVersion ??= installation.packageVersion;
  if (!installedVersion && !error) error = 'Unable to parse the DeepSeek Harness version from the CLI output.';
  return { installedVersion, installation, error };
}

class ProcessInstallCommandRunner implements InstallCommandRunner {
  async run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    const executable = process.platform === 'win32' && (command === 'npm' || command === 'npx')
      ? `${command}.cmd`
      : command;
    try {
      const result = await execFileAsync(executable, args, {
        shell: process.platform === 'win32',
        windowsHide: true,
        encoding: 'utf8',
        timeout: INSTALL_COMMAND_TIMEOUT_MS,
        maxBuffer: 512 * 1024,
      });
      return {
        stdout: String(result.stdout ?? ''),
        stderr: String(result.stderr ?? ''),
      };
    } catch (error) {
      if (isRecord(error) && error.code === 'ETIMEDOUT') {
        throw new Error('DeepSeek Harness npm installation timed out after 10 minutes.');
      }
      throw error;
    }
  }
}

export function packageSpec(version: string): string {
  return `${DEEPSEEK_HARNESS_PACKAGE_NAME}@${version.replace(/^v/i, '')}`;
}

async function readPackageVersion(packageDirectory: string): Promise<string | null> {
  try {
    const packageJson = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8')) as unknown;
    return isRecord(packageJson) && typeof packageJson.version === 'string' ? packageJson.version : null;
  } catch {
    return null;
  }
}

function extractGlobalRoot(output: string): string | null {
  const candidates = output
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^['"]|['"]$/g, ''))
    .filter((line) => line.length > 0);
  return candidates.find((line) => /node_modules[\\/]?$/.test(line)) ?? candidates.at(-1) ?? null;
}

function resolveNpmGlobalExecutable(globalRoot: string): string | null {
  const candidates = process.platform === 'win32'
    ? [
      path.resolve(globalRoot, '..', 'dsh.cmd'),
      path.resolve(globalRoot, '..', 'dsh.ps1'),
      path.resolve(globalRoot, '..', 'dsh'),
    ]
    : [
      path.resolve(globalRoot, '..', 'bin', 'dsh'),
      path.resolve(globalRoot, '..', 'dsh'),
    ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

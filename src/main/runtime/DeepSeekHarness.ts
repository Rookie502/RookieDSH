import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { RookieDshConfig } from '@shared/configTypes';
import type { RuntimeLaunchSpec } from './RuntimeTypes';

function findCommand(command: string): string | null {
  if (path.isAbsolute(command) && existsSync(command)) return command;

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      const npmCandidate = path.join(appData, 'npm', command);
      if (existsSync(npmCandidate)) return npmCandidate;
    }

    try {
      const source = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-Command '${command}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)`,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
      return source || null;
    } catch {
      return null;
    }
  }

  try {
    const source = execFileSync('which', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return source || null;
  } catch {
    return null;
  }
}

function getPowerShellCommand(): string {
  const programFiles = process.env.ProgramFiles;
  const pwsh = programFiles ? path.join(programFiles, 'PowerShell', '7', 'pwsh.exe') : '';
  return pwsh && existsSync(pwsh) ? pwsh : 'powershell.exe';
}

/** Resolve the platform-specific DeepSeek Harness launch command. */
export function resolveDeepSeekHarnessLaunchSpec(config: RookieDshConfig): RuntimeLaunchSpec {
  const configuredCommand = config.runtime.command.trim() || 'dsh';
  const commandName = path.basename(configuredCommand).toLowerCase();

  if (process.platform === 'win32') {
    const dshCmdName = commandName.endsWith('.cmd') ? configuredCommand : `${configuredCommand}.cmd`;
    const dshCmd = findCommand(dshCmdName);
    if (dshCmd) {
      return { command: dshCmd, args: ['web', '--no-open'], shell: true, label: dshCmdName };
    }

    const dshPs1Name = commandName.endsWith('.ps1') ? configuredCommand : `${configuredCommand}.ps1`;
    const dshPs1 = findCommand(dshPs1Name);
    if (dshPs1) {
      return {
        command: getPowerShellCommand(),
        args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', dshPs1, 'web', '--no-open'],
        label: dshPs1Name,
      };
    }
  } else {
    const dsh = findCommand(configuredCommand);
    if (dsh) return { command: dsh, args: ['web', '--no-open'], label: configuredCommand };
  }

  const configuredFallback = config.runtime.fallbackCommand.trim() || 'npx';
  const fallbackName = process.platform === 'win32' && !configuredFallback.toLowerCase().endsWith('.cmd')
    ? `${configuredFallback}.cmd`
    : configuredFallback;
  const fallback = findCommand(fallbackName) ?? fallbackName;

  return {
    command: fallback,
    args: ['--yes', '@deepseek-ai/dsh', 'web', '--no-open'],
    shell: process.platform === 'win32',
    label: `${configuredFallback} @deepseek-ai/dsh fallback`,
  };
}

/** Resolve the same provider command for a non-mutating version query. */
export function resolveDeepSeekHarnessVersionSpec(config: RookieDshConfig): RuntimeLaunchSpec {
  const launchSpec = resolveDeepSeekHarnessLaunchSpec(config);
  if (launchSpec.label.includes('fallback')) {
    return {
      ...launchSpec,
      args: ['--yes', '@deepseek-ai/dsh', '--version'],
      label: `${launchSpec.label} version query`,
    };
  }

  const webIndex = launchSpec.args.indexOf('web');
  return {
    ...launchSpec,
    args: webIndex >= 0
      ? [...launchSpec.args.slice(0, webIndex), '--version']
      : ['--version'],
    label: `${launchSpec.label} version query`,
  };
}

export function detectDeepSeekHarness(config: RookieDshConfig): boolean {
  const configuredCommand = config.runtime.command.trim() || 'dsh';
  if (process.platform === 'win32') {
    return findCommand(configuredCommand.endsWith('.cmd') ? configuredCommand : `${configuredCommand}.cmd`) != null
      || findCommand(configuredCommand.endsWith('.ps1') ? configuredCommand : `${configuredCommand}.ps1`) != null;
  }
  return findCommand(configuredCommand) != null;
}

export function isDeepSeekHarnessCommand(commandLine: string): boolean {
  const normalized = commandLine.toLowerCase().replaceAll('\\', '/');
  return normalized.includes('@deepseek-ai/dsh') || normalized.includes('/dsh/lib/bin.js');
}

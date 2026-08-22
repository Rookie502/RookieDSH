import { getLatestDeepSeekHarnessVersion } from './RuntimeVersionProvider';
import {
  DEEPSEEK_HARNESS_PACKAGE_NAME,
  DEEPSEEK_HARNESS_UPDATE_COMMAND,
  InstallProvider,
  readInstalledDeepSeekHarnessVersion,
  type DeepSeekHarnessInstallation,
  type InstallBackup,
} from './InstallProvider';
import type { RuntimeUpdateCheck } from '@shared/updateTypes';

export interface VerifiedRuntimeVersion {
  version: string;
  installation: DeepSeekHarnessInstallation;
}

export class DeepSeekHarnessUpdater {
  constructor(private readonly installer = new InstallProvider()) {}

  detect(): Promise<DeepSeekHarnessInstallation> {
    return this.installer.detect();
  }

  async check(): Promise<RuntimeUpdateCheck> {
    const installed = await readInstalledDeepSeekHarnessVersion(this.installer);
    const installation = installed.installation;
    let installedVersion = installed.installedVersion;
    let latestVersion: string | null = null;
    let error = installed.error ?? installation.error;
    try {
      latestVersion = (await getLatestDeepSeekHarnessVersion()).latestVersion;
    } catch (reason) {
      error = error ?? (reason instanceof Error ? reason.message : String(reason));
    }
    if (installation.error) error = error ?? installation.error;
    const updateAvailable = Boolean(
      installedVersion
      && latestVersion
      && compareVersions(installedVersion, latestVersion) < 0,
    );
    return {
      installedVersion,
      latestVersion,
      installationType: installation.type,
      updateAvailable,
      error,
      installation: {
        type: installation.type,
        packageName: installation.packageName || DEEPSEEK_HARNESS_PACKAGE_NAME,
        executablePath: installation.executablePath,
        updateCommand: installation.updateCommand || DEEPSEEK_HARNESS_UPDATE_COMMAND,
      },
    };
  }

  async backup(version: string, installation?: DeepSeekHarnessInstallation): Promise<InstallBackup> {
    return this.installer.backup(version, installation ?? await this.installer.detect());
  }

  async update(version: string, installation?: DeepSeekHarnessInstallation): Promise<void> {
    await this.installer.update(version, installation ?? await this.installer.detect());
  }

  async verify(expectedVersion: string, installation?: DeepSeekHarnessInstallation): Promise<VerifiedRuntimeVersion> {
    const detected = installation ?? await this.installer.detect();
    const output = await this.installer.runVersionCommand(detected);
    const installedVersion = parseVersion(output);
    if (!installedVersion) throw new Error('Unable to parse the DeepSeek Harness version from dsh --version.');
    if (compareVersions(installedVersion, expectedVersion) !== 0) {
      throw new Error(`DeepSeek Harness version mismatch: expected ${expectedVersion}, found ${installedVersion}.`);
    }
    return { version: installedVersion, installation: detected };
  }

  async rollback(backup: InstallBackup): Promise<void> {
    await this.installer.rollback(backup);
  }

  async cleanup(backup: InstallBackup | null): Promise<void> {
    await this.installer.cleanup(backup?.directory ?? null);
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function parseVersion(value: string): string | null {
  return value.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0] ?? null;
}

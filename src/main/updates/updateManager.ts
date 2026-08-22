import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { getCoreSnapshot, updateCoreSnapshot } from '../core/store/coreStore';
import { getLatestRookieDshRelease } from './providers/GitHubReleaseProvider';
import { DEEPSEEK_HARNESS_PACKAGE_URL } from './providers/RuntimeVersionProvider';
import { DeepSeekHarnessUpdater } from './providers/DeepSeekHarnessUpdater';
import { getRuntimeStatus } from '../runtime/RuntimeManager';
import { syncDeepSeekHarnessRuntime } from '../runtime/RuntimeRegistry';
import type { CompatibilityStatus, SoftwareVersion, UpdateCheck, UpdateStatus } from './updateTypes';

export function getUpdateStatus(): UpdateStatus {
  const database = getCoreSnapshot();
  const installedRuntimeVersion = database.runtimeInstances.find((runtime) => runtime.id === 'deepseek-harness')?.version ?? null;
  const software = database.softwareVersions.map((version) => (
    version.target === 'deepseek-harness' && installedRuntimeVersion
      ? { ...version, currentVersion: installedRuntimeVersion, compatibility: compareVersions(installedRuntimeVersion, version.latestVersion) }
      : version
  ));
  if (installedRuntimeVersion && !software.some((version) => version.target === 'deepseek-harness')) {
    software.push({
      id: 'deepseek-harness',
      target: 'deepseek-harness',
      currentVersion: installedRuntimeVersion,
      latestVersion: null,
      releaseNotes: null,
      releaseUrl: DEEPSEEK_HARNESS_PACKAGE_URL,
      checkedAt: null,
      compatibility: 'unknown',
      error: null,
      installation: null,
    });
  }
  return {
    software,
    checks: database.updateChecks,
  };
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const [rookieDsh, harness] = await Promise.all([
    checkRookieDsh(),
    checkDeepSeekHarness(),
  ]);
  const results = [rookieDsh, harness];
  updateCoreSnapshot((database) => {
    for (const result of results) {
      const existing = database.softwareVersions.find((version) => version.target === result.target);
      const software: SoftwareVersion = {
        id: existing?.id ?? result.target,
        ...result,
      };
      if (existing) Object.assign(existing, software);
      else database.softwareVersions.push(software);

      const check: UpdateCheck = { id: randomUUID(), ...result, checkedAt: result.checkedAt ?? new Date().toISOString() };
      database.updateChecks.push(check);
    }
    if (database.updateChecks.length > 100) database.updateChecks.splice(0, database.updateChecks.length - 100);
  });
  return getUpdateStatus();
}

async function checkRookieDsh() {
  const checkedAt = new Date().toISOString();
  try {
    const release = await getLatestRookieDshRelease();
    return {
      target: 'rookiedsh' as const,
      currentVersion: app.getVersion(),
      latestVersion: release.latestVersion,
      releaseNotes: release.releaseNotes,
      releaseUrl: release.releaseUrl,
      checkedAt,
      compatibility: compareVersions(app.getVersion(), release.latestVersion),
      error: null,
    };
  } catch (error) {
    return failedResult('rookiedsh', app.getVersion(), checkedAt, error);
  }
}

async function checkDeepSeekHarness() {
  const checkedAt = new Date().toISOString();
  let currentVersion: string | null = null;
  try {
    const checked = await new DeepSeekHarnessUpdater().check();
    currentVersion = checked.installedVersion;
    if (currentVersion) syncDeepSeekHarnessRuntime(getRuntimeStatus(), currentVersion);
    return {
      target: 'deepseek-harness' as const,
      currentVersion,
      latestVersion: checked.latestVersion,
      releaseNotes: null,
      releaseUrl: DEEPSEEK_HARNESS_PACKAGE_URL,
      checkedAt,
      compatibility: compareVersions(currentVersion, checked.latestVersion),
      error: checked.error,
      installation: checked.installation,
    };
  } catch (error) {
    return {
      ...failedResult('deepseek-harness', currentVersion, checkedAt, error),
      installation: null,
    };
  }
}

function failedResult(target: 'rookiedsh' | 'deepseek-harness', currentVersion: string | null, checkedAt: string, error: unknown) {
  return {
    target,
    currentVersion,
    latestVersion: null,
    releaseNotes: null,
    releaseUrl: null,
    checkedAt,
    compatibility: 'unknown' as const,
    error: error instanceof Error ? error.message : String(error),
  };
}

function compareVersions(current: string | null, latest: string | null): CompatibilityStatus {
  if (!current || !latest) return 'unknown';
  return compareVersionParts(current, latest) < 0 ? 'update-available' : 'compatible';
}

function compareVersionParts(left: string, right: string): number {
  const leftParts = left.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

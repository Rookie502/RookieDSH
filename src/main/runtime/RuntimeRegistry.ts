import type { RuntimeInfo } from '@shared/types';
import type { RuntimeInstance, RuntimeVersionInfo } from '@shared/runtimeRegistryTypes';
import { getCoreSnapshot, updateCoreSnapshot } from '../core/store/coreStore';
import { readInstalledDeepSeekHarnessVersion } from '../updates/providers/InstallProvider';
const DEEPSEEK_HARNESS_RUNTIME_ID = 'deepseek-harness';
const RUNTIME_CAPABILITIES = ['web', 'local-process', 'openai-compatible-worker'];

export function listRuntimeInstances(): RuntimeInstance[] {
  return getCoreSnapshot().runtimeInstances;
}

export function syncDeepSeekHarnessRuntime(info: RuntimeInfo, version: string | null = null): RuntimeInstance {
  const timestamp = new Date().toISOString();
  let runtime: RuntimeInstance | null = null;
  updateCoreSnapshot((database) => {
    const existing = database.runtimeInstances.find((candidate) => candidate.id === DEEPSEEK_HARNESS_RUNTIME_ID);
    const next: RuntimeInstance = existing ?? {
      id: DEEPSEEK_HARNESS_RUNTIME_ID,
      type: 'deepseek-harness',
      version: null,
      status: 'STOPPED',
      capabilities: [...RUNTIME_CAPABILITIES],
      nativeMetadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    next.version = version ?? next.version;
    next.status = info.status;
    next.capabilities = [...RUNTIME_CAPABILITIES];
    next.nativeMetadata = {
      pid: info.pid,
      url: info.url,
      error: info.error,
      startedAt: info.startedAt,
      readiness: info.readiness,
    };
    next.updatedAt = timestamp;
    if (!existing) database.runtimeInstances.push(next);
    runtime = next;
  });
  if (!runtime) throw new Error('Runtime registry update did not produce a record.');
  return runtime;
}

export async function checkDeepSeekHarnessVersion(): Promise<RuntimeVersionInfo> {
  try {
    const result = await readInstalledDeepSeekHarnessVersion();
    if (!result.installedVersion) throw new Error(result.error ?? 'Unable to parse a DeepSeek Harness version from the CLI output.');
    syncDeepSeekHarnessRuntime(getCurrentRuntimeInfo(), result.installedVersion);
    return { installedVersion: result.installedVersion, source: 'cli', error: null };
  } catch (error) {
    return {
      installedVersion: null,
      source: 'unknown',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getCurrentRuntimeInfo(): RuntimeInfo {
  // Importing RuntimeManager here would create a registry/runtime cycle.
  const current = getCoreSnapshot().runtimeInstances.find((runtime) => runtime.id === DEEPSEEK_HARNESS_RUNTIME_ID);
  return {
    status: current?.status ?? 'STOPPED',
    pid: typeof current?.nativeMetadata.pid === 'number' ? current.nativeMetadata.pid : null,
    url: typeof current?.nativeMetadata.url === 'string' ? current.nativeMetadata.url : null,
    error: typeof current?.nativeMetadata.error === 'string' ? current.nativeMetadata.error : null,
    startedAt: typeof current?.nativeMetadata.startedAt === 'string' ? current.nativeMetadata.startedAt : null,
    readiness: current?.nativeMetadata.readiness === 'PROCESS_RUNNING'
      || current?.nativeMetadata.readiness === 'PORT_READY'
      || current?.nativeMetadata.readiness === 'WEB_READY'
      || current?.nativeMetadata.readiness === 'PAGE_READY'
      ? current.nativeMetadata.readiness
      : 'NOT_STARTED',
  };
}

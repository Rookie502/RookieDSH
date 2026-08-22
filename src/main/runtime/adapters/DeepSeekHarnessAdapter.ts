import type { DshCapabilitySet } from '@shared/runtimeBindingTypes';
import type { RuntimeInfo } from '@shared/types';
import { checkDeepSeekHarnessVersion, syncDeepSeekHarnessRuntime } from '../RuntimeRegistry';
import {
  detectDsh,
  getRuntimeStatus,
  startRuntime,
  stopRuntime,
} from '../RuntimeManager';
import { DshProviderBridge } from '../dsh/DshProviderBridge';
import { RuntimeAdapter, type RuntimeDescription } from './RuntimeAdapter';

export class DeepSeekHarnessAdapter implements RuntimeAdapter {
  constructor(private readonly providers = new DshProviderBridge()) {}

  async describe(): Promise<RuntimeDescription> {
    return {
      id: 'deepseek-harness',
      name: 'DeepSeek Harness',
      type: 'deepseek-harness',
      capabilities: await this.getCapabilities(),
    };
  }

  async detect(): Promise<boolean> {
    return detectDsh();
  }

  getStatus(): RuntimeInfo {
    return getRuntimeStatus();
  }

  async getVersion(): Promise<string | null> {
    const result = await checkDeepSeekHarnessVersion();
    if (result.installedVersion) {
      this.providers.invalidate();
      syncDeepSeekHarnessRuntime(getRuntimeStatus(), result.installedVersion);
    }
    return result.installedVersion;
  }

  async getCapabilities(): Promise<DshCapabilitySet> {
    return this.providers.getCapabilities();
  }

  async start(): Promise<void> {
    await startRuntime();
  }

  async stop(): Promise<void> {
    await stopRuntime();
  }

  async restart(): Promise<void> {
    const status = getRuntimeStatus().status;
    if (status !== 'STOPPED' && status !== 'FAILED') await stopRuntime();
    await startRuntime();
  }
}

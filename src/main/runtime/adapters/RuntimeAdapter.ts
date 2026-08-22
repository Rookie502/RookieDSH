import type { RuntimeInfo, RuntimeStatus } from '@shared/types';
import type { DshCapabilitySet } from '@shared/runtimeBindingTypes';

export interface RuntimeDescription {
  id: string;
  name: string;
  type: string;
  capabilities: DshCapabilitySet;
}

export interface RuntimeAdapter {
  describe(): Promise<RuntimeDescription>;
  detect(): Promise<boolean>;
  getStatus(): RuntimeInfo;
  getVersion(): Promise<string | null>;
  getCapabilities(): Promise<DshCapabilitySet>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
}

export type { RuntimeInfo, RuntimeStatus };

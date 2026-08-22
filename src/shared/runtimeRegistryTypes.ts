import type { RuntimeInfo, RuntimeStatus } from './types';

export type RegisteredRuntimeType = 'deepseek-harness';

export interface RuntimeInstance {
  id: string;
  type: RegisteredRuntimeType;
  version: string | null;
  status: RuntimeStatus;
  capabilities: string[];
  nativeMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeVersionInfo {
  installedVersion: string | null;
  source: 'cli' | 'unknown';
  error: string | null;
}

export type RuntimeRegistryStatusInput = RuntimeInfo;

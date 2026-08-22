export type RuntimeModelBindingStatus = 'UNBOUND' | 'SYNCED' | 'DRIFT' | 'ERROR';

export interface RuntimeModelBinding {
  id: string;
  runtimeId: string;
  endpointId: string;
  nativeProviderId: string;
  modelId: string;
  status: RuntimeModelBindingStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface DshCapabilitySet {
  providerRead: boolean;
  providerWrite: boolean;
  credentialRead: boolean;
  credentialWrite: boolean;
  modelDiscovery: boolean;
  defaultModelSelection: boolean;
  acp: 'detected' | 'unavailable' | 'unknown';
  compatibilityWarning: string | null;
  dshVersion: string | null;
  probedAt: string | null;
}

export interface DshCredentialStatus {
  configured: boolean;
  source: string | null;
  writable: boolean;
}

export interface DshProvider {
  provider: string;
  displayName: string;
  settingsNs: string;
  settingsPath: string[];
  active: boolean;
  declared: boolean | null;
  baseUrl: string | null;
  api: string | null;
  models: string[];
  credentialRef: string | null;
  credential: DshCredentialStatus | null;
}

export interface DshProviderModelGroup {
  provider: string;
  name: string;
  models: string[];
}

export interface DshProviderSnapshot {
  providers: DshProvider[];
  modelGroups: DshProviderModelGroup[];
  bindings: RuntimeModelBinding[];
  capabilities: DshCapabilitySet;
  checkedAt: string;
  error: string | null;
}

export interface RuntimeBindingInput {
  endpointId: string;
  nativeProviderId?: string;
  modelId?: string;
}

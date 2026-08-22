export type ModelEndpointType = 'local' | 'lan' | 'cloud';
export type ModelEndpointProtocol = 'openai-compatible';
export type ModelEndpointStatus = 'UNKNOWN' | 'CHECKING' | 'ONLINE' | 'OFFLINE' | 'STALE';
export type ModelEndpointKnownStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type ModelResourceState = 'DISCOVERED' | 'AVAILABLE' | 'LOADED' | 'UNKNOWN';

export interface ModelEndpoint {
  id: string;
  name: string;
  type: ModelEndpointType;
  protocol: ModelEndpointProtocol;
  baseUrl: string;
  status: ModelEndpointStatus;
  lastKnownStatus: ModelEndpointKnownStatus;
  models: string[];
  /** Per-model state; discovery never implies that a model is loaded in memory. */
  modelStates: Record<string, ModelResourceState>;
  /** Null means the endpoint capability has not been probed; false is the safe default for OpenAI-compatible endpoints. */
  supportsLoadedModelQuery: boolean | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelEndpointInput {
  name: string;
  type: ModelEndpointType;
  protocol: ModelEndpointProtocol;
  baseUrl: string;
}

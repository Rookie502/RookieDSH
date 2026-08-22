import { randomUUID } from 'node:crypto';
import type {
  ModelEndpoint,
  ModelEndpointInput,
  ModelEndpointProtocol,
  ModelEndpointStatus,
  ModelEndpointType,
} from '@shared/modelTypes';
import { getCoreSnapshot, updateCoreSnapshot } from '../core/store/coreStore';
import { createDiscoveredModelStates, deriveEndpointStatus, type ModelEndpointKnownStatus } from './endpointHealth';

const MODEL_REQUEST_TIMEOUT_MS = 4_000;
const inFlightChecks = new Map<string, Promise<ModelEndpoint>>();

export function listModelEndpoints(): ModelEndpoint[] {
  return getCoreSnapshot().modelEndpoints.map((endpoint) => ({
    ...endpoint,
    status: endpoint.status === 'CHECKING'
      ? 'CHECKING'
      : deriveEndpointStatus(endpoint.lastKnownStatus ?? endpoint.status as ModelEndpointKnownStatus, endpoint.lastCheckedAt),
  }));
}

export function addModelEndpoint(input: ModelEndpointInput): ModelEndpoint {
  const name = input.name.trim();
  if (!name) throw new Error('Model endpoint name is required.');
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const timestamp = new Date().toISOString();
  const endpoint: ModelEndpoint = {
    id: randomUUID(),
    name,
    type: normalizeType(input.type),
    protocol: normalizeProtocol(input.protocol),
    baseUrl,
    status: 'UNKNOWN',
    lastKnownStatus: 'UNKNOWN',
    models: [],
    modelStates: {},
    supportsLoadedModelQuery: false,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  updateCoreSnapshot((database) => {
    database.modelEndpoints.push(endpoint);
  });
  return endpoint;
}

export function removeModelEndpoint(id: string): boolean {
  let removed = false;
  updateCoreSnapshot((database) => {
    const index = database.modelEndpoints.findIndex((endpoint) => endpoint.id === id);
    if (index < 0) return;
    database.modelEndpoints.splice(index, 1);
    removed = true;
    for (const workspace of database.workspaces) {
      if (workspace.modelEndpointId === id) workspace.modelEndpointId = null;
    }
  });
  return removed;
}

export async function checkModelEndpoint(id: string): Promise<ModelEndpoint> {
  const existing = inFlightChecks.get(id);
  if (existing) return existing;
  const check = checkModelEndpointOnce(id).finally(() => inFlightChecks.delete(id));
  inFlightChecks.set(id, check);
  return check;
}

async function checkModelEndpointOnce(id: string): Promise<ModelEndpoint> {
  const endpoint = setEndpointStatus(id, 'CHECKING', null);
  try {
    const timestamp = new Date().toISOString();
    const models = await fetchModels(endpoint);
    return updateEndpoint(id, {
      status: 'ONLINE',
      lastKnownStatus: 'ONLINE',
      models,
      modelStates: createDiscoveredModelStates(models),
      supportsLoadedModelQuery: false,
      lastCheckedAt: timestamp,
      lastSuccessAt: timestamp,
      lastError: null,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return updateEndpoint(id, {
      status: 'OFFLINE',
      lastCheckedAt: new Date().toISOString(),
      lastKnownStatus: 'OFFLINE',
      lastError: message,
      error: message,
    });
  }
}

export async function discoverModelEndpoint(id: string): Promise<ModelEndpoint> {
  return checkModelEndpoint(id);
}

function setEndpointStatus(id: string, status: ModelEndpointStatus, error: string | null): ModelEndpoint {
  return updateEndpoint(id, { status, error });
}

function updateEndpoint(id: string, patch: Partial<ModelEndpoint>): ModelEndpoint {
  let updated: ModelEndpoint | null = null;
  updateCoreSnapshot((database) => {
    const endpoint = database.modelEndpoints.find((candidate) => candidate.id === id);
    if (!endpoint) throw new Error(`Model endpoint not found: ${id}`);
    Object.assign(endpoint, patch, { updatedAt: new Date().toISOString() });
    updated = endpoint;
  });
  if (!updated) throw new Error(`Model endpoint not found: ${id}`);
  return updated;
}

async function fetchModels(endpoint: ModelEndpoint): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(modelsUrl(endpoint.baseUrl), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.data)) throw new Error('Endpoint returned an invalid /v1/models response');
    return payload.data
      .map((model) => isRecord(model) && typeof model.id === 'string' ? model.id : null)
      .filter((model): model is string => model !== null);
  } finally {
    clearTimeout(timer);
  }
}

function modelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/models`;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Model endpoint URL is required.');
  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Model endpoint URL must use HTTP or HTTPS.');
  return url.toString().replace(/\/$/, '');
}

function normalizeType(value: ModelEndpointType): ModelEndpointType {
  return value === 'lan' || value === 'cloud' ? value : 'local';
}

function normalizeProtocol(value: ModelEndpointProtocol): ModelEndpointProtocol {
  if (value !== 'openai-compatible') throw new Error(`Unsupported model endpoint protocol: ${value}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

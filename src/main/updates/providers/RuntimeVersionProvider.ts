import { checkDeepSeekHarnessVersion } from '../../runtime/RuntimeRegistry';
import type { VersionSourceInfo } from '../updateTypes';

export const DEEPSEEK_HARNESS_PACKAGE_URL = 'https://www.npmjs.com/package/@deepseek-ai/dsh';
const UPDATE_REQUEST_TIMEOUT_MS = 6_000;

export async function getInstalledDeepSeekHarnessVersion() {
  return checkDeepSeekHarnessVersion();
}

export async function getLatestDeepSeekHarnessVersion(): Promise<VersionSourceInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('https://registry.npmjs.org/@deepseek-ai%2fdsh/latest', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`DeepSeek Harness package registry returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.version !== 'string') {
    throw new Error('DeepSeek Harness package registry returned an invalid response.');
  }
  return {
    latestVersion: payload.version,
    releaseUrl: DEEPSEEK_HARNESS_PACKAGE_URL,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

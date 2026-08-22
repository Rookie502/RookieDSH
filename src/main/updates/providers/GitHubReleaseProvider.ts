import type { ReleaseInfo } from '../updateTypes';

export const ROOKIE_DSH_REPOSITORY_URL = 'https://github.com/Rookie502/RookieDSH';
const UPDATE_REQUEST_TIMEOUT_MS = 6_000;

export async function getLatestRookieDshRelease(): Promise<ReleaseInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('https://api.github.com/repos/Rookie502/RookieDSH/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'RookieDSH-Update-Checker',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    return { latestVersion: null, releaseNotes: null, releaseUrl: ROOKIE_DSH_REPOSITORY_URL };
  }
  if (!response.ok) throw new Error(`GitHub release API returned HTTP ${response.status}`);

  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error('GitHub release API returned an invalid response.');
  const tag = typeof payload.tag_name === 'string' ? payload.tag_name : null;
  return {
    latestVersion: normalizeVersion(tag),
    releaseNotes: typeof payload.body === 'string' ? payload.body : null,
    releaseUrl: typeof payload.html_url === 'string' ? payload.html_url : ROOKIE_DSH_REPOSITORY_URL,
  };
}

function normalizeVersion(value: string | null): string | null {
  return value?.replace(/^v/i, '') ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

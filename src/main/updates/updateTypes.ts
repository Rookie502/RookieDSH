import type { CompatibilityStatus, SoftwareVersion, UpdateCheck, UpdateStatus, UpdateTarget } from '@shared/updateTypes';

export type { CompatibilityStatus, SoftwareVersion, UpdateCheck, UpdateStatus, UpdateTarget };

export interface ReleaseInfo {
  latestVersion: string | null;
  releaseNotes: string | null;
  releaseUrl: string | null;
}

export interface VersionSourceInfo {
  latestVersion: string | null;
  releaseUrl: string | null;
}

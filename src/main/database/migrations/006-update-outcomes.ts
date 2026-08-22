import type { CoreDatabaseDocument } from '../../core/types/coreTypes';
import type {
  RuntimeUpdateHistoryStatus,
  RuntimeUpdateOutcome,
  RuntimeUpdateInstallationResult,
  RuntimeUpdateRestartResult,
  UpdateHistory,
} from '@shared/updateTypes';

export const UPDATE_OUTCOME_SCHEMA_VERSION = 6;

export function migrateToUpdateOutcomeSchema(
  database: Omit<CoreDatabaseDocument, 'schemaVersion'> & { schemaVersion: number },
): CoreDatabaseDocument {
  return {
    ...database,
    schemaVersion: UPDATE_OUTCOME_SCHEMA_VERSION,
    updateHistory: database.updateHistory.map((item) => {
      const legacy = item as UpdateHistory & Partial<{
        installationResult: RuntimeUpdateInstallationResult;
        restartResult: RuntimeUpdateRestartResult;
        outcome: RuntimeUpdateOutcome;
      }>;
      return {
        ...legacy,
        installationResult: legacy.installationResult ?? inferInstallationResult(legacy.status),
        restartResult: legacy.restartResult ?? inferRestartResult(legacy.status),
        outcome: legacy.outcome ?? inferOutcome(legacy.status),
      };
    }),
  };
}

function inferInstallationResult(status: RuntimeUpdateHistoryStatus): RuntimeUpdateInstallationResult {
  return status === 'SUCCESS' || status === 'ROLLED_BACK' ? 'INSTALL_SUCCEEDED' : 'NOT_ATTEMPTED';
}

function inferRestartResult(status: RuntimeUpdateHistoryStatus): RuntimeUpdateRestartResult {
  return status === 'SUCCESS' ? 'RESTART_SUCCEEDED' : 'NOT_REQUIRED';
}

function inferOutcome(status: RuntimeUpdateHistoryStatus): RuntimeUpdateOutcome {
  return status === 'SUCCESS' ? 'SUCCEEDED' : 'FAILED';
}

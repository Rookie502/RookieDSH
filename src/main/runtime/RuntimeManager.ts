/**
 * Stable Runtime lifecycle facade.
 *
 * The existing dshProcess implementation remains the compatibility-backed
 * state machine for this pass. Keeping this public surface separate lets the
 * main process stop depending on a DeepSeek-specific filename while avoiding
 * a risky rewrite of the proven Windows cleanup behavior.
 */
export {
  cleanupDshSync,
  detectDsh,
  getDshLogs as getRuntimeLogs,
  getDshState as getRuntimeStatus,
  markDshPageReady as markRuntimePageReady,
  onDshStatusChanged,
  stopDsh as stopRuntime,
} from './dshProcess';

import { startDsh, type RuntimeStartOptions } from './dshProcess';

export function startRuntime(options?: RuntimeStartOptions): Promise<void> {
  return startDsh(options);
}

export type { RuntimeStartOptions };

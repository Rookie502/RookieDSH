import type { RuntimeInfo } from '@shared/types';

export type {
  RuntimeInfo,
  RuntimeLogEntry,
  RuntimeLogStream,
  RuntimeStatus,
} from '@shared/types';

export interface RuntimeLaunchSpec {
  command: string;
  args: string[];
  shell?: boolean;
  label: string;
}

export type RuntimeStatusListener = (info: RuntimeInfo) => void;

export const INITIAL_RUNTIME_INFO: RuntimeInfo = {
  status: 'STOPPED',
  pid: null,
  url: null,
  error: null,
  startedAt: null,
};

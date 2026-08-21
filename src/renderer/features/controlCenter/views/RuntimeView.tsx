import type { RuntimeDiagnostics, RuntimeInfo, RuntimeLogEntry } from '@shared/types';
import RuntimeCard from '../RuntimeCard';
import DiagnosticsCard from '../DiagnosticsCard';

interface RuntimeViewProps {
  info: RuntimeInfo;
  now: number;
  diagnostics: RuntimeDiagnostics;
  logs: RuntimeLogEntry[];
  actionError: string | null;
  onRestart: () => void;
  onStop: () => void;
}

export default function RuntimeView({ info, now, diagnostics, logs, actionError, onRestart, onStop }: RuntimeViewProps) {
  return (
    <div className="control-center-view-stack">
      <RuntimeCard
        info={info}
        now={now}
        busy={info.status === 'STARTING' || info.status === 'STOPPING'}
        actionError={actionError}
        onRestart={onRestart}
        onStop={onStop}
      />
      <DiagnosticsCard diagnostics={diagnostics} logs={logs} />
    </div>
  );
}

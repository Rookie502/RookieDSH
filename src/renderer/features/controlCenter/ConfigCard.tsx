import type { RookieDshConfig } from '@shared/configTypes';

export default function ConfigCard({ config }: { config: RookieDshConfig | null }) {
  return (
    <article className="control-card config-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">Configuration</div>
          <h2>Runtime defaults</h2>
        </div>
        <span className="readonly-label">Read only</span>
      </div>

      {!config ? (
        <p className="muted-text">Loading configuration…</p>
      ) : (
        <div className="config-list">
          <ConfigValue label="Command" value={config.runtime.command} />
          <ConfigValue label="Port" value={String(config.runtime.port)} />
          <ConfigValue label="Auto Start" value={String(config.runtime.autoStart)} />
          <ConfigValue label="Control Center" value={`${config.controlCenter.width}px`} />
        </div>
      )}
    </article>
  );
}

function ConfigValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="config-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

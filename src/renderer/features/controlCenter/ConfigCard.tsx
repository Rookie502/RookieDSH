import type { RookieDshConfig } from '@shared/configTypes';
import { t } from '../../i18n';

export default function ConfigCard({ config }: { config: RookieDshConfig | null }) {
  return (
    <article className="control-card config-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">{t('configuration.eyebrow')}</div>
          <h2>{t('configuration.title')}</h2>
        </div>
        <span className="readonly-label">{t('configuration.readOnly')}</span>
      </div>

      {!config ? (
        <p className="muted-text">{t('configuration.loading')}</p>
      ) : (
        <div className="config-list">
          <ConfigValue label={t('configuration.command')} value={config.runtime.command} />
          <ConfigValue label={t('configuration.port')} value={String(config.runtime.port)} />
          <ConfigValue label={t('configuration.autoStart')} value={String(config.runtime.autoStart)} />
          <ConfigValue label={t('configuration.startTimeout')} value={`${config.runtime.startTimeout / 1000}s`} />
          <ConfigValue label={t('configuration.updateRestartTimeout')} value={`${config.runtime.updateRestartTimeout / 1000}s`} />
          <ConfigValue label={t('configuration.controlCenterWidth')} value={`${config.controlCenter.width}px`} />
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

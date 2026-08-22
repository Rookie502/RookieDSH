import type { Language, RookieDshConfig, UpdateConfig } from '@shared/configTypes';
import { t } from '../../../i18n';

interface SettingsViewProps {
  config: RookieDshConfig | null;
  language: Language;
  onUpdatePreferences: (updates: UpdateConfig) => void;
}

export default function SettingsView({ config, language, onUpdatePreferences }: SettingsViewProps) {
  return (
    <div className="control-center-view-stack">
      <article className="control-card settings-card">
        <div className="card-kicker">{t('settings.eyebrow')}</div>
        <h2>{t('settings.title')}</h2>
        <p className="muted-text">{t('settings.readOnly')}</p>
        {!config ? (
          <p className="muted-text">{t('common.loading')}</p>
        ) : (
          <div className="config-list">
            <ConfigValue
              label={t('settings.language')}
              value={language === 'zh-CN' ? t('controlCenter.chinese') : t('controlCenter.english')}
            />
            <ConfigValue label={t('settings.controlCenterWidth')} value={`${config.controlCenter.width}px`} />
            <ConfigValue label={t('settings.runtimeAutoStart')} value={String(config.runtime.autoStart)} />
            <ConfigValue label={t('settings.runtimeCommand')} value={config.runtime.command} />
            <ConfigValue label={t('settings.startTimeout')} value={`${config.runtime.startTimeout / 1000}s`} />
            <ConfigValue label={t('settings.updateRestartTimeout')} value={`${config.runtime.updateRestartTimeout / 1000}s`} />
          </div>
        )}
      </article>
      {config && (
        <article className="control-card settings-card">
          <div className="card-kicker">{t('settings.updatePreferences')}</div>
          <h2>{t('settings.updatePreferences')}</h2>
          <div className="config-list">
            <label className="config-input-row">
              <span>{t('settings.autoCheck')}</span>
              <input
                type="checkbox"
                checked={config.updates.autoCheck}
                onChange={(event) => onUpdatePreferences({ ...config.updates, autoCheck: event.target.checked })}
              />
            </label>
            <label className="config-input-row">
              <span>{t('settings.checkFrequency')}</span>
              <select
                value={config.updates.checkFrequency}
                onChange={(event) => onUpdatePreferences({ ...config.updates, checkFrequency: event.target.value as UpdateConfig['checkFrequency'] })}
              >
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="manual">manual</option>
              </select>
            </label>
          </div>
        </article>
      )}
    </div>
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

import type { RookieDshConfig, Language } from '@shared/configTypes';
import { t } from '../../../i18n';

interface SettingsViewProps {
  config: RookieDshConfig | null;
  language: Language;
}

export default function SettingsView({ config, language }: SettingsViewProps) {
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
          </div>
        )}
      </article>
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

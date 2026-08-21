import { t } from '../../../i18n';

export default function ModelsView() {
  return (
    <div className="control-center-view-stack">
      <article className="control-card placeholder-card">
        <div className="card-kicker">{t('models.eyebrow')}</div>
        <h2>{t('models.title')}</h2>
        <p>{t('models.placeholder')}</p>
        <div className="placeholder-detail">
          <span>{t('models.endpoint')}</span>
          <strong>{t('models.noEndpoint')}</strong>
        </div>
      </article>
    </div>
  );
}

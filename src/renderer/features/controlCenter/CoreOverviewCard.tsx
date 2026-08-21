import type { CoreOverview } from '@shared/types';
import { t } from '../../i18n';

interface CoreOverviewCardProps {
  overview: CoreOverview | null;
}

export default function CoreOverviewCard({ overview }: CoreOverviewCardProps) {
  return (
    <section className="control-card core-overview-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">{t('overview.eyebrow')}</div>
          <h2>{t('overview.title')}</h2>
        </div>
        <span className="readonly-label">{t('overview.localControlPlane')}</span>
      </div>

      <div className="core-metrics">
        <div className="core-metric">
          <span>{t('overview.workspaces')}</span>
          <strong>{overview?.workspaceCount ?? '—'}</strong>
        </div>
        <div className="core-metric">
          <span>{t('overview.activeRuns')}</span>
          <strong>{overview?.activeRunCount ?? '—'}</strong>
        </div>
        <div className="core-metric">
          <span>{t('overview.completedTasks')}</span>
          <strong>{overview?.completedTaskCount ?? '—'}</strong>
        </div>
      </div>

      <div className="core-latest-event">
        <span>{t('overview.latestEvent')}</span>
        <strong>{overview?.latestEvent?.type ?? t('overview.noEvents')}</strong>
      </div>
    </section>
  );
}

import type { CoreOverview } from '@shared/types';

interface CoreOverviewCardProps {
  overview: CoreOverview | null;
}

export default function CoreOverviewCard({ overview }: CoreOverviewCardProps) {
  return (
    <section className="control-card core-overview-card">
      <div className="card-heading">
        <div>
          <div className="card-kicker">Platform Foundation</div>
          <h2>RookieDSH Core</h2>
        </div>
        <span className="readonly-label">Local control plane</span>
      </div>

      <div className="core-metrics">
        <div className="core-metric">
          <span>Workspaces</span>
          <strong>{overview?.workspaceCount ?? '—'}</strong>
        </div>
        <div className="core-metric">
          <span>Active runs</span>
          <strong>{overview?.activeRunCount ?? '—'}</strong>
        </div>
        <div className="core-metric">
          <span>Completed tasks</span>
          <strong>{overview?.completedTaskCount ?? '—'}</strong>
        </div>
      </div>

      <div className="core-latest-event">
        <span>Latest event</span>
        <strong>{overview?.latestEvent?.type ?? 'No events recorded'}</strong>
      </div>
    </section>
  );
}

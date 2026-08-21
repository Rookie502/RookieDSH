import { useEffect, useState } from 'react';
import type { Workspace } from '@shared/coreTypes';
import { t } from '../../../i18n';

export default function WorkspaceView() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void window.rookiedsh?.core.workspaces.list()
      .then((nextWorkspaces) => {
        if (!disposed) setWorkspaces(nextWorkspaces);
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { disposed = true; };
  }, []);

  return (
    <div className="control-center-view-stack">
      <article className="control-card">
        <div className="card-kicker">{t('workspace.eyebrow')}</div>
        <h2>{t('workspace.title')}</h2>
        <p>{t('workspace.placeholder')}</p>
        {error && <div className="inline-error">{error}</div>}
        {!workspaces && !error && <p className="muted-text">{t('workspace.loading')}</p>}
        {workspaces && workspaces.length === 0 && <p className="muted-text">{t('workspace.empty')}</p>}
        {workspaces && workspaces.length > 0 && (
          <div className="entity-list">
            {workspaces.map((workspace) => (
              <div className="entity-row" key={workspace.id}>
                <strong>{workspace.name}</strong>
                <span><em>{t('workspace.path')}</em>{workspace.path}</span>
                <span><em>{t('workspace.updated')}</em>{formatDate(workspace.updatedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

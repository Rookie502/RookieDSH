import { useEffect, useState } from 'react';
import type { Task } from '@shared/coreTypes';
import { t } from '../../../i18n';

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void window.rookiedsh?.core.tasks.list()
      .then((nextTasks) => {
        if (!disposed) setTasks(nextTasks);
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { disposed = true; };
  }, []);

  return (
    <div className="control-center-view-stack">
      <article className="control-card">
        <div className="card-kicker">{t('tasks.eyebrow')}</div>
        <h2>{t('tasks.title')}</h2>
        <p>{t('tasks.placeholder')}</p>
        {error && <div className="inline-error">{error}</div>}
        {!tasks && !error && <p className="muted-text">{t('tasks.loading')}</p>}
        {tasks && tasks.length === 0 && <p className="muted-text">{t('tasks.empty')}</p>}
        {tasks && tasks.length > 0 && (
          <div className="entity-list">
            {tasks.map((task) => (
              <div className="entity-row" key={task.id}>
                <strong>{task.title}</strong>
                <span><em>{t('tasks.workspace')}</em>{task.workspaceId}</span>
                <span><em>{t('tasks.status')}</em>{task.status}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}

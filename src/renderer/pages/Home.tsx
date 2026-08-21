import { t } from '../i18n';

export default function Home() {
  return (
    <section className="page">
      <h1>{t('controlCenter.views.overview')}</h1>
      <p>RookieDSH v0.3.3 — Desktop Runtime Host and local control-plane foundation.</p>
    </section>
  );
}

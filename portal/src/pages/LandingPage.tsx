import { appUrl } from '../lib/site.js';
import { AppLogo } from '../components/AppLogo.js';
import { useTranslation } from '../i18n/index.js';

function CtaLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href={appUrl('/register')}
      className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </a>
  );
}

export function LandingPage() {
  const { t } = useTranslation();

  const audiences = [
    { title: t('portal.landing.forClubTitle'), body: t('portal.landing.forClubBody') },
    { title: t('portal.landing.forTripTitle'), body: t('portal.landing.forTripBody') },
    { title: t('portal.landing.forVisitorTitle'), body: t('portal.landing.forVisitorBody') },
  ];
  const features = [
    { title: t('portal.landing.f1Title'), body: t('portal.landing.f1Body') },
    { title: t('portal.landing.f2Title'), body: t('portal.landing.f2Body') },
    { title: t('portal.landing.f3Title'), body: t('portal.landing.f3Body') },
    { title: t('portal.landing.f4Title'), body: t('portal.landing.f4Body') },
  ];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <AppLogo size={32} />
          <span className="text-lg font-semibold">MeetingPnt</span>
        </div>
        <a href={appUrl('/login')} className="text-sm font-medium text-accent-text hover:underline">
          {t('portal.landing.signIn')}
        </a>
      </header>

      <section className="bg-accent-surface">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('portal.landing.heroTitle')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-secondary">
            {t('portal.landing.heroBody')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaLink>{t('portal.landing.cta')}</CtaLink>
            <a href="#how" className="px-4 py-3 text-sm font-medium text-accent-text hover:underline">
              {t('portal.landing.seeHow')}
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">{t('portal.landing.howTitle')}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h3 className="text-lg font-semibold">{t('portal.landing.planTitle')}</h3>
            <p className="mt-2 text-ink-secondary">{t('portal.landing.planBody')}</p>
          </div>
          {/* Accent is for "where the group is now" — the mobile card is the live half. */}
          <div className="rounded-xl border border-accent bg-accent-surface p-6">
            <h3 className="text-lg font-semibold">{t('portal.landing.runTitle')}</h3>
            <p className="mt-2 text-ink-secondary">{t('portal.landing.runBody')}</p>
          </div>
        </div>
      </section>

      <section className="bg-surface-sunken">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">{t('portal.landing.forTitle')}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.title} className="rounded-xl border border-line bg-surface p-6">
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-ink-secondary">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">{t('portal.landing.featuresTitle')}</h2>
        <dl className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title}>
              <dt className="font-semibold">{f.title}</dt>
              <dd className="mt-1 text-sm text-ink-secondary">{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-accent-surface">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">{t('portal.landing.closingTitle')}</h2>
          <p className="mt-3 text-ink-secondary">{t('portal.landing.closingBody')}</p>
          <div className="mt-6">
            <CtaLink>{t('portal.landing.cta')}</CtaLink>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-6 text-sm text-ink-muted">
        {t('portal.landing.footer')}
      </footer>
    </div>
  );
}

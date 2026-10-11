import type { ReactNode } from 'react';
import { LOCALES, type Locale } from '@meetingpnt/shared';
import { AppLogo } from '../components/AppLogo.js';
import { Icon, IconTile, PhoneMock, SectionTitle, type IconName } from '../components/landing/art.js';
import { i18n, useLocale, useTranslation } from '../i18n/index.js';
import { appUrl } from '../lib/site.js';

const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', he: 'עברית' };

function CtaLink({ children, variant = 'primary' }: { children: ReactNode; variant?: 'primary' | 'onDark' }) {
  const look =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-strong'
      : 'bg-surface text-accent-text hover:bg-accent-surface';
  return (
    <a
      href={appUrl('/register')}
      className={`inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${look}`}
    >
      {children}
    </a>
  );
}

/** Signed out, so there's no profile to store the choice on — the page just switches. */
function LanguageToggle() {
  const current = useLocale();
  return (
    <div className="flex gap-1 text-sm">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            void i18n.changeLanguage(l);
            document.documentElement.lang = l;
            document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr';
            try {
              localStorage.setItem('mp-locale', l);
            } catch {
              /* private mode — the switch still applies for this visit */
            }
          }}
          className={`rounded px-2 py-1 ${l === current ? 'font-semibold text-ink' : 'text-ink-secondary hover:text-ink'}`}
        >
          {LANGUAGE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation();

  const values: { icon: IconName; title: string; body: string }[] = [
    { icon: 'signal', title: t('portal.landing.v1Title'), body: t('portal.landing.v1Body') },
    { icon: 'pin', title: t('portal.landing.v2Title'), body: t('portal.landing.v2Body') },
    { icon: 'check', title: t('portal.landing.v3Title'), body: t('portal.landing.v3Body') },
  ];
  const pains = [t('portal.landing.pain1'), t('portal.landing.pain2'), t('portal.landing.pain3')];
  const steps: { icon: IconName; title: string; body: string }[] = [
    { icon: 'laptop', title: t('portal.landing.s1Title'), body: t('portal.landing.s1Body') },
    { icon: 'userPlus', title: t('portal.landing.s2Title'), body: t('portal.landing.s2Body') },
    { icon: 'phone', title: t('portal.landing.s3Title'), body: t('portal.landing.s3Body') },
  ];
  const features: { icon: IconName; title: string; body: string }[] = [
    { icon: 'signal', title: t('portal.landing.f1Title'), body: t('portal.landing.f1Body') },
    { icon: 'check', title: t('portal.landing.f2Title'), body: t('portal.landing.f2Body') },
    { icon: 'route', title: t('portal.landing.f3Title'), body: t('portal.landing.f3Body') },
    { icon: 'calendar', title: t('portal.landing.f4Title'), body: t('portal.landing.f4Body') },
    { icon: 'chat', title: t('portal.landing.f5Title'), body: t('portal.landing.f5Body') },
    { icon: 'userPlus', title: t('portal.landing.f6Title'), body: t('portal.landing.f6Body') },
  ];
  const audiences = [
    { title: t('portal.landing.forClubTitle'), body: t('portal.landing.forClubBody') },
    { title: t('portal.landing.forTripTitle'), body: t('portal.landing.forTripBody') },
    { title: t('portal.landing.forVisitorTitle'), body: t('portal.landing.forVisitorBody') },
  ];
  const privacy = [t('portal.landing.privacy1'), t('portal.landing.privacy2'), t('portal.landing.privacy3')];
  const plan = [t('portal.landing.plan1'), t('portal.landing.plan2'), t('portal.landing.plan3')];
  const faq = [
    { q: t('portal.landing.q1'), a: t('portal.landing.a1') },
    { q: t('portal.landing.q2'), a: t('portal.landing.a2') },
    { q: t('portal.landing.q3'), a: t('portal.landing.a3') },
    { q: t('portal.landing.q4'), a: t('portal.landing.a4') },
    { q: t('portal.landing.q5'), a: t('portal.landing.a5') },
  ];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <a href="#top" className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="hidden text-lg font-semibold sm:inline">MeetingPnt</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-secondary md:flex">
            <a href="#features" className="hover:text-ink">{t('portal.landing.navFeatures')}</a>
            <a href="#how" className="hover:text-ink">{t('portal.landing.navHow')}</a>
            <a href="#pricing" className="hover:text-ink">{t('portal.landing.navPricing')}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <a
              href={appUrl('/login')}
              className="hidden text-sm font-medium text-accent-text hover:underline sm:inline"
            >
              {t('portal.landing.signIn')}
            </a>
            <a
              href={appUrl('/register')}
              className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
            >
              {t('portal.landing.cta')}
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero: the promise, a way in, and a picture of the day itself. */}
        <section className="overflow-hidden bg-gradient-to-b from-accent-surface to-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
            <div className="text-center lg:text-start">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent-text">
                {t('portal.landing.eyebrow')}
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                {t('portal.landing.heroTitle1')}
                <br />
                <span className="text-accent-text">{t('portal.landing.heroTitle2')}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-ink-secondary lg:mx-0">
                {t('portal.landing.heroBody')}
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
                <CtaLink>{t('portal.landing.cta')}</CtaLink>
                <a href="#how" className="px-4 py-3 text-sm font-medium text-accent-text hover:underline">
                  {t('portal.landing.seeHow')}
                </a>
              </div>
              <p className="mt-3 text-sm text-ink-muted">{t('portal.landing.heroNote')}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-neutral-bg px-3 py-1 text-xs font-medium text-tone-neutral-fg">
                  <Icon name="laptop" className="size-4" />
                  {t('portal.landing.chipPlan')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-accent-bg px-3 py-1 text-xs font-medium text-tone-accent-fg">
                  <Icon name="phone" className="size-4" />
                  {t('portal.landing.chipRun')}
                </span>
              </div>
            </div>
            <PhoneMock />
          </div>
        </section>

        {/* The three things a leader is actually buying. */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionTitle>{t('portal.landing.valueTitle')}</SectionTitle>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <IconTile name={v.icon} />
                <h3 className="mt-4 text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-ink-secondary">{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The pain, in the leader's own words. */}
        <section className="bg-surface-sunken">
          <div className="mx-auto max-w-4xl px-6 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t('portal.landing.painTitle')}</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {pains.map((p) => (
                <li
                  key={p}
                  className="rounded-xl border border-line bg-surface px-4 py-5 text-ink-secondary"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16">
          <SectionTitle>{t('portal.landing.stepsTitle')}</SectionTitle>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-surface p-6">
                <span className="absolute -top-3 start-6 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-surface">
                  {i + 1}
                </span>
                <IconTile name={s.icon} tone={i === 2 ? 'accent' : 'neutral'} />
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-ink-secondary">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="scroll-mt-16 bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionTitle>{t('portal.landing.featuresTitle')}</SectionTitle>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-2xl border border-line bg-surface p-6">
                  <IconTile name={f.icon} tone="neutral" />
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-ink-secondary">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionTitle>{t('portal.landing.forTitle')}</SectionTitle>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.title} className="rounded-2xl border border-line bg-surface p-6">
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm text-ink-secondary">{a.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-sunken">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-14 text-center md:flex-row md:text-start">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-tone-success-bg text-tone-success-fg">
              <Icon name="shield" className="size-7" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t('portal.landing.privacyTitle')}</h2>
              <ul className="mt-3 space-y-1 text-ink-secondary">
                {privacy.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16">
          <SectionTitle>{t('portal.landing.pricingTitle')}</SectionTitle>
          <p className="mt-3 text-center text-ink-secondary">{t('portal.landing.pricingLead')}</p>
          <div className="mx-auto mt-10 max-w-sm rounded-2xl border-2 border-accent bg-surface p-8 text-center shadow-lg shadow-accent/10">
            <p className="font-semibold text-accent-text">{t('portal.landing.planName')}</p>
            <p className="mt-2 text-5xl font-bold tracking-tight">{t('portal.landing.planPrice')}</p>
            <p className="mt-1 text-sm text-ink-secondary">{t('portal.landing.planNote')}</p>
            <ul className="mt-6 space-y-2 text-start text-sm">
              {plan.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Icon name="check" className="mt-0.5 size-4 shrink-0 text-tone-success-fg" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CtaLink>{t('portal.landing.cta')}</CtaLink>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-ink-muted">{t('portal.landing.pricingTbd')}</p>
        </section>

        <section className="bg-surface-sunken">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <SectionTitle>{t('portal.landing.faqTitle')}</SectionTitle>
            <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
              {faq.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {item.q}
                    <span className="text-xl text-ink-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-ink-secondary">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-accent">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center text-white">
            <h2 className="text-3xl font-bold tracking-tight">{t('portal.landing.closingTitle')}</h2>
            <p className="mt-3 text-white/85">{t('portal.landing.closingBody')}</p>
            <div className="mt-8">
              <CtaLink variant="onDark">{t('portal.landing.cta')}</CtaLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-ink-muted">
        <span>{t('portal.landing.footer')}</span>
        <a href={appUrl('/login')} className="hover:text-ink">{t('portal.landing.signIn')}</a>
      </footer>
    </div>
  );
}

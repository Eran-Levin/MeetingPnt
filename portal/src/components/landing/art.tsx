import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n/index.js';

/**
 * Landing-page graphics. Everything is drawn from the portal's own tokens (`fill-accent`,
 * `stroke-line-strong`…) so the artwork can't drift from the palette, and accent stays where it
 * means "where the group is now".
 */

const ICON_PATHS = {
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  check: 'M4.5 12.5l4.5 4.5L19.5 6.5',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h5.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H16',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  userPlus: 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 20c0-3.3 3.1-6 7-6s7 2.7 7 6M19 8v6M16 11h6',
  shield: 'M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z',
  signal: 'M12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM8.5 16.5a5 5 0 0 1 0-8M15.5 16.5a5 5 0 0 0 0-8M5.5 19.5a9 9 0 0 1 0-14M18.5 19.5a9 9 0 0 0 0-14',
  laptop: 'M5 6h14v9H5zM3 19h18',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2v.1',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className = 'size-6' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** A tinted rounded square with an icon in it — the one shape every card icon shares. */
export function IconTile({ name, tone = 'accent' }: { name: IconName; tone?: 'accent' | 'neutral' }) {
  const toneClass =
    tone === 'accent'
      ? 'bg-tone-accent-bg text-tone-accent-fg'
      : 'bg-tone-neutral-bg text-tone-neutral-fg';
  return (
    <span className={`inline-flex size-11 items-center justify-center rounded-xl ${toneClass}`}>
      <Icon name={name} />
    </span>
  );
}

/** The map half of the phone: streets, the planned route, who has arrived and who hasn't. */
function MapArt() {
  return (
    <svg viewBox="0 0 280 300" className="block h-auto w-full" aria-hidden="true">
      <rect width="280" height="300" className="fill-surface-raised" />
      {/* Streets and a park, enough to read as a map without pretending to be one. */}
      <g className="stroke-line-strong" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.55">
        <path d="M-10 70 L290 40" />
        <path d="M-10 190 L290 160" />
        <path d="M60 -10 L90 310" />
        <path d="M200 -10 L215 310" />
      </g>
      <g className="stroke-surface" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M-10 70 L290 40" />
        <path d="M-10 190 L290 160" />
        <path d="M60 -10 L90 310" />
        <path d="M200 -10 L215 310" />
      </g>
      <rect x="100" y="205" width="85" height="70" rx="14" className="fill-tone-success-bg" opacity="0.8" />

      {/* The plan: visited stops first, then the one the group is at, then what's left. */}
      <path
        d="M45 235 C 60 200, 80 175, 110 160 S 165 120, 175 92 S 215 60, 238 50"
        className="stroke-ink-muted"
        strokeWidth="3"
        strokeDasharray="2 7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M45 235 C 60 200, 80 175, 110 160 S 150 135, 168 112"
        className="stroke-accent"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="45" cy="235" r="7" className="fill-ink-muted" />
      <circle cx="110" cy="160" r="7" className="fill-ink-muted" />
      <circle cx="238" cy="50" r="8" className="fill-surface stroke-ink-muted" strokeWidth="3" />

      {/* Where the group is now. */}
      <circle cx="168" cy="112" r="26" className="fill-accent" opacity="0.14" />
      <circle cx="168" cy="112" r="15" className="fill-accent" opacity="0.25" />
      <circle cx="168" cy="112" r="9" className="fill-accent stroke-surface" strokeWidth="3" />

      {/* People: on their way (green) and one running late (amber). */}
      <circle cx="150" cy="132" r="5" className="fill-tone-success-fg stroke-surface" strokeWidth="2" />
      <circle cx="184" cy="132" r="5" className="fill-tone-success-fg stroke-surface" strokeWidth="2" />
      <circle cx="160" cy="96" r="5" className="fill-tone-success-fg stroke-surface" strokeWidth="2" />
      <circle cx="196" cy="100" r="5" className="fill-tone-success-fg stroke-surface" strokeWidth="2" />
      <circle cx="92" cy="206" r="6" className="fill-tone-warning-fg stroke-surface" strokeWidth="2" />
      <path
        d="M97 202 C 112 186, 126 172, 141 150"
        className="stroke-tone-warning-fg"
        strokeWidth="2"
        strokeDasharray="1 5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** A phone showing a live stop — the picture of what a leader gets on the day. */
export function PhoneMock() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-[17.5rem] rounded-[2.4rem] border border-line-strong bg-ink p-2 shadow-2xl shadow-ink/20">
      <div className="overflow-hidden rounded-[2rem] bg-surface">
        <div className="relative" dir="ltr">
          <MapArt />
          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-accent-text shadow">
            <span className="size-2 rounded-full bg-accent" />
            {t('portal.landing.mockNow')}
          </span>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-base font-semibold text-ink">{t('portal.landing.mockStop')}</p>
          <div>
            <div className="mb-1 flex justify-between text-xs text-ink-secondary">
              <span>{t('portal.landing.mockHere')}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full w-[92%] rounded-full bg-tone-success-fg" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-tone-warning-bg px-3 py-2 text-xs font-medium text-tone-warning-fg">
            <Icon name="alert" className="size-4 shrink-0" />
            {t('portal.landing.mockOnWay')}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-text">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{children}</h2>
    </div>
  );
}

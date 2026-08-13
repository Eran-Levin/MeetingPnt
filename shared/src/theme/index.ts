/**
 * The one place colour, spacing and type are decided.
 *
 * The two clients render these differently — the portal turns them into CSS variables that
 * Tailwind reads, mobile imports the object directly — but neither invents a value. The clients
 * had drifted before this existed: a live event was a blue-tinted card on mobile and a pale blue
 * pill on the web, and nothing said which was right.
 */

/** Raw ramps. Only the semantic maps below should be read by components. */
export const palette = {
  neutral: {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    600: '#16a34a',
    700: '#15803d',
    900: '#14532d',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    600: '#d97706',
    700: '#b45309',
    900: '#78350f',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    600: '#dc2626',
    700: '#b91c1c',
    900: '#7f1d1d',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    600: '#9333ea',
    700: '#7e22ce',
    900: '#581c87',
  },
} as const;

/**
 * A tone is a meaning, not a colour — "this went well", "this needs you", "this is where the
 * group is". Components pick a tone; the platform decides the pixels. Adding a status means
 * choosing its tone once, here, rather than picking a blue on each client and hoping they match.
 */
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/** Every status the two clients render, mapped to what it means. */
export const STATUS_TONE: Record<string, Tone> = {
  // activity + group lifecycle
  draft: 'neutral',
  planned: 'warning',
  published: 'success',
  in_progress: 'accent',
  completed: 'neutral',
  cancelled: 'danger',
  // rsvp
  pending: 'warning',
  approved: 'success',
  declined: 'danger',
  // attendance
  present: 'success',
  absent: 'danger',
  // roles
  admin: 'info',
  leader: 'accent',
  user: 'neutral',
};

export function toneFor(status: string): Tone {
  return STATUS_TONE[status] ?? 'neutral';
}

/** Background / foreground / border for a tone used as a quiet tint — badges, pills, banners. */
export const toneTint: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: palette.neutral[100], fg: palette.neutral[600], border: palette.neutral[200] },
  accent: { bg: palette.blue[50], fg: palette.blue[700], border: palette.blue[200] },
  success: { bg: palette.green[100], fg: palette.green[700], border: palette.green[600] },
  warning: { bg: palette.amber[100], fg: palette.amber[700], border: palette.amber[600] },
  danger: { bg: palette.red[100], fg: palette.red[700], border: palette.red[600] },
  info: { bg: palette.purple[100], fg: palette.purple[700], border: palette.purple[600] },
};

/** A tone used as a solid fill — primary buttons, the current stop's marker. */
export const toneSolid: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: palette.neutral[700], fg: palette.neutral[0] },
  accent: { bg: palette.blue[600], fg: palette.neutral[0] },
  success: { bg: palette.green[600], fg: palette.neutral[0] },
  warning: { bg: palette.amber[600], fg: palette.neutral[0] },
  danger: { bg: palette.red[600], fg: palette.neutral[0] },
  info: { bg: palette.purple[600], fg: palette.neutral[0] },
};

export const color = {
  text: palette.neutral[900],
  textSecondary: palette.neutral[500],
  textMuted: palette.neutral[400],
  textInverse: palette.neutral[0],
  surface: palette.neutral[0],
  surfaceSunken: palette.neutral[50],
  surfaceRaised: palette.neutral[100],
  border: palette.neutral[200],
  borderStrong: palette.neutral[300],
  accent: palette.blue[600],
  accentText: palette.blue[700],
  accentSurface: palette.blue[50],
} as const;

/** 4pt grid. Component-internal gaps and page rhythm both come from here. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 8, lg: 12, pill: 999 } as const;

/**
 * Bigger than a typical app's. A leader reads this in sunlight, one-handed, with a group waiting;
 * a member reads it walking. Nothing below 12, and body sits at 15.
 */
export const fontSize = {
  caption: 12,
  footnote: 13,
  body: 15,
  bodyLarge: 16,
  heading: 18,
  title: 22,
  display: 28,
} as const;

/** Two weights. More than two and the hierarchy stops meaning anything. */
export const fontWeight = { regular: '400', medium: '600' } as const;

/**
 * iOS and Android both want 44 — and this app's taps happen with gloves on, in glare, in a hurry.
 * Nothing interactive is allowed below it.
 */
export const minTouchTarget = 44;

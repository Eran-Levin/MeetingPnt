import {
  color,
  fontSize,
  fontWeight,
  minTouchTarget,
  radius,
  space,
  toneFor,
  toneSolid,
  toneTint,
} from '@meetingpnt/shared';
import { StyleSheet } from 'react-native';

export { color, fontSize, fontWeight, minTouchTarget, radius, space, toneFor, toneSolid, toneTint };
export type { Tone } from '@meetingpnt/shared';

/**
 * Type presets. Screens used to spell out `{ fontSize: 16, fontWeight: '600' }` inline, which is
 * how nine screens ended up with nine slightly different headings.
 */
export const text = StyleSheet.create({
  display: { fontSize: fontSize.display, fontWeight: fontWeight.medium, color: color.text },
  title: { fontSize: fontSize.title, fontWeight: fontWeight.medium, color: color.text },
  heading: { fontSize: fontSize.heading, fontWeight: fontWeight.medium, color: color.text },
  body: { fontSize: fontSize.body, color: color.text },
  bodyStrong: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: color.text },
  secondary: { fontSize: fontSize.footnote, color: color.textSecondary },
  muted: { fontSize: fontSize.footnote, color: color.textMuted },
  caption: { fontSize: fontSize.caption, color: color.textSecondary },
});

/** Section labels are uppercase and quiet — they organise, they don't compete. */
export const sectionLabel = {
  fontSize: fontSize.caption,
  fontWeight: fontWeight.medium,
  letterSpacing: 0.6,
  color: color.textMuted,
  textTransform: 'uppercase',
} as const;

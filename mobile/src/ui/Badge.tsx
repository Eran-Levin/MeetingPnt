import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../i18n';
import { fontSize, fontWeight, radius, space, toneFor, toneTint, type Tone } from './theme';

/**
 * A status, coloured by what it means rather than by what it says. The tone map lives in `shared`
 * so "declined" can't read as a warning here and a danger on the web.
 */
export function Badge({ status, label }: { status: string; label?: string }) {
  const { t, i18n } = useTranslation();
  const key = `status.${status}`;
  // A status the catalog does not know yet still renders, as its raw name.
  const known = i18n.exists(key) ? t(key as 'status.draft') : status.replace(/_/g, ' ');
  return <Pill tone={toneFor(status)} label={label ?? known} />;
}

export function Pill({ tone, label }: { tone: Tone; label: string }) {
  const { bg, fg } = toneTint[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    textTransform: 'capitalize',
  },
});

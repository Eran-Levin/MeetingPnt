import { StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, radius, space, toneFor, toneTint, type Tone } from './theme';

/**
 * A status, coloured by what it means rather than by what it says. The tone map lives in `shared`
 * so "declined" can't read as a warning here and a danger on the web.
 */
export function Badge({ status, label }: { status: string; label?: string }) {
  return <Pill tone={toneFor(status)} label={label ?? status.replace(/_/g, ' ')} />;
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

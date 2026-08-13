import type { RollCallEntry } from '@meetingpnt/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Empty,
  Section,
  color,
  fontSize,
  fontWeight,
  minTouchTarget,
  radius,
  space,
  text,
  toneSolid,
  toneTint,
} from '../../ui';

interface Props {
  entries: RollCallEntry[];
  /** True once the group has moved at least once, which changes who's expected here. */
  narrowed: boolean;
  onMark: (userId: string, status: 'present' | 'absent') => void;
  onLocate: (userId: string) => void;
  onRsvpFor: (userId: string, status: 'approved' | 'declined') => void;
}

/**
 * The leader's roll call. Marking someone is the single most repeated action in the app and it
 * happens outdoors, one-handed, with a group waiting — so present and absent are real buttons
 * that show their state, not text links you have to aim at.
 */
export function RollCallList({ entries, narrowed, onMark, onLocate, onRsvpFor }: Props) {
  const present = entries.filter((e) => e.attendance === 'present').length;
  const marked = entries.filter((e) => e.attendance !== null).length;

  return (
    <Section label="Who's here">
      <View style={styles.tally}>
        <Tally value={String(present)} label="present" />
        <Tally value={`${marked}/${entries.length}`} label="checked" />
      </View>

      {narrowed && (
        <Text style={[text.secondary, styles.hint]}>
          Showing whoever made the previous stop. People who declined aren&rsquo;t listed.
        </Text>
      )}

      {entries.map((entry) => (
        <View key={entry.user.id} style={styles.person}>
          <View style={styles.personHeader}>
            <View style={styles.personText}>
              <Text style={text.bodyStrong} numberOfLines={1}>
                {entry.user.name}
                {entry.isVisitor ? '  ·  visitor' : ''}
              </Text>
              <Text style={text.secondary}>
                {entry.rsvpStatus === 'approved' ? 'Coming' : 'No reply yet'}
              </Text>
            </View>

            <View style={styles.marks}>
              <Mark
                label="Here"
                tone="success"
                active={entry.attendance === 'present'}
                onPress={() => onMark(entry.user.id, 'present')}
              />
              <Mark
                label="Missing"
                tone="danger"
                active={entry.attendance === 'absent'}
                onPress={() => onMark(entry.user.id, 'absent')}
              />
            </View>
          </View>

          <View style={styles.secondary}>
            <Quiet label="Locate" onPress={() => onLocate(entry.user.id)} />
            {/* Answer for them if they replied by phone rather than in the app. */}
            {entry.rsvpStatus !== 'approved' && (
              <Quiet label="Confirm" onPress={() => onRsvpFor(entry.user.id, 'approved')} />
            )}
            <Quiet label="Won't arrive" onPress={() => onRsvpFor(entry.user.id, 'declined')} muted />
          </View>
        </View>
      ))}

      {entries.length === 0 && <Empty headline="Nobody expected at this meeting point" />}
    </Section>
  );
}

function Tally({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tallyBox}>
      <Text style={styles.tallyValue}>{value}</Text>
      <Text style={text.secondary}>{label}</Text>
    </View>
  );
}

function Mark({
  label,
  tone,
  active,
  onPress,
}: {
  label: string;
  tone: 'success' | 'danger';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mark,
        active && { backgroundColor: toneSolid[tone].bg, borderColor: toneSolid[tone].bg },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.markLabel, active && { color: toneSolid[tone].fg }]}>{label}</Text>
    </Pressable>
  );
}

function Quiet({
  label,
  onPress,
  muted = false,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}
    >
      <Text style={[styles.quietLabel, muted && { color: color.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tally: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  tallyBox: {
    flex: 1,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  tallyValue: { fontSize: 22, fontWeight: fontWeight.medium, color: color.text },
  hint: { marginBottom: space.md },
  person: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  personText: { flex: 1, minWidth: 0 },
  marks: { flexDirection: 'row', gap: space.sm },
  mark: {
    minHeight: minTouchTarget,
    minWidth: 76,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  markLabel: { fontSize: fontSize.footnote, fontWeight: fontWeight.medium, color: color.text },
  secondary: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  quiet: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: toneTint.neutral.bg,
  },
  quietLabel: { fontSize: fontSize.footnote, fontWeight: fontWeight.medium, color: color.accentText },
  pressed: { opacity: 0.7 },
});

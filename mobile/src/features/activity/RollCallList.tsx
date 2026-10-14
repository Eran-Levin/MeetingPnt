import { joinDot, type RollCallEntry } from '@meetingpnt/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
import {
  Avatar,
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
  onMessage: (userId: string) => void;
}

/**
 * The leader's roll call. Marking someone is the single most repeated action in the app and it
 * happens outdoors, one-handed, with a group waiting — so present and absent are real buttons
 * that show their state, not text links you have to aim at.
 */
export function RollCallList({ entries, narrowed, onMark, onLocate, onRsvpFor, onMessage }: Props) {
  const { t } = useTranslation();
  // One person's options open at a time: opening another closes the last.
  const [openId, setOpenId] = useState<string | null>(null);
  const present = entries.filter((e) => e.attendance === 'present').length;
  const marked = entries.filter((e) => e.attendance !== null).length;

  return (
    <Section label={t('rollCall.title')}>
      <View style={styles.tally}>
        <Tally value={String(present)} label={t('rollCall.present')} />
        <Tally value={`${marked}/${entries.length}`} label={t('rollCall.checked')} />
      </View>

      {narrowed && (
        <Text style={[text.secondary, styles.hint]}>
          {t('rollCall.narrowedHint')}
        </Text>
      )}

      {entries.map((entry) => {
        // Someone who's here has nothing left to do: no locating, no RSVP, no chasing.
        const expandable = entry.attendance !== 'present';
        const open = expandable && openId === entry.user.id;
        return (
          <View key={entry.user.id} style={styles.person}>
            <View style={styles.personHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                disabled={!expandable}
                onPress={() => setOpenId(open ? null : entry.user.id)}
                style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
              >
                {/* The face is the point of the photo: matching a name to someone you've met once. */}
                <Avatar name={entry.user.name} uri={entry.user.avatarUrl} size={40} />
                <View style={styles.personText}>
                  <Text style={text.bodyStrong} numberOfLines={1}>
                    {joinDot([entry.user.name, entry.isVisitor ? t('rollCall.visitor') : null])}
                  </Text>
                  {/* Missing now lives in the options, so the collapsed row still has to say it. */}
                  {entry.attendance === 'absent' ? (
                    <Text style={[text.secondary, { color: toneTint.danger.fg }]}>{t('rollCall.missing')}</Text>
                  ) : (
                    <Text style={text.secondary}>
                      {entry.rsvpStatus === 'approved' ? t('rollCall.coming') : t('rollCall.noReply')}
                    </Text>
                  )}
                </View>
              </Pressable>

              <Mark
                label={t('rollCall.here')}
                tone="success"
                active={entry.attendance === 'present'}
                onPress={() => onMark(entry.user.id, 'present')}
              />
            </View>

            {open && (
              <View style={styles.options}>
                {/* The person, now: attendance and reaching them. */}
                <View style={styles.optionRow}>
                  <Mark
                    fill
                    label={t('rollCall.missing')}
                    tone="danger"
                    active={entry.attendance === 'absent'}
                    onPress={() => onMark(entry.user.id, 'absent')}
                  />
                  <Quiet fill label={t('rollCall.locate')} onPress={() => onLocate(entry.user.id)} />
                  <Quiet fill label={t('event.message')} onPress={() => onMessage(entry.user.id)} />
                </View>
                {/* Their RSVP, which only shapes the first stop's roster; later stops expect whoever was present. */}
                {!narrowed && (
                  <View style={styles.optionRow}>
                    {/* Answer for them if they replied by phone rather than in the app. */}
                    {entry.rsvpStatus !== 'approved' && (
                      <Quiet fill label={t('rollCall.confirm')} onPress={() => onRsvpFor(entry.user.id, 'approved')} />
                    )}
                    <Quiet fill label={t('rollCall.wontArrive')} onPress={() => onRsvpFor(entry.user.id, 'declined')} muted />
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {entries.length === 0 && <Empty headline={t('rollCall.emptyHeadline')} />}
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
  fill = false,
}: {
  label: string;
  tone: 'success' | 'danger';
  active: boolean;
  onPress: () => void;
  fill?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mark,
        fill && styles.fill,
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
  fill = false,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
  fill?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quiet, fill && styles.fill, pressed && styles.pressed]}
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
  identity: {
    flex: 1,
    minWidth: 0,
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  personText: { flex: 1, minWidth: 0 },
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
  options: { gap: space.sm, marginTop: space.sm },
  optionRow: { flexDirection: 'row', gap: space.sm },
  fill: { flex: 1, alignItems: 'center' },
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

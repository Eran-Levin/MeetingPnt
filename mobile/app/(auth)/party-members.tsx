import type { PartyMemberDto } from '@meetingpnt/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { partiesApi } from '../../src/api/partiesApi';
import { ApiError } from '../../src/api/client';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { Button, TextField, color, radius, space, text } from '../../src/ui';

type DraftMember = { firstName: string; lastName: string; email: string; phone: string };

function emptyMember(): DraftMember {
  return { firstName: '', lastName: '', email: '', phone: '' };
}

/**
 * A mandatory, blocking step right after the rep's own registration: the leader only declared a
 * party size and name when inviting them, so the rep is the one who actually names the rest of
 * the party. Every member needs a name; email and phone are optional per member.
 */
export default function PartyMembersScreen() {
  const router = useRouter();
  const { partyId, partySize, partyName } = useLocalSearchParams<{
    partyId: string;
    partySize: string;
    partyName?: string;
  }>();
  const count = Math.max(0, Number(partySize ?? '1') - 1);
  const [members, setMembers] = useState<DraftMember[]>(
    Array.from({ length: count }, emptyMember),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateMember(index: number, patch: Partial<DraftMember>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  const canSubmit = members.every((m) => m.firstName.trim() && m.lastName.trim());

  async function handleSubmit() {
    if (!canSubmit) {
      setError('Every party member needs a first and last name.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const dto: PartyMemberDto[] = members.map((m) => ({
        firstName: m.firstName.trim(),
        lastName: m.lastName.trim(),
        ...(m.email.trim() ? { email: m.email.trim() } : {}),
        ...(m.phone.trim() ? { phone: m.phone.trim() } : {}),
      }));
      await partiesApi.addMembers(partyId, { members: dto });
      router.replace('/(tabs)/activities');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Name your party"
      subtitle={
        partyName
          ? `Who else is in ${partyName}? A name is all we need — email and phone are optional.`
          : 'Who else is joining with you? A name is all we need — email and phone are optional.'
      }
      error={error}
      footer={
        <Button
          label={submitting ? 'Saving…' : 'Continue'}
          onPress={handleSubmit}
          busy={submitting}
          disabled={!canSubmit}
        />
      }
    >
      {members.map((member, index) => (
        <View key={index} style={styles.member}>
          <Text style={[text.caption, styles.memberLabel]}>Party member {index + 2}</Text>
          <View style={styles.row}>
            <TextField
              label="First name"
              value={member.firstName}
              onChangeText={(v) => updateMember(index, { firstName: v })}
              containerStyle={styles.half}
            />
            <TextField
              label="Last name"
              value={member.lastName}
              onChangeText={(v) => updateMember(index, { lastName: v })}
              containerStyle={styles.half}
            />
          </View>
          <TextField
            label="Email (optional)"
            placeholder="them@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={member.email}
            onChangeText={(v) => updateMember(index, { email: v })}
          />
          <TextField
            label="Phone (optional)"
            keyboardType="phone-pad"
            value={member.phone}
            onChangeText={(v) => updateMember(index, { phone: v })}
          />
        </View>
      ))}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  member: {
    marginBottom: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  memberLabel: { marginBottom: space.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
});

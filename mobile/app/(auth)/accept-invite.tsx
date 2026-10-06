import { isolate } from '@meetingpnt/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { invitationsApi } from '../../src/api/invitationsApi';
import { apiErrorMessage, useTranslation } from '../../src/i18n';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { color, space, text } from '../../src/ui';

export default function AcceptInviteScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => invitationsApi.preview(token!),
    enabled: !!token,
  });

  if (!token) {
    return (
      <AuthLayout title={t('auth.invite.title')} error={t('auth.invite.missingToken')}>
        {null}
      </AuthLayout>
    );
  }

  if (isLoading) {
    return (
      <AuthLayout title={t('auth.invite.title')}>
        <View style={styles.centre}>
          <ActivityIndicator />
        </View>
      </AuthLayout>
    );
  }

  if (error || !data) {
    return (
      <AuthLayout
        title={t('auth.invite.title')}
        error={apiErrorMessage(error, t('auth.invite.invalid'))}
      >
        {null}
      </AuthLayout>
    );
  }

  const party = data.party;

  return (
    <AuthLayout
      title={t('auth.invite.youreInvited')}
      subtitle={
        party
          ? t('auth.invite.joinParty', {
              group: isolate(data.group.name),
              email: isolate(data.email),
              size: party.size,
            })
          : t('auth.invite.join', { group: isolate(data.group.name), email: isolate(data.email) })
      }
      /* Carries through whatever the leader filled in, so signing up is password-only. */
      footer={
        <Link
          href={{
            pathname: '/(auth)/register',
            params: {
              invitationToken: token,
              email: data.email,
              firstName: data.firstName ?? '',
              lastName: data.lastName ?? '',
              phone: data.phone ?? '',
              partyId: party?.id ?? '',
              partySize: String(party?.size ?? 1),
              partyName: party?.name ?? '',
            },
          }}
          style={[text.body, { color: color.accentText }]}
        >
          {t('auth.invite.createAccount')}
        </Link>
      }
    >
      {null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', paddingVertical: space.xl },
});

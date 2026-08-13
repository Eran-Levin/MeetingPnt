import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { invitationsApi } from '../../src/api/invitationsApi';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { color, space, text } from '../../src/ui';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => invitationsApi.preview(token!),
    enabled: !!token,
  });

  if (!token) {
    return (
      <AuthLayout title="Invitation" error="This invite link is missing a token.">
        {null}
      </AuthLayout>
    );
  }

  if (isLoading) {
    return (
      <AuthLayout title="Invitation">
        <View style={styles.centre}>
          <ActivityIndicator />
        </View>
      </AuthLayout>
    );
  }

  if (error || !data) {
    return (
      <AuthLayout
        title="Invitation"
        error={
          error instanceof ApiError
            ? error.message
            : 'This invitation link is invalid or has expired.'
        }
      >
        {null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="You’re invited"
      subtitle={`Join ${data.group.name} on MeetingPnt as ${data.email}.`}
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
            },
          }}
          style={[text.body, { color: color.accentText }]}
        >
          Create your account
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

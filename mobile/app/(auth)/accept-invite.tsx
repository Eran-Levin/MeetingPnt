import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { invitationsApi } from '../../src/api/invitationsApi';
import { ApiError } from '../../src/api/client';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => invitationsApi.preview(token!),
    enabled: !!token,
  });

  if (!token) {
    return (
      <View style={styles.container}>
        <Text>This invite link is missing a token.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>
          {error instanceof ApiError ? error.message : 'This invitation link is invalid or has expired.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You&rsquo;re invited!</Text>
      <Text>
        Join <Text style={{ fontWeight: '600' }}>{data.group.name}</Text> on MeetingPnt as{' '}
        {data.email}.
      </Text>
      {/* Carries through whatever the leader filled in, so signing up is password-only. */}
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
        style={styles.link}
      >
        Create your account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  error: { color: 'crimson', textAlign: 'center' },
  link: { color: '#2563eb', marginTop: 16, fontWeight: '600' },
});

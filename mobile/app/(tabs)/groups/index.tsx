import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authApi } from '../../../src/api/authApi';
import { groupsApi } from '../../../src/api/groupsApi';
import { secureStore } from '../../../src/services/secureStore';
import { endSession } from '../../../src/services/session';
import { useAuthStore } from '../../../src/store/authStore';
import {
  Badge,
  Button,
  Card,
  Empty,
  Row,
  Screen,
  Section,
  TextField,
  color,
  space,
  text,
} from '../../../src/ui';

export default function GroupsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [composing, setComposing] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  const isLeaderOrAdmin = user?.role === 'leader' || user?.role === 'admin';

  // "Closed" is a finished group — for a guide, the end of the trip. Planned and in-progress are
  // both still live concerns, so they sit together.
  const groups = data?.groups ?? [];
  const active = groups.filter((g) => g.status !== 'completed');
  const closed = groups.filter((g) => g.status === 'completed');

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await groupsApi.create({ name });
      setName('');
      setComposing(false);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    const refreshToken = await secureStore.getRefreshToken();
    await endSession();
    router.replace('/(auth)/login');
    if (refreshToken) authApi.logout(refreshToken).catch(() => undefined);
  }

  return (
    <Screen
      title="Groups"
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['groups'] })}
      refreshing={isFetching}
      bottomInset={80}
      headerRight={
        <Pressable onPress={handleLogout} style={styles.logout}>
          <Text style={[text.secondary, { color: color.accentText }]}>Log out</Text>
        </Pressable>
      }
    >
      {isLeaderOrAdmin &&
        (composing ? (
          <Card>
            <TextField
              label="Group name"
              placeholder="Tuesday Flow"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={styles.createActions}>
              <Button
                label={creating ? 'Creating…' : 'Create group'}
                onPress={handleCreate}
                busy={creating}
                grow
              />
              <Button
                label="Cancel"
                onPress={() => setComposing(false)}
                variant="secondary"
                grow
              />
            </View>
          </Card>
        ) : (
          <Button label="New group" onPress={() => setComposing(true)} variant="secondary" />
        ))}

      {active.length > 0 && (
        <Section label={`Active · ${active.length}`}>
          {active.map((group, index) => (
            <Row
              key={group.id}
              title={group.name}
              subtitle={
                group.nextActivityAt
                  ? `Next: ${new Date(group.nextActivityAt).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'Nothing scheduled'
              }
              trailing={<Badge status={group.status} />}
              onPress={() => router.push(`/(tabs)/groups/${group.id}`)}
              last={index === active.length - 1}
            />
          ))}
        </Section>
      )}

      {closed.length > 0 && (
        <Section label={`Closed · ${closed.length}`}>
          {closed.map((group, index) => (
            <Row
              key={group.id}
              title={group.name}
              subtitle={group.description ?? undefined}
              onPress={() => router.push(`/(tabs)/groups/${group.id}`)}
              done
              last={index === closed.length - 1}
            />
          ))}
        </Section>
      )}

      {!isLoading && groups.length === 0 && (
        <Empty
          headline={isLeaderOrAdmin ? 'Start your first group' : 'No groups yet'}
          body={
            isLeaderOrAdmin
              ? 'A group holds a roster and the activities that run inside it.'
              : "You'll see a group here once a leader adds you."
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logout: { paddingVertical: space.sm, paddingLeft: space.sm },
  createActions: { flexDirection: 'row', gap: space.sm },
});

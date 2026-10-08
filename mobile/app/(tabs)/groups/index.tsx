import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { groupsApi } from '../../../src/api/groupsApi';
import { useLocale, useTranslation } from '../../../src/i18n';
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
  const { t } = useTranslation();
  const locale = useLocale();
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

  return (
    <Screen
      title={t('tabs.groups')}
      back={false}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['groups'] })}
      refreshing={isFetching}
      bottomInset={80}
    >
      {isLeaderOrAdmin &&
        (composing ? (
          <Card>
            <TextField
              label={t('groups.groupName')}
              placeholder={t('groups.groupNamePlaceholder')}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={styles.createActions}>
              <Button
                label={creating ? t('groups.creating') : t('groups.createGroup')}
                onPress={handleCreate}
                busy={creating}
                grow
              />
              <Button
                label={t('common.cancel')}
                onPress={() => setComposing(false)}
                variant="secondary"
                grow
              />
            </View>
          </Card>
        ) : (
          <Button
            label={t('groups.newGroup')}
            onPress={() => setComposing(true)}
            variant="secondary"
          />
        ))}

      {active.length > 0 && (
        <Section label={t('groups.active', { count: active.length })}>
          {active.map((group, index) => (
            <Row
              key={group.id}
              title={group.name}
              subtitle={
                group.nextActivityAt
                  ? t('groups.nextAt', {
                      when: new Date(group.nextActivityAt).toLocaleString(locale, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      }),
                    })
                  : t('groups.nothingScheduled')
              }
              trailing={<Badge status={group.status} />}
              onPress={() => router.push(`/(tabs)/groups/${group.id}`)}
              last={index === active.length - 1}
            />
          ))}
        </Section>
      )}

      {closed.length > 0 && (
        <Section label={t('groups.closed', { count: closed.length })}>
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
          headline={isLeaderOrAdmin ? t('groups.startFirst') : t('groups.noGroupsYet')}
          body={
            isLeaderOrAdmin ? t('groups.startBody') : t('groups.memberBody')
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  createActions: { flexDirection: 'row', gap: space.sm },
});

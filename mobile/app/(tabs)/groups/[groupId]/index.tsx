import type { Activity } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activitiesApi } from '../../../../src/api/activitiesApi';
import { ApiError } from '../../../../src/api/client';
import { groupsApi } from '../../../../src/api/groupsApi';
import { invitationsApi } from '../../../../src/api/invitationsApi';
import { useAuthStore } from '../../../../src/store/authStore';
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
} from '../../../../src/ui';

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invitingOpen, setInvitingOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
  });
  const membersQuery = useQuery({
    queryKey: ['groups', groupId, 'members'],
    queryFn: () => groupsApi.listMembers(groupId),
  });
  const activitiesQuery = useQuery({
    queryKey: ['groups', groupId, 'activities'],
    queryFn: () => activitiesApi.list(groupId),
  });

  const isLeader = groupQuery.data?.group.leaderId === user?.id;
  const members = membersQuery.data?.members ?? [];
  const activities = activitiesQuery.data?.activities ?? [];

  const standaloneActivities = activities.filter((a) => !a.seriesId);
  const seriesGroups = new Map<string, Activity[]>();
  for (const activity of activities) {
    if (!activity.seriesId) continue;
    seriesGroups.set(activity.seriesId, [
      ...(seriesGroups.get(activity.seriesId) ?? []),
      activity,
    ]);
  }

  async function handlePublishSeries(seriesId: string) {
    await activitiesApi.publishSeries(seriesId);
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'activities'] });
  }

  async function handleInvite() {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return;
    setMessage(null);
    setInviting(true);
    try {
      const result = await invitationsApi.invite(groupId, {
        email,
        firstName,
        lastName,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      const who = `${firstName} ${lastName}`.trim();
      setMessage(result.type === 'added' ? `${who} added.` : `Invitation sent to ${who}.`);
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'members'] });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  function openActivity(activityId: string) {
    router.push(`/(tabs)/groups/${groupId}/activities/${activityId}`);
  }

  return (
    <Screen
      title={groupQuery.data?.group.name ?? '…'}
      subtitle={groupQuery.data?.group.description ?? undefined}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['groups', groupId] })}
      refreshing={groupQuery.isFetching}
      bottomInset={80}
      headerRight={
        <Pressable
          onPress={() => router.push(`/(tabs)/groups/${groupId}/chat`)}
          style={styles.headerLink}
        >
          <Text style={[text.body, { color: color.accentText }]}>Chat</Text>
        </Pressable>
      }
    >
      <Section label={`Roster · ${members.length}`} first>
        {members.map((member, index) => (
          <Row
            key={member.id}
            title={member.user.name}
            subtitle={[member.user.email, member.user.phone].filter(Boolean).join('  ·  ')}
            last={index === members.length - 1}
          />
        ))}
        {members.length === 0 && <Empty headline="No members yet" />}

        {isLeader &&
          (invitingOpen ? (
            <Card style={styles.invite}>
              <TextField label="First name" value={firstName} onChangeText={setFirstName} />
              <TextField label="Last name" value={lastName} onChangeText={setLastName} />
              <TextField
                label="Phone (optional)"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <TextField
                label="Email"
                placeholder="member@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.inviteActions}>
                <Button
                  label={inviting ? 'Sending…' : 'Invite'}
                  onPress={handleInvite}
                  busy={inviting}
                  grow
                />
                <Button
                  label="Close"
                  onPress={() => setInvitingOpen(false)}
                  variant="secondary"
                  grow
                />
              </View>
              {message && <Text style={text.secondary}>{message}</Text>}
            </Card>
          ) : (
            <Button
              label="Invite a member"
              onPress={() => setInvitingOpen(true)}
              variant="secondary"
              style={styles.invite}
            />
          ))}
      </Section>

      <Section label="Events">
        {isLeader && (
          <Button
            label="New event"
            onPress={() => router.push(`/(tabs)/groups/${groupId}/activities/new`)}
            variant="secondary"
            style={styles.newEvent}
          />
        )}

        {standaloneActivities.map((activity, index) => (
          <Row
            key={activity.id}
            title={activity.title}
            subtitle={formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}
            trailing={<Badge status={activity.status} />}
            onPress={() => openActivity(activity.id)}
            last={index === standaloneActivities.length - 1 && seriesGroups.size === 0}
          />
        ))}

        {[...seriesGroups.entries()].map(([seriesId, occurrences]) => {
          const draftCount = occurrences.filter((o) => o.status === 'draft').length;
          return (
            <Card key={seriesId} style={styles.series}>
              <View style={styles.seriesHeader}>
                <Text style={[text.bodyStrong, styles.seriesTitle]} numberOfLines={1}>
                  {occurrences[0]!.title}
                </Text>
                <Text style={text.secondary}>recurring · {occurrences.length}</Text>
              </View>
              {isLeader && draftCount > 0 && (
                <Button
                  label={`Publish all (${draftCount})`}
                  onPress={() => handlePublishSeries(seriesId)}
                  variant="secondary"
                  style={styles.publishAll}
                />
              )}
              {occurrences.map((activity, index) => (
                <Row
                  key={activity.id}
                  title={formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}
                  trailing={<Badge status={activity.status} />}
                  onPress={() => openActivity(activity.id)}
                  last={index === occurrences.length - 1}
                />
              ))}
            </Card>
          );
        })}

        {activities.length === 0 && (
          <Empty
            headline="Nothing scheduled yet"
            body={isLeader ? 'Add an event and the group will see it once published.' : undefined}
          />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLink: { paddingVertical: space.sm, paddingLeft: space.sm },
  invite: { marginTop: space.md },
  inviteActions: { flexDirection: 'row', gap: space.sm },
  newEvent: { marginBottom: space.md },
  series: { marginTop: space.md },
  seriesHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  seriesTitle: { flex: 1 },
  publishAll: { marginTop: space.sm },
});

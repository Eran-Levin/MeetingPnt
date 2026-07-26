import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { activitiesApi } from '../../../../src/api/activitiesApi.js';
import { groupsApi } from '../../../../src/api/groupsApi.js';
import { invitationsApi } from '../../../../src/api/invitationsApi.js';
import { ApiError } from '../../../../src/api/client.js';
import { useAuthStore } from '../../../../src/store/authStore.js';

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

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

  const standaloneActivities = activitiesQuery.data?.activities.filter((a) => !a.seriesId) ?? [];
  const seriesGroups = new Map<string, typeof standaloneActivities>();
  for (const activity of activitiesQuery.data?.activities ?? []) {
    if (!activity.seriesId) continue;
    seriesGroups.set(activity.seriesId, [...(seriesGroups.get(activity.seriesId) ?? []), activity]);
  }

  async function handlePublishSeries(seriesId: string) {
    await activitiesApi.publishSeries(seriesId);
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'activities'] });
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setMessage(null);
    setInviting(true);
    try {
      const result = await invitationsApi.invite(groupId, { email });
      setMessage(result.type === 'added' ? `${email} added.` : `Invitation sent to ${email}.`);
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'members'] });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.title}>{groupQuery.data?.group.name ?? '…'}</Text>
        <Link href={`/(tabs)/groups/${groupId}/chat`} style={styles.link}>
          Chat
        </Link>
      </View>
      {groupQuery.data?.group.description && (
        <Text style={styles.desc}>{groupQuery.data.group.description}</Text>
      )}

      {isLeader && (
        <View style={styles.inviteBox}>
          <Text style={styles.sectionTitle}>Invite a member</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.input}
              placeholder="member@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity style={styles.button} onPress={handleInvite} disabled={inviting}>
              <Text style={styles.buttonText}>{inviting ? '…' : 'Invite'}</Text>
            </TouchableOpacity>
          </View>
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      )}

      <Text style={styles.sectionTitle}>Roster</Text>
      {membersQuery.data?.members.map((item) => (
        <View key={item.id} style={styles.memberRow}>
          <Text>{item.user.name}</Text>
          <Text style={styles.muted}>{item.user.email}</Text>
        </View>
      ))}
      {membersQuery.data?.members.length === 0 && <Text style={styles.muted}>No members yet.</Text>}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Activities</Text>
        {isLeader && (
          <Link href={`/(tabs)/groups/${groupId}/activities/new`} style={styles.link}>
            + New
          </Link>
        )}
      </View>
      {standaloneActivities.map((activity) => (
        <Link key={activity.id} href={`/(tabs)/groups/${groupId}/activities/${activity.id}`} asChild>
          <TouchableOpacity style={styles.activityRow}>
            <Text>{activity.title}</Text>
            <Text style={styles.muted}>
              {new Date(activity.startAt).toLocaleString()} · {activity.status}
            </Text>
          </TouchableOpacity>
        </Link>
      ))}

      {[...seriesGroups.entries()].map(([seriesId, occurrences]) => {
        const draftCount = occurrences.filter((o) => o.status === 'draft').length;
        return (
          <View key={seriesId} style={styles.seriesBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={{ fontWeight: '600' }}>
                {occurrences[0]!.title} (recurring, {occurrences.length})
              </Text>
              {isLeader && draftCount > 0 && (
                <TouchableOpacity onPress={() => handlePublishSeries(seriesId)}>
                  <Text style={styles.link}>Publish all ({draftCount})</Text>
                </TouchableOpacity>
              )}
            </View>
            {occurrences.map((activity) => (
              <Link key={activity.id} href={`/(tabs)/groups/${groupId}/activities/${activity.id}`} asChild>
                <TouchableOpacity style={styles.activityRow}>
                  <Text style={styles.muted}>
                    {new Date(activity.startAt).toLocaleString()} · {activity.status}
                  </Text>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        );
      })}

      {activitiesQuery.data?.activities.length === 0 && (
        <Text style={styles.muted}>No activities scheduled yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '600' },
  desc: { color: '#555', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  link: { color: '#2563eb', fontWeight: '600' },
  inviteBox: { marginTop: 8 },
  inviteRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  message: { marginTop: 8, color: 'green' },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  activityRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  seriesBox: { marginTop: 8, padding: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  muted: { color: '#888' },
});

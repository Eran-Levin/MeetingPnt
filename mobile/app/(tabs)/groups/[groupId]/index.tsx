import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

  const isLeader = groupQuery.data?.group.leaderId === user?.id;

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
    <View style={styles.container}>
      <Text style={styles.title}>{groupQuery.data?.group.name ?? '…'}</Text>
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
      <FlatList
        data={membersQuery.data?.members ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Text>{item.user.name}</Text>
            <Text style={styles.muted}>{item.user.email}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>No members yet.</Text>}
      />

      <Text style={styles.sectionTitle}>Activities</Text>
      <Text style={styles.muted}>Coming in Phase 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '600' },
  desc: { color: '#555', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  inviteBox: { marginTop: 8 },
  inviteRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  message: { marginTop: 8, color: 'green' },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  muted: { color: '#888' },
});

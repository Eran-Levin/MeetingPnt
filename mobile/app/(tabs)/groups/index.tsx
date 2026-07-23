import type { GroupWithRole } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { groupsApi } from '../../../src/api/groupsApi.js';
import { authApi } from '../../../src/api/authApi.js';
import { secureStore } from '../../../src/services/secureStore.js';
import { endSession } from '../../../src/services/session.js';
import { useAuthStore } from '../../../src/store/authStore.js';

export default function GroupsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  const isLeaderOrAdmin = user?.role === 'leader' || user?.role === 'admin';

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await groupsApi.create({ name });
      setName('');
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

  function renderItem({ item }: { item: GroupWithRole }) {
    return (
      <Link href={`/(tabs)/groups/${item.id}`} asChild>
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
        </TouchableOpacity>
      </Link>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {isLeaderOrAdmin && (
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            placeholder="New group name"
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={creating}>
            <Text style={styles.createButtonText}>{creating ? '…' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && <Text style={styles.muted}>Loading…</Text>}
      <FlatList
        data={data?.groups ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={!isLoading ? <Text style={styles.muted}>No groups yet.</Text> : null}
        contentContainerStyle={{ gap: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  logout: { color: '#2563eb' },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  createButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  createButtonText: { color: 'white', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDesc: { color: '#666', marginTop: 2 },
  muted: { color: '#888', textAlign: 'center', marginTop: 24 },
});

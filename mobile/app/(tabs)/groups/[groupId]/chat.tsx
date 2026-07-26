import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { chatApi } from '../../../../src/api/chatApi.js';
import { groupsApi } from '../../../../src/api/groupsApi.js';
import { useAuthStore } from '../../../../src/store/authStore.js';

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
  });
  const isLeader = groupQuery.data?.group.leaderId === user?.id;
  const chatMode = groupQuery.data?.group.chatMode;
  const canPost = isLeader || chatMode === 'two_way';

  const messagesQuery = useQuery({
    queryKey: ['groups', groupId, 'messages'],
    queryFn: () => chatApi.list(groupId),
  });

  // Mobile has no persistent socket connection — a push notification tells the user there's
  // something new, and refetching on focus/pull-to-refresh picks it up.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] });
    }, [groupId, queryClient]),
  );

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function handleSend() {
    if (!body.trim() && !imageUri) return;
    setError(null);
    setSending(true);
    try {
      await chatApi.send(
        groupId,
        body.trim() || undefined,
        imageUri ? { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } : undefined,
      );
      setBody('');
      setImageUri(null);
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] });
    } catch {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={messagesQuery.isFetching}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] })
            }
          />
        }
      >
        <Text style={styles.hint}>
          {chatMode === 'announcements'
            ? 'Announcements only — members can read but not reply.'
            : 'Two-way chat — anyone in the group can post.'}
        </Text>
        {messagesQuery.data?.messages.map((message) => (
          <View
            key={message.id}
            style={[styles.messageRow, message.authorId === user?.id && styles.messageRowMine]}
          >
            <Text style={styles.author}>{message.author.name}</Text>
            {message.body && <Text style={styles.body}>{message.body}</Text>}
            {message.imageUrl && (
              <Image source={{ uri: message.imageUrl }} style={styles.image} resizeMode="cover" />
            )}
          </View>
        ))}
        {messagesQuery.data?.messages.length === 0 && (
          <Text style={styles.muted}>No messages yet.</Text>
        )}
      </ScrollView>

      {canPost ? (
        <View style={styles.composer}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder="Write a message…"
              value={body}
              onChangeText={setBody}
            />
            <TouchableOpacity onPress={handlePickImage} style={styles.imageButton}>
              <Text>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
              <Text style={styles.sendButtonText}>{sending ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      ) : (
        <Text style={styles.readOnlyNotice}>Only the leader can post in this group.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: { color: '#888', marginBottom: 12 },
  muted: { color: '#888', textAlign: 'center', marginTop: 24 },
  messageRow: { marginBottom: 12, alignSelf: 'flex-start', maxWidth: '85%' },
  messageRowMine: { alignSelf: 'flex-end' },
  author: { fontSize: 12, color: '#888' },
  body: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 10, marginTop: 2 },
  image: { width: 200, height: 200, borderRadius: 8, marginTop: 4 },
  composer: { borderTopWidth: 1, borderTopColor: '#eee', padding: 12 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  imageButton: { padding: 8 },
  sendButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  sendButtonText: { color: 'white', fontWeight: '600' },
  previewImage: { width: 60, height: 60, borderRadius: 8, marginBottom: 8 },
  error: { color: 'crimson', marginTop: 4 },
  readOnlyNotice: { textAlign: 'center', color: '#888', padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
});

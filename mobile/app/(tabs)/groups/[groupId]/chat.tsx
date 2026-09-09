import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatApi } from '../../../../src/api/chatApi';
import { groupsApi } from '../../../../src/api/groupsApi';
import { useAuthStore } from '../../../../src/store/authStore';
import {
  Avatar,
  Button,
  Empty,
  ScreenHeader,
  color,
  fontSize,
  minTouchTarget,
  radius,
  space,
  text,
  toneTint,
  useTopInset,
} from '../../../../src/ui';

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
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

  const messages = messagesQuery.data?.messages ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.headerPad, { paddingTop: topInset + space.lg }]}>
        <ScreenHeader title="Group chat" subtitle={groupQuery.data?.group.name} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={messagesQuery.isFetching}
            onRefresh={() =>
              queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] })
            }
          />
        }
      >
        <Text style={[text.secondary, styles.mode]}>
          {chatMode === 'announcements'
            ? 'Announcements only — members can read but not reply.'
            : 'Two-way chat — anyone in the group can post.'}
        </Text>

        {messages.map((message) => {
          const mine = message.authorId === user?.id;
          return (
            <View key={message.id} style={[styles.message, mine && styles.messageMine]}>
              {!mine && (
                <View style={styles.author}>
                  <Avatar name={message.author.name} uri={message.author.avatarUrl} size={24} />
                  <Text style={text.caption}>{message.author.name}</Text>
                </View>
              )}
              {message.body && (
                <View style={[styles.bubble, mine && styles.bubbleMine]}>
                  <Text style={mine ? styles.bodyMine : text.body}>{message.body}</Text>
                </View>
              )}
              {message.imageUrl && (
                <Image source={{ uri: message.imageUrl }} style={styles.image} resizeMode="cover" />
              )}
            </View>
          );
        })}

        {messages.length === 0 && (
          <Empty
            headline="No messages yet"
            body={canPost ? 'Say where you are, or what to bring.' : undefined}
          />
        )}
      </ScrollView>

      {canPost ? (
        <View style={[styles.composer, { paddingBottom: space.md + insets.bottom }]}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder="Write a message…"
              placeholderTextColor={color.textMuted}
              value={body}
              onChangeText={setBody}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach a photo"
              onPress={handlePickImage}
              style={styles.attach}
            >
              <Text style={styles.attachIcon}>+</Text>
            </Pressable>
            <Button label={sending ? '…' : 'Send'} onPress={handleSend} busy={sending} />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      ) : (
        <Text style={[text.secondary, styles.readOnly, { paddingBottom: space.md + insets.bottom }]}>
          Only the leader can post in this group.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.surfaceSunken },
  headerPad: { paddingHorizontal: space.lg },
  scroll: { flex: 1 },
  author: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mode: { marginBottom: space.lg },
  message: { marginBottom: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  messageMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.xs,
  },
  bubbleMine: { backgroundColor: color.accent, borderColor: color.accent },
  bodyMine: { fontSize: fontSize.body, color: color.textInverse },
  image: { width: 220, height: 220, borderRadius: radius.lg, marginTop: space.xs },
  composer: {
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
    padding: space.md,
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: fontSize.body,
    color: color.text,
  },
  attach: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceRaised,
  },
  attachIcon: { fontSize: 24, color: color.textSecondary },
  preview: { width: 64, height: 64, borderRadius: radius.md, marginBottom: space.sm },
  error: { color: toneTint.danger.fg, marginTop: space.xs },
  readOnly: { textAlign: 'center', padding: space.md, borderTopWidth: 1, borderTopColor: color.border },
});

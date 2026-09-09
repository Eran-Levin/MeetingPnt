import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { ApiError } from '../../src/api/client';
import { directMessagesApi } from '../../src/api/directMessagesApi';
import { useAuthStore } from '../../src/store/authStore';
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
} from '../../src/ui';

/**
 * One person, one thread. Reached by tapping someone in the attendee list or the roster — there's
 * no inbox, because you go looking for a conversation through the person you want, not through a
 * list of every conversation you've ever had.
 */
export default function DirectChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['direct-messages', userId];
  const threadQuery = useQuery({
    queryKey,
    queryFn: () => directMessagesApi.thread(userId),
  });

  // Same as group chat: no persistent socket on mobile, so a push says there's something new and
  // focus/pull-to-refresh fetches it.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['direct-messages', userId] });
    }, [queryClient, userId]),
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
      await directMessagesApi.send(
        userId,
        body.trim() || undefined,
        imageUri ? { uri: imageUri, name: 'photo.jpg', type: 'image/jpeg' } : undefined,
      );
      setBody('');
      setImageUri(null);
      queryClient.invalidateQueries({ queryKey: ['direct-messages', userId] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  const thread = threadQuery.data?.thread;
  const messages = thread?.messages ?? [];
  const blocked = threadQuery.error instanceof ApiError && threadQuery.error.status === 403;

  return (
    <View style={styles.container}>
      <View style={[styles.headerPad, { paddingTop: insets.top + space.lg }]}>
        <ScreenHeader
          title={thread?.withUser.name ?? '…'}
          subtitle="Direct message"
          right={
            thread ? (
              <Avatar name={thread.withUser.name} uri={thread.withUser.avatarUrl} size={36} />
            ) : undefined
          }
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={threadQuery.isFetching}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['direct-messages', userId] })}
          />
        }
      >
        {messages.map((message) => {
          const mine = message.senderId === me?.id;
          return (
            <View key={message.id} style={[styles.message, mine && styles.messageMine]}>
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

        {blocked && (
          <Empty
            headline="You can't message this person"
            body="Direct messages only reach people you share a group or an activity with."
          />
        )}

        {!blocked && messages.length === 0 && !threadQuery.isLoading && (
          <Empty
            headline={`Nothing yet with ${thread?.withUser.name ?? 'them'}`}
            body="Sort a lift, swap a phone number, say you're running late — just the two of you."
          />
        )}
      </ScrollView>

      {!blocked && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.surfaceSunken },
  headerPad: { paddingHorizontal: space.lg },
  scroll: { flex: 1 },
  message: { marginBottom: space.md, alignSelf: 'flex-start', maxWidth: '85%' },
  messageMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.md,
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
});

import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '../src/api/authApi';
import { ApiError } from '../src/api/client';
import { usersApi } from '../src/api/usersApi';
import { secureStore } from '../src/services/secureStore';
import { endSession } from '../src/services/session';
import { useAuthStore } from '../src/store/authStore';
import {
  Avatar,
  Button,
  ButtonRow,
  Card,
  Screen,
  Section,
  radius,
  space,
  text,
  toneTint,
} from '../src/ui';

/**
 * Says what actually went wrong. A photo upload can fail three ways that need different responses
 * — the phone couldn't reach the server, the server refused the file, or the session had lapsed —
 * and one flat "couldn't save that" sends you looking in the wrong place.
 */
function describeFailure(err: unknown): string {
  if (err instanceof ApiError) return `${err.message} (HTTP ${err.status})`;
  if (err instanceof Error) return `Couldn't reach the server: ${err.message}`;
  return 'Could not save that photo.';
}

/**
 * Everything about *you*, in one place reachable from the header of every screen. It used to be
 * the calendar's top-right corner only, which meant a leader two screens into a group had no way
 * to see who they were signed in as, let alone sign out.
 */
export default function AccountScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [busy, setBusy] = useState<'camera' | 'library' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Screen title="Account" account={false}>{null}</Screen>;

  async function upload(asset: ImagePicker.ImagePickerAsset) {
    const { user: updated } = await usersApi.setAvatar({
      uri: asset.uri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    });
    setUser(updated);
  }

  /** The point of a photo on a phone: take one now. Squared off in the picker, because every
   * place it lands afterwards is a circle. */
  async function handleTakePhoto() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('MeetingPnt needs camera access to take your photo. Enable it in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy('camera');
    try {
      await upload(result.assets[0]);
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleChoosePhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy('library');
    try {
      await upload(result.assets[0]);
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemovePhoto() {
    setError(null);
    setBusy('remove');
    try {
      const { user: updated } = await usersApi.removeAvatar();
      setUser(updated);
    } catch (err) {
      setError(describeFailure(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleLogout() {
    const refreshToken = await secureStore.getRefreshToken();
    await endSession();
    router.replace('/(auth)/login');
    if (refreshToken) authApi.logout(refreshToken).catch(() => undefined);
  }

  return (
    <Screen title="Account" account={false}>
      <Card>
        <View style={styles.identity}>
          <Avatar name={user.name} uri={user.avatarUrl} size={72} />
          <View style={styles.identityText}>
            <Text style={text.heading}>{user.name}</Text>
            <Text style={text.secondary}>{user.email}</Text>
            {user.phone && <Text style={text.secondary}>{user.phone}</Text>}
          </View>
        </View>
      </Card>

      <Section label="Your photo">
        <Card>
          <Text style={[text.secondary, styles.blurb]}>
            A face makes a roster readable at a glance — useful when a leader is matching names to
            people they've met once, in a car park, in the rain.
          </Text>
          <ButtonRow>
            <Button
              label={busy === 'camera' ? 'Saving…' : 'Take photo'}
              onPress={handleTakePhoto}
              busy={busy === 'camera'}
              grow
            />
            <Button
              label={busy === 'library' ? 'Saving…' : 'Choose photo'}
              variant="secondary"
              onPress={handleChoosePhoto}
              busy={busy === 'library'}
              grow
            />
          </ButtonRow>
          {user.avatarUrl && (
            <Button
              label={busy === 'remove' ? 'Removing…' : 'Remove photo'}
              variant="secondary"
              onPress={handleRemovePhoto}
              busy={busy === 'remove'}
              style={styles.remove}
            />
          )}
          {/* Loud on purpose: this used to be grey footnote text under two buttons, which is
              indistinguishable from nothing having happened at all. */}
          {error && (
            <View style={styles.error}>
              <Text style={[text.body, { color: toneTint.danger.fg }]}>{error}</Text>
            </View>
          )}
        </Card>
      </Section>

      <Section label="Session">
        <Button label="Log out" variant="secondary" onPress={handleLogout} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  identityText: { flex: 1, gap: space.xs },
  blurb: { marginBottom: space.md },
  remove: { marginTop: space.sm },
  error: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: toneTint.danger.bg,
  },
});

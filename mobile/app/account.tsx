import { LOCALES, type Locale } from '@meetingpnt/shared';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '../src/api/authApi';
import { apiErrorMessage, useTranslation } from '../src/i18n';
import { usersApi } from '../src/api/usersApi';
import { secureStore } from '../src/services/secureStore';
import { endSession } from '../src/services/session';
import { useAuthStore } from '../src/store/authStore';
import { Avatar, Button, ButtonRow, Card, Chip, ChipRow, Screen, Section, space, text } from '../src/ui';

/**
 * Everything about *you*, in one place reachable from the header of every screen. It used to be
 * the calendar's top-right corner only, which meant a leader two screens into a group had no way
 * to see who they were signed in as, let alone sign out.
 */
export default function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [busy, setBusy] = useState<'camera' | 'library' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Screen title={t('account.title')} account={false}>{null}</Screen>;

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
      setError(t('account.needCamera'));
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
      setError(apiErrorMessage(err, t('account.saveFailed')));
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
      setError(apiErrorMessage(err, t('account.saveFailed')));
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
      setError(apiErrorMessage(err, t('account.removeFailed')));
    } finally {
      setBusy(null);
    }
  }

  /** Saved on the account, so the portal and every device agree. Each language is named in itself. */
  async function handleLocale(locale: Locale) {
    if (locale === user!.locale) return;
    setError(null);
    try {
      const { user: updated } = await usersApi.setLocale(locale);
      setUser(updated);
    } catch (err) {
      setError(apiErrorMessage(err, t('account.languageFailed')));
    }
  }

  async function handleLogout() {
    const refreshToken = await secureStore.getRefreshToken();
    await endSession();
    router.replace('/(auth)/login');
    if (refreshToken) authApi.logout(refreshToken).catch(() => undefined);
  }

  return (
    <Screen title={t('account.title')} account={false}>
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

      <Section label={t('account.photoSection')}>
        <Card>
          <Text style={[text.secondary, styles.blurb]}>
            {t('account.photoBlurb')}
          </Text>
          <ButtonRow>
            <Button
              label={busy === 'camera' ? t('account.saving') : t('account.takePhoto')}
              onPress={handleTakePhoto}
              busy={busy === 'camera'}
              grow
            />
            <Button
              label={busy === 'library' ? t('account.saving') : t('account.choosePhoto')}
              variant="secondary"
              onPress={handleChoosePhoto}
              busy={busy === 'library'}
              grow
            />
          </ButtonRow>
          {user.avatarUrl && (
            <Button
              label={busy === 'remove' ? t('account.removing') : t('account.removePhoto')}
              variant="secondary"
              onPress={handleRemovePhoto}
              busy={busy === 'remove'}
              style={styles.remove}
            />
          )}
          {error && <Text style={[text.secondary, styles.error]}>{error}</Text>}
        </Card>
      </Section>

      <Section label={t('account.language')}>
        <ChipRow>
          {LOCALES.map((l) => (
            <Chip
              key={l}
              label={LANGUAGE_NAMES[l]}
              selected={user.locale === l}
              onPress={() => handleLocale(l)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section label={t('account.session')}>
        <Button label={t('account.logOut')} variant="secondary" onPress={handleLogout} />
      </Section>
    </Screen>
  );
}

const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', he: 'עברית' };

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  identityText: { flex: 1, gap: space.xs },
  blurb: { marginBottom: space.md },
  remove: { marginTop: space.sm },
  error: { marginTop: space.sm },
});

import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { authApi } from '../../src/api/authApi';
import { apiErrorMessage, useTranslation } from '../../src/i18n';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { establishSession } from '../../src/services/session';
import { Button, TextField, color, space, text } from '../../src/ui';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await authApi.login({ email, password });
      await establishSession(data);
      router.replace('/(tabs)/activities');
    } catch (err) {
      setError(apiErrorMessage(err, t('common.somethingWentWrong')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="MeetingPnt"
      subtitle={t('auth.login.subtitle')}
      error={error}
      footer={
        <Link href="/(auth)/register" style={[text.body, { color: color.accentText }]}>
          {t('auth.login.noAccount')}
        </Link>
      }
    >
      <TextField
        label={t('common.email')}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label={t('common.password')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
      />
      <Button
        label={submitting ? t('auth.login.signingIn') : t('auth.login.signIn')}
        onPress={handleSubmit}
        busy={submitting}
        style={styles.submit}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: space.sm },
});

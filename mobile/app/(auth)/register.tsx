import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { authApi } from '../../src/api/authApi';
import { apiErrorMessage, useTranslation } from '../../src/i18n';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { establishSession } from '../../src/services/session';
import { Button, TextField, color, space, text } from '../../src/ui';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    invitationToken,
    email: prefilledEmail,
    firstName: prefilledFirstName,
    lastName: prefilledLastName,
    phone: prefilledPhone,
    partyId,
    partySize,
    partyName,
  } = useLocalSearchParams<{
    invitationToken?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    partyId?: string;
    partySize?: string;
    partyName?: string;
  }>();
  // Pre-filled from the invitation when there is one — the invitee confirms rather than retypes.
  const [firstName, setFirstName] = useState(prefilledFirstName ?? '');
  const [lastName, setLastName] = useState(prefilledLastName ?? '');
  const [phone, setPhone] = useState(prefilledPhone ?? '');
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await authApi.register({
        firstName,
        lastName,
        email,
        password,
        invitationToken,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      await establishSession(data);
      const size = Number(partySize ?? '1');
      if (partyId && size > 1) {
        router.replace({
          pathname: '/(auth)/party-members',
          params: { partyId, partySize: String(size), partyName: partyName ?? '' },
        });
      } else {
        router.replace('/(tabs)/activities');
      }
    } catch (err) {
      setError(apiErrorMessage(err, t('common.somethingWentWrong')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={invitationToken ? t('auth.register.subtitle') : undefined}
      error={error}
      footer={
        <Link href="/(auth)/login" style={[text.body, { color: color.accentText }]}>
          {t('auth.register.haveAccount')}
        </Link>
      }
    >
      <TextField label={t('common.firstName')} value={firstName} onChangeText={setFirstName} />
      <TextField label={t('common.lastName')} value={lastName} onChangeText={setLastName} />
      <TextField
        label={t('common.phoneOptional')}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
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
        placeholder={t('auth.register.passwordPlaceholder')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
      />
      <Button
        label={submitting ? t('auth.register.submitting') : t('auth.register.submit')}
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

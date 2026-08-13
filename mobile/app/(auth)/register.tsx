import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { authApi } from '../../src/api/authApi';
import { ApiError } from '../../src/api/client';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { establishSession } from '../../src/services/session';
import { Button, TextField, color, space, text } from '../../src/ui';

export default function RegisterScreen() {
  const router = useRouter();
  const {
    invitationToken,
    email: prefilledEmail,
    firstName: prefilledFirstName,
    lastName: prefilledLastName,
    phone: prefilledPhone,
  } = useLocalSearchParams<{
    invitationToken?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
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
      router.replace('/(tabs)/activities');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle={invitationToken ? 'Confirm your details and pick a password.' : undefined}
      error={error}
      footer={
        <Link href="/(auth)/login" style={[text.body, { color: color.accentText }]}>
          Already have an account? Sign in
        </Link>
      }
    >
      <TextField label="First name" value={firstName} onChangeText={setFirstName} />
      <TextField label="Last name" value={lastName} onChangeText={setLastName} />
      <TextField
        label="Phone (optional)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
      />
      <Button
        label={submitting ? 'Creating account…' : 'Register'}
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

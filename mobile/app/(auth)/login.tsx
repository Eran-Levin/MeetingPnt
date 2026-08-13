import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { authApi } from '../../src/api/authApi';
import { ApiError } from '../../src/api/client';
import { AuthLayout } from '../../src/features/auth/AuthLayout';
import { establishSession } from '../../src/services/session';
import { Button, TextField, color, space, text } from '../../src/ui';

export default function LoginScreen() {
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
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="MeetingPnt"
      subtitle="Sign in to see what's happening today."
      error={error}
      footer={
        <Link href="/(auth)/register" style={[text.body, { color: color.accentText }]}>
          Don&rsquo;t have an account? Register
        </Link>
      }
    >
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
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
      />
      <Button
        label={submitting ? 'Signing in…' : 'Sign in'}
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

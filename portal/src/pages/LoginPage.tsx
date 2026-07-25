import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { authApi } from '../api/authApi.js';
import { AppLogo } from '../components/AppLogo.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { TextField } from '../components/ui/TextField.js';
import { useAuthStore } from '../store/authStore.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await authApi.login({ email, password });
      setSession(data.user, data.accessToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <AppLogo size={48} className="mb-1" />
        <h1 className="text-2xl font-semibold text-slate-900">MeetingPnt</h1>
        <p className="mt-1 text-sm text-slate-500">Leader &amp; Admin console</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

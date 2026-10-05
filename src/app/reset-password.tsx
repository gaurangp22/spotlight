import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { api } from '../lib/api';
import { Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { Button, Card, EmptyState, TextField } from '../ui/primitives';

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState(''), [done, setDone] = useState(false);
  const { busy, run } = useTask();
  if (done) return <Screen title="Password reset"><Card style={{ marginTop: 24 }}><EmptyState icon="checkmark-circle" title="You’re all set" text="Your password was changed and other devices were signed out." action={<Button label="Sign in" inline onPress={() => router.replace({ pathname: '/auth', params: { mode: 'login' } })} />} /></Card></Screen>;
  return <Screen title="Choose a new password" large subtitle={token ? 'Use at least 10 characters. You’ll be signed out everywhere else.' : 'This reset link is incomplete. Request a new one from the sign-in screen.'}
    footer={<Button label="Reset password" loading={busy} disabled={!token || password.length < 10} onPress={() => void run(async () => { await api('/auth/reset', { method: 'POST', body: { token, password } }); setDone(true); })} />}>
    <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry maxLength={128} autoComplete="new-password" placeholder="At least 10 characters" autoFocus />
  </Screen>;
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { Action, Header, Page } from '../ui/components';
import { F, Field, useTask } from '../ui/forms';

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState(''), [done, setDone] = useState(false);
  const { busy, run } = useTask();
  return <Page><Header title="Reset password" back /><View style={{ paddingTop: 28 }}><Text style={F.title}>{done ? 'You’re ready to sign in.' : 'Choose a new password.'}</Text>{done ? <Action label="Sign in" onPress={() => router.replace('/auth')} /> : <><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry maxLength={128} /><Action label={busy ? 'Saving…' : 'Reset password'} disabled={busy || !token || password.length < 10} onPress={() => void run(async () => { await api('/auth/reset', { method: 'POST', body: { token, password } }); setDone(true); })} /></>}</View></Page>;
}

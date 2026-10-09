import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { api } from '../lib/api';
import { registerPush } from '../lib/push';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { useRemote } from '../ui/remote';
import { Button, Card, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

function Preferences() {
  const { user, config, refresh } = useApp(); const prefs = useRemote<{ push: boolean; messages: boolean; bots: boolean; emailVerified: boolean }>('/me/preferences', !!user); const { busy, run } = useTask();
  const [challenge, setChallenge] = useState(''), [code, setCode] = useState('');
  if (!user) return <Screen back title="Account preferences"><Button label="Sign in" onPress={() => router.push('/auth')} /></Screen>;
  return <Screen back title="Account preferences" large onRefresh={prefs.reload} refreshing={prefs.loading}>
    {!!prefs.error && <Card><T>{prefs.error}</T><Button label="Try again" onPress={prefs.reload} /></Card>}
    {prefs.data && <>
      <Card style={{ gap: space.md, marginBottom: space.lg }}><T v="headline">Messages</T><T v="subhead" tone="secondary">Choose whether people can start direct messages or invite you to new groups. Existing groups stay accessible; leave them from the conversation.</T><Button label={prefs.data.messages ? 'Turn off new messages' : 'Allow new messages'} variant="secondary" loading={busy} onPress={() => void run(async () => { await api('/me/preferences', { method: 'PATCH', body: { messages: !prefs.data!.messages } }); prefs.reload(); })} /></Card>
      <Card style={{ gap: space.md, marginBottom: space.lg }}><T v="headline">Riffs bots</T><T v="subhead" tone="secondary">House bots post daily picks and polls, and sometimes like or reply to your public posts. They’re always labelled “Bot”. Turn them off to hide their posts and stop them interacting with you.</T><Button label={prefs.data.bots ? 'Hide bots' : 'Show bots'} variant="secondary" loading={busy} onPress={() => void run(async () => { await api('/me/preferences', { method: 'PATCH', body: { bots: !prefs.data!.bots } }); prefs.reload(); })} /></Card>
      <Card style={{ gap: space.md, marginBottom: space.lg }}><T v="headline">Phone alerts</T><T v="subhead" tone="secondary">{Platform.OS === 'web' ? 'Push alerts work in the installed phone app. Activity and messages still work here.' : config?.push ? 'Receive alerts for messages and social activity. Alert text stays generic for privacy.' : 'Push delivery hasn’t been enabled on the server yet.'}</T><Button label={prefs.data.push ? 'Turn off push alerts' : 'Enable push alerts'} variant="secondary" disabled={!prefs.data.push && (Platform.OS === 'web' || !config?.push)} loading={busy} onPress={() => void run(async () => { if (prefs.data!.push) await api('/me/preferences', { method: 'PATCH', body: { push: false } }); else await registerPush(); prefs.reload(); })} /></Card>
      <Card style={{ gap: space.md }}><T v="headline">Email ownership</T><T v="subhead" tone="secondary">{prefs.data.emailVerified ? 'Your email is verified.' : config?.emailOtp ? 'Verify your account email with a one-time code.' : 'Email verification will be available once email delivery is configured.'}</T>
        {!prefs.data.emailVerified && config?.emailOtp && <><Button label="Send verification code" variant="secondary" loading={busy} onPress={() => void run(async () => { const r = await api<{ challenge: string }>('/me/verify-email/request', { method: 'POST' }); setChallenge(r.challenge); setCode(''); })} />{challenge && <View><TextField label="Verification code" value={code} onChangeText={setCode} maxLength={6} keyboardType="number-pad" /><Button label="Verify email" disabled={!/^\d{6}$/.test(code)} loading={busy} onPress={() => void run(async () => { await api('/me/verify-email', { method: 'POST', body: { challenge, code } }); setChallenge(''); prefs.reload(); await refresh(); })} /></View>}</>}
      </Card>
    </>}
  </Screen>;
}

export default function AccountPreferences() { const { user } = useApp(); return <Preferences key={user?.id || 'guest'} />; }

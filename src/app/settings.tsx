import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { Avatar, Button, Card, Dialog, ListGroup, ListRow, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

WebBrowser.maybeCompleteAuthSession();
const version = Constants.expoConfig?.version ?? '1.0.0';
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

function About() {
  return <ListGroup header="About">
    <ListRow icon="shield-checkmark-outline" iconColor="#2F7D4F" title="Privacy Policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
    <ListRow icon="document-text-outline" iconColor="#6B6862" title="Terms of Service" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
    {!!supportEmail && <ListRow icon="mail-outline" iconColor="#2F5F7A" title="Contact support" onPress={() => void Linking.openURL(`mailto:${supportEmail}`)} />}
    <ListRow title="Version" value={version} chevron={false} />
  </ListGroup>;
}

export default function Settings() {
  const { user, updateProfile, logout, deleteAccount, spotifyConnected, refresh, blocks, blockUser, setNotice } = useApp();
  const [name, setName] = useState(user?.name || ''), [bio, setBio] = useState(user?.bio || '');
  const [password, setPassword] = useState(''), [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false), [deletePassword, setDeletePassword] = useState('');
  const [config, setConfig] = useState<{ spotify: boolean; passwordRecovery: boolean } | null>(null);
  const { busy, run } = useTask();
  useEffect(() => { api<{ spotify: boolean; passwordRecovery: boolean }>('/config').then(setConfig).catch(() => {}); }, []);

  async function connect() {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS !== 'web') throw new Error('Connect Spotify using an installed build of MARGIN. Expo Go cannot receive this login callback.');
    const returnUri = Platform.OS === 'web' ? `${window.location.origin}/spotify-callback` : 'marginmusic://spotify-callback';
    const result = await api<{ url: string }>('/spotify/start', { method: 'POST', body: { returnUri } });
    if (Platform.OS === 'web') { window.location.assign(result.url); return; }
    const auth = await WebBrowser.openAuthSessionAsync(result.url, returnUri);
    if (auth.type === 'success') { await refresh(); if (auth.url.includes('status=failed')) throw new Error('Spotify connection was not completed. Try again.'); haptic.success(); }
  }

  if (!user) return <Screen back title="Settings" large>
    <Card style={{ gap: space.md }}>
      <T v="headline">Your account lives here</T>
      <T v="subhead" tone="secondary">Sign in to edit your profile, connect Spotify, and publish your music.</T>
      <Button label="Sign in or create account" onPress={() => router.push('/auth')} />
    </Card>
    <About />
  </Screen>;

  const profileChanged = name.trim() !== user.name || bio.trim() !== (user.bio || '');
  return <Screen back title="Settings" large>
    <Card style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={name || user.name} seed={user.handle} size={56} />
        <View style={{ flex: 1 }}><T v="headline">{user.name}</T><T v="footnote" tone="secondary">{user.handle}</T></View>
      </View>
      <View>
        <TextField label="Display name" value={name} onChangeText={setName} maxLength={50} />
        <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={160} placeholder="What do you listen to?" hint={`${bio.length}/160`} />
        <Button label="Save profile" loading={busy} disabled={!name.trim() || !profileChanged} onPress={() => void run(async () => { await updateProfile(name.trim(), bio.trim()); haptic.success(); setNotice('Profile saved.'); })} />
      </View>
    </Card>

    <ListGroup header="Connections" footer={config && !config.spotify ? 'Spotify isn’t available yet. Catalog search still works for every ranking.' : 'MARGIN never posts to Spotify. We only read your playlists and search the catalog.'}>
      <ListRow icon="musical-notes" iconColor="#1F9D55" title="Spotify" value={spotifyConnected ? 'Connected' : 'Not connected'} disabled={busy || (!spotifyConnected && config?.spotify === false)}
        onPress={() => void run(async () => { if (spotifyConnected) { await api('/spotify', { method: 'DELETE' }); await refresh(); setNotice('Spotify disconnected.'); } else await connect(); })} />
      {spotifyConnected && <ListRow icon="albums-outline" iconColor="#1F9D55" title="Browse my playlists" onPress={() => router.push('/spotify')} />}
    </ListGroup>

    <ListGroup header="Security">
      <ListRow icon="key-outline" iconColor="#6B6862" title="Change password" chevron={!changingPassword} onPress={() => setChangingPassword((v) => !v)} />
      {changingPassword && <View style={{ padding: space.lg }}>
        <TextField label="Current password" secureTextEntry value={password} onChangeText={setPassword} maxLength={128} autoComplete="current-password" />
        <TextField label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="At least 10 characters" maxLength={128} autoComplete="new-password" />
        <Button label="Update password" loading={busy} disabled={!password || newPassword.length < 10} onPress={() => void run(async () => {
          await api('/me/password', { method: 'PUT', body: { currentPassword: password, password: newPassword } });
          setPassword(''); setNewPassword(''); setChangingPassword(false); haptic.success(); setNotice('Password changed. Other devices have been signed out.');
        })} />
      </View>}
    </ListGroup>

    {blocks.length > 0 && <ListGroup header="Blocked people">
      {blocks.map((p) => <ListRow key={p.id} title={p.name} subtitle={p.handle} chevron={false} trailing={<Button label="Unblock" size="sm" variant="secondary" inline disabled={busy} onPress={() => void run(() => blockUser(p.handle, true))} />} />)}
    </ListGroup>}

    <About />

    <ListGroup footer="Deleting your account permanently removes your profile, posts, comments, and Spotify connection.">
      <ListRow title="Sign out" chevron={false} disabled={busy} onPress={() => void run(async () => { await logout(); router.replace('/'); })} />
      <ListRow title="Delete account" destructive chevron={false} disabled={busy} onPress={() => { setDeletePassword(''); setDeleting(true); }} />
    </ListGroup>

    <Dialog visible={deleting} title="Delete your account?" description="This permanently removes your account and everything you published. Enter your password to confirm." confirmLabel="Delete account" destructive busy={busy}
      onCancel={() => setDeleting(false)} onConfirm={() => void run(async () => { await deleteAccount(deletePassword); setDeleting(false); router.replace('/'); })}>
      <TextField label="Password" secureTextEntry value={deletePassword} onChangeText={setDeletePassword} maxLength={128} autoComplete="current-password" />
    </Dialog>
  </Screen>;
}

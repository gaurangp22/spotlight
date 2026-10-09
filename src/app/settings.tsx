import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { useInvite, useInvitedCount } from '../ui/invite';
import { haptic } from '../ui/haptics';
import { Avatar, Button, Card, Dialog, ListGroup, ListRow, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

WebBrowser.maybeCompleteAuthSession();
const version = Constants.expoConfig?.version ?? '1.0.0';
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

/** Early access: bring friends in and tell the founders what's working. */
function BetaGroup() {
  const { invite } = useInvite();
  const joined = useInvitedCount();
  return <ListGroup header="Riffs beta" footer="Feedback goes straight to the people building Riffs.">
    <ListRow icon="share-social" iconColor="#34C759" title="Invite friends" subtitle={joined ? `${joined} joined with your link` : 'They’ll follow you when they join'} onPress={invite} />
    <ListRow icon="chatbox-ellipses-outline" iconColor="#007AFF" title="Send feedback" onPress={() => router.push({ pathname: '/feedback', params: { from: 'settings' } })} />
  </ListGroup>;
}

function About({ feedback = false }: { feedback?: boolean }) {
  return <ListGroup header="About">
    <ListRow icon="shield-checkmark-outline" iconColor="#0FA3B1" title="Privacy Policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
    <ListRow icon="document-text-outline" iconColor="#8E8E93" title="Terms of Service" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
    {!!supportEmail && <ListRow icon="mail-outline" iconColor="#007AFF" title="Contact support" onPress={() => void Linking.openURL(`mailto:${supportEmail}`)} />}
    {feedback && <ListRow icon="chatbox-ellipses-outline" iconColor="#007AFF" title="Send feedback" onPress={() => router.push({ pathname: '/feedback', params: { from: 'settings' } })} />}
    <ListRow title="Version" value={version} chevron={false} />
  </ListGroup>;
}

export default function Settings() {
  const { user, updateProfile, logout, deleteAccount, spotifyConnected, refresh, blocks, blockUser, setNotice } = useApp();
  const [name, setName] = useState(user?.name || ''), [bio, setBio] = useState(user?.bio || '');
  const [status, setStatus] = useState(user?.status || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [password, setPassword] = useState(''), [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false), [deletePassword, setDeletePassword] = useState('');
  const [config, setConfig] = useState<{ spotify: boolean; passwordRecovery: boolean } | null>(null);
  const { busy, run } = useTask();
  useEffect(() => { api<{ spotify: boolean; passwordRecovery: boolean }>('/config').then(setConfig).catch(() => {}); }, []);

  async function connect() {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS !== 'web') throw new Error('Connect Spotify using an installed build of Riffs. Expo Go cannot receive this login callback.');
    const returnUri = Platform.OS === 'web' ? `${window.location.origin}/spotify-callback` : 'marginmusic://spotify-callback';
    const result = await api<{ url: string }>('/spotify/start', { method: 'POST', body: { returnUri } });
    if (Platform.OS === 'web') { window.location.assign(result.url); return; }
    const auth = await WebBrowser.openAuthSessionAsync(result.url, returnUri);
    if (auth.type === 'success') { await refresh(); if (auth.url.includes('status=failed')) throw new Error('Spotify connection was not completed. Try again.'); haptic.success(); }
  }

  if (!user) return <Screen back title="Settings" large>
    <Card style={{ gap: space.md }}>
      <T v="headline">Your account lives here</T>
      <T v="subhead" tone="secondary">Sign in to edit your profile, connect Spotify, and post your ratings.</T>
      <Button label="Sign in or create account" onPress={() => router.push('/auth')} />
    </Card>
    <About feedback />
  </Screen>;

  const profileChanged = name.trim() !== user.name || bio.trim() !== (user.bio || '') || status.trim() !== (user.status || '') || avatar !== (user.avatar || '');
  async function choosePhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (picked.canceled) return;
    const photoAsset = picked.assets[0];
    if (!photoAsset.width || !photoAsset.height) throw new Error('That photo could not be read. Choose another image.');
    const side = Math.min(photoAsset.width, photoAsset.height), context = ImageManipulator.manipulate(photoAsset.uri);
    context.crop({ originX: Math.floor((photoAsset.width - side) / 2), originY: Math.floor((photoAsset.height - side) / 2), width: side, height: side });
    context.resize({ width: 256, height: 256 });
    const rendered = await context.renderAsync();
    const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    if (!photo.base64 || photo.base64.length > 239977) throw new Error('That photo is too large. Choose a smaller photo.');
    setAvatar(`data:image/jpeg;base64,${photo.base64}`);
  }
  return <Screen back title="Settings" large>
    <Card style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={name || user.name} seed={user.handle} uri={avatar} size={56} />
        <View style={{ flex: 1 }}><T v="headline">{user.name}</T><T v="footnote" tone="secondary">{user.handle}</T></View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Choose photo" icon="image-outline" variant="secondary" size="md" disabled={busy} onPress={() => void run(choosePhoto)} />
        {!!avatar && <Button label="Remove photo" variant="plain" size="md" disabled={busy} onPress={() => setAvatar('')} />}
      </View>
      <View>
        <TextField label="Display name" value={name} onChangeText={setName} maxLength={50} />
        <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={160} placeholder="What do you listen to?" hint={`${bio.length}/160`} />
        <TextField label="Music status" value={status} onChangeText={setStatus} maxLength={60} placeholder="An album, a mood, what’s on repeat…" hint={`${status.length}/60 · Shown on your profile`} />
        <Button label="Save profile" loading={busy} disabled={!name.trim() || !profileChanged} onPress={() => void run(async () => { await updateProfile(name.trim(), bio.trim(), status.trim(), avatar); haptic.success(); setNotice('Profile saved.'); })} />
      </View>
    </Card>
    <BetaGroup />
    <ListGroup header="Your music">
      <ListRow icon="download-outline" title="Import a playlist" onPress={() => router.push('/import-playlist')} />
      <ListRow icon="headset-outline" title="Listening diary" onPress={() => router.push('/history')} />
      <ListRow icon="chatbubbles-outline" title="Messages" onPress={() => router.push('/messages')} />
      <ListRow icon="options-outline" title="Messages, alerts & email" onPress={() => router.push('/account-preferences')} />
      <ListRow icon="bookmark-outline" title="Listen later & saved posts" onPress={() => router.push('/library')} />
      <ListRow icon="disc-outline" title="Listening clubs" onPress={() => router.push('/clubs')} />
      <ListRow icon="musical-notes-outline" title="Set up your music profile" onPress={() => router.push('/onboarding')} />
    </ListGroup>

    {(config?.spotify || spotifyConnected) && <ListGroup header="Connections" footer="Riffs never posts to Spotify. We only read your playlists and top music, and search the catalog.">
      <ListRow icon="musical-notes" iconColor="#1DB954" title="Spotify" value={spotifyConnected ? 'Connected' : 'Not connected'} disabled={busy || (!spotifyConnected && config?.spotify === false)}
        onPress={() => void run(async () => { if (spotifyConnected) { await api('/spotify', { method: 'DELETE' }); await refresh(); setNotice('Spotify disconnected.'); } else await connect(); })} />
      {spotifyConnected && <ListRow icon="stats-chart" iconColor="#1DB954" title="Your top music" subtitle="Rate your most-played songs and artists" onPress={() => router.push('/spotify-top')} />}
      {spotifyConnected && <ListRow icon="albums-outline" iconColor="#1DB954" title="Browse my playlists" onPress={() => router.push('/spotify')} />}
    </ListGroup>}

    <ListGroup header="Security">
      <ListRow icon="key-outline" iconColor="#8E8E93" title="Change password" chevron={!changingPassword} onPress={() => setChangingPassword((v) => !v)} />
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

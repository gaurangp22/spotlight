import { router } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Action, Header, Page } from '../ui/components';
import { Confirm, F, Field, useTask } from '../ui/forms';

WebBrowser.maybeCompleteAuthSession();
export default function Settings() {
  const { user, updateProfile, logout, deleteAccount, spotifyConnected, refresh, blocks, blockUser, setNotice } = useApp();
  const [name, setName] = useState(user?.name || ''), [bio, setBio] = useState(user?.bio || '');
  const [password, setPassword] = useState(''), [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [config, setConfig] = useState<{ spotify: boolean; passwordRecovery: boolean } | null>(null);
  const { busy, run } = useTask();
  useEffect(() => { api<{ spotify: boolean; passwordRecovery: boolean }>('/config').then(setConfig).catch(() => {}); }, []);
  async function connect() {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS !== 'web') throw new Error('Connect Spotify using an installed development or preview build. Expo Go cannot receive this login callback.');
    const returnUri = Platform.OS === 'web' ? `${window.location.origin}/spotify-callback` : 'marginmusic://spotify-callback';
    const result = await api<{ url: string }>('/spotify/start', { method: 'POST', body: { returnUri } });
    if (Platform.OS === 'web') { window.location.assign(result.url); return; }
    const auth = await WebBrowser.openAuthSessionAsync(result.url, returnUri);
    if (auth.type === 'success') { await refresh(); if (auth.url.includes('status=failed')) throw new Error('Spotify connection was not completed. Try again.'); }
  }
  if (!user) return <Page><Header title="Settings" back /><View style={F.section}><Text style={F.title}>Your account lives here.</Text><Text style={F.note}>Sign in to connect Spotify, edit your profile, and publish your music.</Text><Action label="Sign in or create account" onPress={() => router.push('/auth')} /></View></Page>;
  return <Page><Header title="Settings" back /><View style={F.section}><Text style={F.label}>YOUR PROFILE · {user.handle}</Text><Field label="Display name" value={name} onChangeText={setName} maxLength={50} /><Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={160} /><Action label={busy ? 'Saving…' : 'Save profile'} disabled={busy || !name.trim()} onPress={() => void run(async () => { await updateProfile(name, bio); setNotice('Profile saved.'); })} /></View>
    <View style={F.section}><Text style={F.label}>SPOTIFY</Text><Text style={F.note}>{spotifyConnected ? 'Spotify is connected. Search its catalog and import your playlists when making a ranking.' : 'Connect your Spotify account to import playlists and use Spotify search.'}</Text><Action label={busy ? 'Working…' : spotifyConnected ? 'Disconnect Spotify' : 'Connect Spotify'} secondary disabled={busy} onPress={() => void run(async () => { if (spotifyConnected) { await api('/spotify', { method: 'DELETE' }); await refresh(); } else await connect(); })} icon="spotify" />{config && !config.spotify && <Text style={F.note}>Spotify setup is pending with the app owner.</Text>}{spotifyConnected && <Action label="Browse my playlists" onPress={() => router.push('/spotify')} />}</View>
    <View style={F.section}><Text style={F.label}>PASSWORD</Text><Field label="Current password" secureTextEntry value={password} onChangeText={setPassword} maxLength={128} /><Field label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="At least 10 characters" maxLength={128} /><Action label="Change password" secondary disabled={busy || !password || newPassword.length < 10} onPress={() => void run(async () => { await api('/me/password', { method: 'PUT', body: { currentPassword: password, password: newPassword } }); setPassword(''); setNewPassword(''); setNotice('Password changed. Other devices have been signed out.'); })} /></View>
    {blocks.length > 0 && <View style={F.section}><Text style={F.label}>BLOCKED PEOPLE</Text>{blocks.map((p) => <View key={p.id} style={{ gap: 10 }}><Text style={F.note}>{p.name} · {p.handle}</Text><Action label={`Unblock ${p.name}`} secondary disabled={busy} onPress={() => void run(() => blockUser(p.handle, true))} /></View>)}</View>}
    <View style={F.section}><Action label="Sign out" secondary disabled={busy} onPress={() => void run(async () => { await logout(); router.replace('/'); })} /><Action label="Delete account" secondary disabled={busy} onPress={() => { setPassword(''); setDeleting(true); }} /><Text style={F.note}>Deleting your account permanently removes your posts, comments, and Spotify connection.</Text></View>
    <Confirm visible={deleting} title="Delete your account?" description="This permanently removes your account and all the content you published. Enter your password to confirm." busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => void run(async () => { await deleteAccount(password); setDeleting(false); router.replace('/'); })}><Field label="Confirm account password" secureTextEntry value={password} onChangeText={setPassword} maxLength={128} /></Confirm>
  </Page>;
}

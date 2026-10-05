import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Action, Header, Page } from '../ui/components';
import { F, useTask } from '../ui/forms';
import { C } from '../ui/theme';

type Playlist = { id: string; name: string; artwork?: string; count: number };
export default function SpotifyPlaylists() {
  const { target } = useLocalSearchParams<{ target?: string }>();
  const { user, spotifyConnected, setDraft, setMoodDraft } = useApp();
  const [playlists, setPlaylists] = useState<Playlist[]>([]), [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const { busy, run } = useTask();
  const userId = user?.id;
  async function load(offset = 0) {
    setLoading(true); setError('');
    try { const data = await api<{ items: Playlist[]; nextOffset: number | null }>(`/spotify/playlists?offset=${offset}`); setPlaylists((v) => offset ? [...v, ...data.items] : data.items); setNextOffset(data.nextOffset); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!userId || !spotifyConnected) return;
    let active = true;
    api<{ items: Playlist[]; nextOffset: number | null }>('/spotify/playlists?offset=0').then((data) => { if (active) { setPlaylists(data.items); setNextOffset(data.nextOffset); } }).catch((e) => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, spotifyConnected]);
  async function importPlaylist(playlist: Playlist) {
    const items: MusicItem[] = [], seen = new Set<string>(); let offset: number | null = 0;
    while (offset !== null && items.length < 100) {
      const page: { items: MusicItem[]; nextOffset: number | null } = await api(`/spotify/playlists/${playlist.id}?offset=${offset}`);
      for (const i of page.items) if (!seen.has(i.id) && items.length < 100) { seen.add(i.id); items.push(i); }
      offset = page.nextOffset;
    }
    if (!items.length) throw new Error('This playlist contains no available songs. Try another playlist.');
    if (target === 'moodboard') { setMoodDraft((v) => ({ ...v, title: v.title || playlist.name, items: items.slice(0, 30) })); router.replace('/moodboard'); }
    else { setDraft((v) => ({ ...v, title: v.title || `${playlist.name}, ranked`, items })); router.replace('/builder'); }
  }
  return <Page><Header title="Your Spotify playlists" back /><Text style={F.title}>Start with your collection.</Text><Text style={[F.note, { marginBottom: 20 }]}>Choose a playlist to replace the picks in your current draft. Up to 100 unique songs are imported in playlist order; you decide their ranks.</Text>{!user || !spotifyConnected ? <Action label="Connect Spotify" onPress={() => router.push('/settings')} /> : <>{!!error && <View style={{ gap: 10 }}><Text style={F.note}>{error}</Text><Action label="Try again" secondary onPress={() => void load()} /></View>}{playlists.map((p) => <Pressable accessibilityRole="button" disabled={busy} key={p.id} onPress={() => void run(() => importPlaylist(p))} style={{ flexDirection: 'row', gap: 15, paddingVertical: 18, borderBottomWidth: 1, borderColor: C.line, opacity: busy ? 0.5 : 1 }}>{p.artwork && <Image source={{ uri: p.artwork }} style={{ width: 58, height: 58 }} />}<View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 18, fontWeight: '800' }}>{p.name}</Text><Text style={F.note}>{p.count} tracks</Text></View></Pressable>)}{(loading || busy) && <ActivityIndicator color={C.accent} style={{ padding: 25 }} />}{!loading && !error && !playlists.length && <Text style={F.note}>No playlists yet. Create a playlist in Spotify, then return here.</Text>}{!loading && nextOffset !== null && <Action label="Load more playlists" secondary onPress={() => void load(nextOffset)} />}</>}</Page>;
}

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Loading, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { Button, Card, EmptyState, Ionicons, T } from '../ui/primitives';
import { curve, space, useTheme } from '../ui/theme';

type Playlist = { id: string; name: string; artwork?: string; count: number };
export default function SpotifyPlaylists() {
  const { c } = useTheme();
  const { target } = useLocalSearchParams<{ target?: string }>();
  const { user, spotifyConnected, setDraft, setMoodDraft } = useApp();
  const [playlists, setPlaylists] = useState<Playlist[]>([]), [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const { busy, run } = useTask();
  const ready = !!user && spotifyConnected;

  const load = useCallback(async (offset = 0) => {
    setLoading(true); setError('');
    try { const data = await api<{ items: Playlist[]; nextOffset: number | null }>(`/spotify/playlists?offset=${offset}`); setPlaylists((v) => offset ? [...v, ...data.items] : data.items); setNextOffset(data.nextOffset); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    api<{ items: Playlist[]; nextOffset: number | null }>('/spotify/playlists?offset=0')
      .then((data) => { if (active) { setPlaylists(data.items); setNextOffset(data.nextOffset); } })
      .catch((e) => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready]);

  async function importPlaylist(playlist: Playlist) {
    setImporting(playlist.id);
    try {
      const items: MusicItem[] = [], seen = new Set<string>(); let offset: number | null = 0;
      while (offset !== null && items.length < 100) {
        const page: { items: MusicItem[]; nextOffset: number | null } = await api(`/spotify/playlists/${playlist.id}?offset=${offset}`);
        for (const i of page.items) if (!seen.has(i.id) && items.length < 100) { seen.add(i.id); items.push(i); }
        offset = page.nextOffset;
      }
      if (!items.length) throw new Error('This playlist has no available songs. Try another playlist.');
      haptic.success();
      if (target === 'moodboard') { setMoodDraft((v) => ({ ...v, title: v.title || playlist.name, items: items.slice(0, 30) })); router.replace('/moodboard'); }
      else { setDraft((v) => ({ ...v, title: v.title || `${playlist.name}, ranked`, items })); router.replace('/builder'); }
    } finally { setImporting(null); }
  }

  return <Screen back title="Spotify playlists" large subtitle={ready ? `Choose a playlist to replace the picks in your ${target === 'moodboard' ? 'mood board' : 'draft'}. Up to ${target === 'moodboard' ? 30 : 100} unique songs, in playlist order.` : undefined}>
    {!ready ? <Card><EmptyState icon="musical-notes" title="Connect Spotify" text="Link your Spotify account in Settings to import your playlists." action={<Button label="Open Settings" inline onPress={() => router.push('/settings')} />} /></Card>
      : error && !playlists.length ? <Card style={{ gap: space.md }}><T v="subhead" tone="secondary">{error}</T><Button label="Try again" variant="secondary" onPress={() => void load()} /></Card>
      : loading && !playlists.length ? <Loading label="Loading your playlists…" />
      : !playlists.length ? <Card><EmptyState icon="albums-outline" title="No playlists yet" text="Create a playlist in Spotify, then come back here." /></Card>
      : <>
        <Card padded={false}>{playlists.map((p, i) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Import ${p.name}, ${p.count} tracks`} disabled={busy} onPress={() => void run(() => importPlaylist(p))}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, pressed && { backgroundColor: c.fill }]}>
          <View style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center', ...curve }}>
            {p.artwork ? <Image source={{ uri: p.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Ionicons name="musical-notes" size={22} color={c.tertiary} />}
          </View>
          <View style={{ flex: 1 }}><T v="headline" numberOfLines={1}>{p.name}</T><T v="footnote" tone="secondary">{p.count} tracks</T></View>
          {importing === p.id ? <ActivityIndicator color={c.secondary} /> : <Ionicons name="chevron-forward" size={17} color={c.tertiary} />}
        </Pressable>)}</Card>
        {nextOffset !== null && <Button label="Load more" variant="secondary" loading={loading} style={{ marginTop: space.lg }} onPress={() => void load(nextOffset)} />}
      </>}
  </Screen>;
}

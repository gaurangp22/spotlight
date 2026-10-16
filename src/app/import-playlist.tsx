import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';
import { searchCatalog } from '../lib/music';
import { parseTrackList } from '../lib/playlist';
import { MusicItem, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MusicRow, Screen } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker } from '../ui/MusicPicker';
import { Button, Card, IconButton, SectionHeader, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

type Target = 'pod' | 'ranking' | 'moodboard';
// Pods hold whole playlists; a ranking stays short enough to order, a mood board shorter still.
const LIMITS: Record<Target, number> = { pod: 500, ranking: 100, moodboard: 30 }, MOOD_SONGS = LIMITS.moodboard;
const norm = (value: string) => value.toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\..*$/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const unique = (items: MusicItem[]) => items.filter((item, i, list) => list.findIndex((x) => x.id === item.id) === i);

/** Best catalog match for a title and artist, or null when nothing is a confident match. */
async function match(title: string, artist: string) {
  const firstArtist = artist.split(/,|&| x | feat\./i)[0].trim();
  const candidates = await searchCatalog(`${title} ${firstArtist}`.trim().slice(0, 100), 'song').catch(() => [] as MusicItem[]);
  const wanted = norm(title), who = norm(firstArtist);
  const exact = candidates.find((c) => norm(c.title) === wanted && (!who || norm(c.artist).includes(who)));
  const loose = candidates.find((c) => (norm(c.title).startsWith(wanted) || wanted.startsWith(norm(c.title))) && (!who || norm(c.artist).includes(who)));
  return { pick: exact || loose || null, candidates: candidates.slice(0, 3) };
}

function ImportForm() {
  const { target: rawTarget } = useLocalSearchParams<{ target?: string }>();
  const target: Target = rawTarget === 'ranking' || rawTarget === 'moodboard' ? rawTarget : 'pod';
  const { user, savePod, setDraft, setMoodDraft } = useApp();
  const LIMIT = LIMITS[target];
  const { busy, run } = useTask();
  const [link, setLink] = useState(''), [source, setSource] = useState(''), [title, setTitle] = useState(''), [note, setNote] = useState('');
  const [raw, setRaw] = useState(''), [items, setItems] = useState<MusicItem[]>([]), [misses, setMisses] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Ranking['visibility']>('public');
  const [picking, setPicking] = useState(false), [pasting, setPasting] = useState(false), [progress, setProgress] = useState('');
  const job = useRef(0);

  /** Spotify's public player has no covers, so matching songs are looked up in the catalog in the background. */
  async function fillCovers(list: MusicItem[], id: number) {
    const missing = list.filter((item) => !item.artwork);
    for (let start = 0; start < missing.length; start += 4) {
      if (job.current !== id) return;
      const found = await Promise.all(missing.slice(start, start + 4).map(async (item) => ({ item, pick: (await match(item.title, item.artist)).pick })));
      if (job.current !== id) return;
      setItems((rows) => rows.map((row) => {
        const hit = found.find((f) => f.item.id === row.id)?.pick;
        return hit ? { ...row, artwork: hit.artwork, album: row.album || hit.album, previewUrl: hit.previewUrl } : row;
      }));
    }
  }

  async function readLink() {
    const r = await api<{ title: string; sourceUrl: string; items: MusicItem[]; note: string }>('/catalog/playlist-link', { method: 'POST', body: { url: link.trim() } });
    if (!r.items.length) throw new Error('That playlist has no songs we could read. Try another link, or paste the track list.');
    const id = ++job.current;
    setSource(r.sourceUrl); setTitle((t) => t || r.title); setNote(r.note); setMisses([]);
    setItems(unique(r.items).slice(0, LIMIT)); haptic.success();
    void fillCovers(r.items, id);
  }

  async function matchTracks() {
    const parsed = parseTrackList(raw); if (!parsed.length) throw new Error('Paste one Song | Artist per line, or a CSV track list.');
    const found: MusicItem[] = [], missed: string[] = [];
    for (let start = 0; start < parsed.length; start += 4) {
      setProgress(`Matching ${Math.min(start + 4, parsed.length)} of ${parsed.length}`);
      const batch = await Promise.all(parsed.slice(start, start + 4).map(async (row) => ({ row, ...(await match(row.title, row.artist)) })));
      for (const b of batch) if (b.pick) found.push(b.pick); else missed.push(`${b.row.title}${b.row.artist ? ` · ${b.row.artist}` : ''}`);
    }
    setProgress(''); setItems((rows) => unique([...rows, ...found]).slice(0, LIMIT)); setMisses(missed); setRaw(''); setPasting(false);
    if (found.length) haptic.success();
  }

  function finish() {
    if (target === 'ranking') { setDraft((v) => ({ ...v, title: v.title || `${title.trim() || 'My playlist'}, ranked`, items })); router.replace('/builder'); return; }
    if (target === 'moodboard') { setMoodDraft((v) => ({ ...v, title: v.title || title.trim(), items: items.slice(0, MOOD_SONGS) })); router.replace('/moodboard'); return; }
    return run(async () => { const post = await savePod({ title: title.trim(), subtitle: 'A playlist brought into Riffs.', items, visibility, open: false, sourceUrl: source || undefined }); router.replace(`/ranking/${post.id}`); });
  }

  if (!user) return <Screen back title="Import a playlist"><Button label="Sign in" onPress={() => router.push('/auth')} /></Screen>;
  const count = target === 'moodboard' ? Math.min(items.length, MOOD_SONGS) : items.length;
  const cta = target === 'pod' ? `Publish pod · ${count} songs` : `Use ${count} ${count === 1 ? 'song' : 'songs'}`;
  return <Screen back title="Import a playlist" large
    footer={items.length ? <Button label={cta} loading={busy} disabled={(target === 'pod' && !title.trim()) || !items.length} onPress={() => void finish()} /> : undefined}>
    <T v="subhead" tone="secondary" style={{ marginBottom: space.lg }}>
      {target === 'ranking' ? 'The songs replace the picks in your ranking draft.' : target === 'moodboard' ? `The first ${MOOD_SONGS} songs go on your mood board.` : 'Turn a playlist into a Riffs pod your friends can browse and rate.'}
    </T>
    <Card style={{ gap: space.md }}>
      <TextField label="Playlist link" value={link} onChangeText={setLink} placeholder="https://open.spotify.com/playlist/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={1000}
        hint="In Spotify: ••• → Share → Copy link to playlist. The playlist must be public." />
      <Button label="Import songs" icon="download-outline" loading={busy && !progress} disabled={!link.trim() || busy} onPress={() => void run(readLink)} />
    </Card>
    {!pasting ? <Button label="No link? Paste a track list instead" variant="plain" size="sm" onPress={() => setPasting(true)} style={{ marginTop: space.sm }} />
      : <Card style={{ gap: space.md, marginTop: space.lg }}>
        <TextField label="Track list" value={raw} onChangeText={setRaw} multiline maxLength={20000} placeholder={'Song | Artist\nSong | Artist'} hint="One per line, or a CSV export with Track Name and Artist columns. Up to 100." />
        <Button label={progress || 'Find these songs'} variant="secondary" loading={!!progress} disabled={!raw.trim() || busy} onPress={() => void run(matchTracks)} />
      </Card>}

    {items.length > 0 && <>
      {target === 'pod' && <View style={{ marginTop: space.xl }}><TextField label="Pod name" value={title} onChangeText={setTitle} maxLength={100} placeholder="Late night rotation" /></View>}
      <SectionHeader title={`${items.length} ${items.length === 1 ? 'song' : 'songs'}`} detail={note || undefined} />
      <Card padded={false} style={{ paddingHorizontal: space.md }}>
        {items.map((item, index) => <MusicRow key={item.id} item={item} index={index} size={44} separator={index < items.length - 1}
          trailing={<IconButton icon="close" label={`Remove ${item.title}`} size={36} filled={false} tone="secondary" onPress={() => setItems((rows) => rows.filter((row) => row.id !== item.id))} />} />)}
      </Card>
      <Button label="Add a song" icon="add" variant="secondary" disabled={items.length >= LIMIT || busy} onPress={() => setPicking(true)} style={{ marginTop: space.md }} />
    </>}
    {misses.length > 0 && <Card style={{ gap: space.xs, marginTop: space.lg }}>
      <T v="headline">Couldn’t find {misses.length} {misses.length === 1 ? 'song' : 'songs'}</T>
      <T v="footnote" tone="secondary">{misses.slice(0, 8).join('\n')}{misses.length > 8 ? `\n+${misses.length - 8} more` : ''}</T>
      <T v="caption" tone="secondary">Add them with search if you want them in.</T>
    </Card>}
    {target === 'pod' && items.length > 0 && <View style={{ marginTop: space.xl }}><Visibility value={visibility} onChange={setVisibility} /></View>}
    <MusicPicker spotifyConnected={false} visible={picking} onClose={() => setPicking(false)} onPick={(item) => { setItems((rows) => unique([...rows, item]).slice(0, LIMIT)); setPicking(false); }} />
  </Screen>;
}
export default function ImportPlaylist() { const { user } = useApp(); return <ImportForm key={user?.id || 'guest'} />; }

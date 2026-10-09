import { router } from 'expo-router';
import { useState } from 'react';
import { api } from '../lib/api';
import { searchCatalog } from '../lib/music';
import { parseTrackList } from '../lib/playlist';
import { MusicItem, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MusicRow, Screen } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { MusicPicker } from '../ui/MusicPicker';
import { Button, Card, ListRow, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

type Match = { label: string; pick: MusicItem | null; candidates: MusicItem[] };
function ImportForm() {
  const { user, savePod } = useApp(); const { busy, run } = useTask();
  const [link, setLink] = useState(''), [source, setSource] = useState(''), [title, setTitle] = useState(''), [note, setNote] = useState('');
  const [raw, setRaw] = useState(''), [matches, setMatches] = useState<Match[]>([]), [visibility, setVisibility] = useState<Ranking['visibility']>('public');
  const [picking, setPicking] = useState(false), [progress, setProgress] = useState('');
  const picks = matches.flatMap((row) => row.pick ? [row.pick] : []).filter((item, i, list) => list.findIndex((x) => x.id === item.id) === i);
  async function readLink() {
    const r = await api<{ title: string; sourceUrl: string; items: MusicItem[]; note: string }>('/catalog/playlist-link', { method: 'POST', body: { url: link.trim() } });
    setSource(r.sourceUrl); if (!title) setTitle(r.title); setNote(r.note);
    if (r.items.length) setMatches(r.items.map((item) => ({ label: `${item.title} · ${item.artist}`, pick: item, candidates: [item] })));
  }
  async function matchTracks() {
    const parsed = parseTrackList(raw); if (!parsed.length) throw new Error('Paste one Song | Artist per line, or a CSV track list.');
    const found: Match[] = [];
    for (let start = 0; start < parsed.length; start += 3) {
      setProgress(`Matching ${Math.min(start + 3, parsed.length)} of ${parsed.length}`);
      const batch = await Promise.all(parsed.slice(start, start + 3).map(async (row) => {
        const candidates = await searchCatalog(`${row.title} ${row.artist}`.trim().slice(0, 100), 'song', { spotifyConnected: false, spotifyCatalog: false }).catch(() => []);
        const exact = candidates.find((item) => item.title.toLowerCase() === row.title.toLowerCase() && (!row.artist || item.artist.toLowerCase().includes(row.artist.toLowerCase())));
        return { label: `${row.title}${row.artist ? ` · ${row.artist}` : ''}`, pick: exact || null, candidates: candidates.slice(0, 3) };
      })); found.push(...batch);
    }
    setMatches(found); setProgress(''); setNote('Exact matches are selected. Confirm other matches or skip them before publishing.');
  }
  if (!user) return <Screen back title="Import a playlist"><Button label="Sign in" onPress={() => router.push('/auth')} /></Screen>;
  return <Screen back title="Bring your playlist" large footer={<Button label={`Publish pod · ${picks.length} picks`} loading={busy} disabled={!title.trim() || !picks.length} onPress={() => void run(async () => { const post = await savePod({ title: title.trim(), subtitle: 'A playlist brought into Riffs.', items: picks, visibility, open: false, sourceUrl: source || undefined }); router.replace(`/ranking/${post.id}`); })} />}>
    <T v="subhead" tone="secondary" style={{ marginBottom: space.lg }}>Bring your picks into a Riffs pod. Music plays in your usual music app.</T>
    <Card style={{ gap: space.md, marginBottom: space.lg }}><TextField label="Playlist link (optional)" value={link} onChangeText={setLink} placeholder="Full Spotify, Apple Music, or Deezer playlist URL" autoCapitalize="none" keyboardType="url" maxLength={1000} /><Button label="Read playlist link" variant="secondary" loading={busy} disabled={!link.trim()} onPress={() => void run(readLink)} /><T v="caption" tone="secondary">Public Deezer playlists can supply tracks. Spotify and Apple Music links preserve the source; add their tracks below.</T>{!!source && <T v="caption" tone="secondary">Source attached</T>}</Card>
    <TextField label="Pod name" value={title} onChangeText={setTitle} maxLength={100} placeholder="Late night rotation" />
    <TextField label="Paste a track list or CSV" value={raw} onChangeText={setRaw} multiline maxLength={20000} placeholder={'Song | Artist\nSong | Artist'} hint="Up to 100 tracks. CSV supports Track Name and Artist Name(s) columns." />
    <Button label={progress || 'Find track matches'} variant="secondary" loading={busy} disabled={!raw.trim()} onPress={() => void run(matchTracks)} style={{ marginBottom: space.md }} />
    {!!note && <T v="subhead" tone="secondary" style={{ marginBottom: space.lg }}>{note}</T>}
    {matches.map((match, index) => <Card key={`${index}:${match.label}`} style={{ gap: space.sm, marginBottom: space.md }}><T v="headline">{match.label}</T>{match.pick ? <><MusicRow item={match.pick} /><Button label="Skip this pick" size="sm" variant="plain" onPress={() => setMatches((rows) => rows.map((row, i) => i === index ? { ...row, pick: null } : row))} /></> : <>{match.candidates.length ? match.candidates.map((candidate) => <ListRow key={candidate.id} title={candidate.title} subtitle={candidate.artist} onPress={() => setMatches((rows) => rows.map((row, i) => i === index ? { ...row, pick: candidate } : row))} />) : <T v="caption" tone="secondary">No match found. Add this pick with search, or leave it out.</T>}</>}</Card>)}
    <Button label="Add music with search" variant="secondary" onPress={() => setPicking(true)} disabled={picks.length >= 100 || busy} style={{ marginBottom: space.lg }} />
    <Visibility value={visibility} onChange={setVisibility} />
    <MusicPicker spotifyConnected={false} visible={picking} onClose={() => setPicking(false)} onPick={(item) => { setMatches((rows) => [...rows, { label: `${item.title} · ${item.artist}`, pick: item, candidates: [item] }].slice(0, 100)); setPicking(false); }} />
  </Screen>;
}
export default function ImportPlaylist() { const { user } = useApp(); return <ImportForm key={user?.id || 'guest'} />; }

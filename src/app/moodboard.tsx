import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { MusicItem } from '../lib/types';
import { searchMusic } from '../lib/music';
import { sampleMusic } from '../lib/sample';
import { errorMessage } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Action, Eyebrow, Header, MusicRow, Page } from '../ui/components';
import { F, Field, useTask, Visibility } from '../ui/forms';
import { MoodGrid, MOOD_THEMES } from '../ui/mood';
import { C } from '../ui/theme';

export default function MoodBuilder() {
  const { moodDraft: draft, setMoodDraft: setDraft, publishMood, user, spotifyConnected } = useApp();
  const [note, setNote] = useState(''), [query, setQuery] = useState(''), [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<MusicItem[]>([]), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const { busy, run } = useTask();
  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) return;
    const controller = new AbortController(); let active = true;
    const timer = setTimeout(() => { setSearching(true); setSearchError(''); searchMusic(query, 'song', spotifyConnected, controller.signal).then((v) => { if (active) setResults(v); }).catch((e) => { if (active) setSearchError(errorMessage(e)); }).finally(() => { if (active) setSearching(false); }); }, 400);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query, spotifyConnected, searchOpen]);
  async function addPhoto() {
    if (draft.tiles.length >= 12) throw new Error('A mood board can hold up to 12 photos and notes.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const photo = result.assets[0];
    if (!photo.width || !photo.height) throw new Error('That photo could not be read. Choose a JPEG or PNG and try again.');
    const context = ImageManipulator.manipulate(photo.uri);
    const scale = Math.min(1, 1000 / Math.max(photo.width, photo.height));
    context.resize({ width: Math.max(1, Math.round(photo.width * scale)), height: Math.max(1, Math.round(photo.height * scale)) });
    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.65, base64: true });
    if (!image.base64 || image.base64.length > 1100000) throw new Error('That photo is too large. Try a smaller one.');
    setDraft((v) => ({ ...v, tiles: [...v.tiles, { id: `photo-${Date.now()}`, type: 'photo', text: '', uri: `data:image/jpeg;base64,${image.base64}` }] }));
  }
  function addNote() { if (!note.trim() || draft.tiles.length >= 12) return; setDraft((v) => ({ ...v, tiles: [...v.tiles, { id: `note-${Date.now()}`, type: 'note', text: note.trim() }] })); setNote(''); }
  function addSong(item: MusicItem) { setDraft((v) => v.items.some((i) => i.id === item.id) || v.items.length >= 30 ? v : { ...v, items: [...v.items, item] }); }
  return <Page><Header title={draft.editingId ? 'Edit mood board' : 'Make a mood board'} back /><View style={{ marginTop: 25 }}><Eyebrow>MUSIC HAS A FEELING</Eyebrow><Text style={F.title}>Give it a world.</Text><Field label="Mood board title" value={draft.title} onChangeText={(title) => setDraft((v) => ({ ...v, title }))} placeholder="e.g. Rainy nights" maxLength={100} /><Field label="Description" value={draft.subtitle} onChangeText={(subtitle) => setDraft((v) => ({ ...v, subtitle }))} placeholder="Set the scene…" multiline maxLength={500} />
    <Text style={[F.label, { marginBottom: 10 }]}>COLOUR STORY</Text><View style={F.row}>{(Object.keys(MOOD_THEMES) as (keyof typeof MOOD_THEMES)[]).map((theme) => <Pressable accessibilityRole="button" accessibilityState={{ selected: draft.theme === theme }} key={theme} onPress={() => setDraft((v) => ({ ...v, theme }))} style={[F.pill, { backgroundColor: MOOD_THEMES[theme].bg, borderWidth: draft.theme === theme ? 3 : 1, borderColor: draft.theme === theme ? C.accent : C.line }]}><Text style={{ color: MOOD_THEMES[theme].fg, textTransform: 'capitalize', fontWeight: '800' }}>{theme}</Text></Pressable>)}</View>
    <MoodGrid post={draft} />
    <View style={F.section}><Text style={F.label}>BUILD YOUR MOOD · {draft.items.length}/30 SONGS · {draft.tiles.length}/12 TILES</Text><View style={F.row}><Action label={busy ? 'Adding photo…' : 'Add photo'} secondary disabled={busy || draft.tiles.length >= 12} onPress={() => void run(addPhoto)} icon="image-outline" /><Action label={searchOpen ? 'Done' : 'Add music'} secondary onPress={() => setSearchOpen((v) => !v)} icon="music-note" /></View><Action label={spotifyConnected ? 'Import Spotify playlist' : 'Connect Spotify'} secondary icon="spotify" onPress={() => router.push(spotifyConnected ? { pathname: '/spotify', params: { target: 'moodboard' } } : '/settings')} />
    {searchOpen && <><Field label="Search songs" value={query} onChangeText={(v) => { setQuery(v); setResults([]); setSearchError(''); setSearching(false); }} placeholder="Search by artist or song" />{searching && <ActivityIndicator color={C.accent} />}{!!searchError && <Text style={F.note}>{searchError}</Text>}{(query.trim().length < 2 ? sampleMusic.filter((i) => i.kind === 'song') : results).slice(0, 12).map((i) => <MusicRow key={i.id} item={i} onPress={() => addSong(i)} trailing={<MaterialCommunityIcons name={draft.items.some((s) => s.id === i.id) ? 'check' : 'plus'} size={23} color={C.accent} />} />)}{query.trim().length >= 2 && !searching && !searchError && !results.length && <Text style={F.note}>Nothing found. Try the artist name or a shorter title.</Text>}<Text style={F.note}>{spotifyConnected ? 'Spotify search' : 'Catalog search; connect Spotify in Settings to search your Spotify music.'}</Text></>}
    <Field label="Add a note" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="A lyric, a memory, a feeling…" /><Action label="Add note" secondary disabled={!note.trim() || draft.tiles.length >= 12} onPress={addNote} />
    </View>
    {draft.items.map((i) => <MusicRow key={i.id} item={i} trailing={<Pressable accessibilityRole="button" accessibilityLabel={`Remove ${i.title}`} style={{ padding: 15 }} onPress={() => setDraft((v) => ({ ...v, items: v.items.filter((item) => item.id !== i.id) }))}><MaterialCommunityIcons name="close" size={22} color={C.muted} /></Pressable>} />)}
    {draft.tiles.map((t) => <View key={t.id} style={{ paddingVertical: 15, borderBottomWidth: 1, borderColor: C.line, gap: 10 }}>{t.uri && <Image source={{ uri: t.uri }} style={{ width: 80, height: 80 }} />}<Field label={t.type === 'note' ? 'Note' : 'Photo caption'} value={t.text} maxLength={500} multiline onChangeText={(text) => setDraft((v) => ({ ...v, tiles: v.tiles.map((tile) => tile.id === t.id ? { ...tile, text } : tile) }))} /><Action label="Remove tile" secondary onPress={() => setDraft((v) => ({ ...v, tiles: v.tiles.filter((tile) => tile.id !== t.id) }))} /></View>)}
    <Visibility value={draft.visibility} onChange={(visibility) => setDraft((v) => ({ ...v, visibility }))} /><Action label={!user ? 'Sign in to publish' : busy ? 'Publishing…' : draft.editingId ? 'Save changes' : 'Publish mood board'} disabled={busy || !draft.title.trim() || !draft.items.length && !draft.tiles.length} onPress={() => user ? void run(async () => { const post = await publishMood(); router.replace(`/ranking/${post.id}`); }) : router.push('/auth')} /><Text style={[F.note, { textAlign: 'center', marginTop: 15 }]}>Your draft saves automatically on this device.</Text>
  </View></Page>;
}

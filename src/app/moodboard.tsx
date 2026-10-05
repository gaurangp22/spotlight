import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MusicRow, Screen } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MoodGrid, MOOD_THEMES } from '../ui/mood';
import { MusicPicker } from '../ui/MusicPicker';
import { Button, Card, IconButton, Ionicons, ListGroup, ListRow, SectionHeader, T, TextField } from '../ui/primitives';
import { curve, makeStyles, noOutline, radius, space, type, useTheme } from '../ui/theme';

const MAX_TILES = 12, MAX_SONGS = 30;

export default function MoodBuilder() {
  const s = useStyles();
  const { c } = useTheme();
  const { moodDraft: draft, setMoodDraft: setDraft, publishMood, user, spotifyConnected } = useApp();
  const [note, setNote] = useState(''), [writing, setWriting] = useState(false), [picking, setPicking] = useState(false);
  const { busy, run } = useTask();
  const tilesFull = draft.tiles.length >= MAX_TILES;
  const missing = !draft.title.trim() ? 'Give your mood board a title to publish.' : !draft.items.length && !draft.tiles.length ? 'Add music, a photo, or a note to publish.' : '';

  async function addPhoto() {
    if (tilesFull) throw new Error(`A mood board can hold up to ${MAX_TILES} photos and notes.`);
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
    haptic.success();
  }
  function addNote() {
    if (!note.trim() || tilesFull) return;
    setDraft((v) => ({ ...v, tiles: [...v.tiles, { id: `note-${Date.now()}`, type: 'note', text: note.trim() }] }));
    setNote(''); setWriting(false); haptic.success();
  }
  function toggleSong(item: MusicItem) {
    setDraft((v) => v.items.some((i) => i.id === item.id) ? { ...v, items: v.items.filter((i) => i.id !== item.id) }
      : v.items.length >= MAX_SONGS ? v : { ...v, items: [...v.items, item] });
  }

  return <Screen back title={draft.editingId ? 'Edit mood board' : 'Mood board'}
    footer={<View style={{ gap: space.sm }}>
      {!!user && !!missing && <T v="footnote" tone="secondary" center>{missing}</T>}
      {user ? <Button label={draft.editingId ? 'Save changes' : 'Publish'} iconRight="arrow-up" loading={busy} disabled={!!missing}
        onPress={() => void run(async () => { const post = await publishMood(); haptic.success(); router.replace(`/ranking/${post.id}`); })} />
        : <Button label="Sign in to publish" onPress={() => router.push('/auth')} />}
    </View>}>
    <TextInput accessibilityLabel="Mood board title" value={draft.title} onChangeText={(title) => setDraft((v) => ({ ...v, title }))} placeholder="Name the feeling" placeholderTextColor={c.tertiary}
      selectionColor={c.accent} multiline maxLength={100} maxFontSizeMultiplier={1.4} style={[type.title1, { color: c.text, marginTop: space.lg, paddingVertical: 0, minHeight: 40 }, noOutline]} />
    <TextInput accessibilityLabel="Mood board description" value={draft.subtitle} onChangeText={(subtitle) => setDraft((v) => ({ ...v, subtitle }))} placeholder="Set the scene (optional)" placeholderTextColor={c.tertiary}
      selectionColor={c.accent} multiline maxLength={500} maxFontSizeMultiplier={1.4} style={[type.body, s.subtitle, { color: c.secondary }, noOutline]} />

    <SectionHeader title="Colour story" />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {(Object.keys(MOOD_THEMES) as (keyof typeof MOOD_THEMES)[]).map((key) => {
        const active = draft.theme === key;
        return <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`${MOOD_THEMES[key].label} colour story`} onPress={() => { haptic.select(); setDraft((v) => ({ ...v, theme: key })); }} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[s.swatchRing, { borderColor: active ? c.accent : 'transparent' }]}>
            <View style={[s.swatch, { backgroundColor: MOOD_THEMES[key].bg }]}>{active && <Ionicons name="checkmark" size={20} color={MOOD_THEMES[key].fg} />}</View>
          </View>
          <T v="caption" tone={active ? 'primary' : 'secondary'} weight={active ? 'semibold' : 'medium'}>{MOOD_THEMES[key].label}</T>
        </Pressable>;
      })}
    </View>

    <MoodGrid post={draft} />

    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
      <Button label="Photo" icon="image-outline" variant="tinted" size="md" style={{ flex: 1 }} disabled={busy || tilesFull} onPress={() => void run(addPhoto)} />
      <Button label="Music" icon="musical-notes-outline" variant="tinted" size="md" style={{ flex: 1 }} onPress={() => setPicking(true)} />
      <Button label="Note" icon="text-outline" variant="tinted" size="md" style={{ flex: 1 }} disabled={tilesFull} onPress={() => setWriting((v) => !v)} />
    </View>
    <T v="footnote" tone="secondary" style={{ marginTop: space.sm, marginLeft: 4 }}>{draft.items.length}/{MAX_SONGS} songs · {draft.tiles.length}/{MAX_TILES} photos and notes</T>
    {writing && <Animated.View entering={FadeIn} style={{ marginTop: space.lg }}>
      <TextField label="New note" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="A lyric, a memory, a feeling…" autoFocus />
      <Button label="Add note" disabled={!note.trim()} onPress={addNote} />
    </Animated.View>}

    {draft.items.length > 0 && <>
      <SectionHeader title="Soundtrack" detail={`${draft.items.length}`} />
      <Card padded={false} style={{ paddingLeft: space.md, paddingRight: space.xs }}>
        {draft.items.map((item, index) => <Animated.View key={item.id} layout={LinearTransition} exiting={FadeOut.duration(150)}>
          <MusicRow item={item} size={44} separator={index < draft.items.length - 1} trailing={<IconButton icon="close" label={`Remove ${item.title}`} filled={false} size={34} tone="tertiary" onPress={() => toggleSong(item)} />} />
        </Animated.View>)}
      </Card>
    </>}

    {draft.tiles.length > 0 && <>
      <SectionHeader title="Photos & notes" detail={`${draft.tiles.length}`} />
      {draft.tiles.map((t) => <Animated.View key={t.id} layout={LinearTransition} exiting={FadeOut.duration(150)}>
        <Card style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', marginBottom: space.md }}>
            {t.uri ? <Image source={{ uri: t.uri }} style={s.thumb} contentFit="cover" /> : <View style={[s.thumb, { backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="text" size={20} color={c.accent} /></View>}
            <T v="headline" style={{ flex: 1 }}>{t.type === 'note' ? 'Note' : 'Photo'}</T>
            <IconButton icon="trash-outline" label={`Remove ${t.type}`} tone="danger" size={36} onPress={() => setDraft((v) => ({ ...v, tiles: v.tiles.filter((tile) => tile.id !== t.id) }))} />
          </View>
          <TextField label={t.type === 'note' ? 'Text' : 'Caption (optional)'} value={t.text} maxLength={500} multiline
            onChangeText={(text) => setDraft((v) => ({ ...v, tiles: v.tiles.map((tile) => tile.id === t.id ? { ...tile, text } : tile) }))} />
        </Card>
      </Animated.View>)}
    </>}

    <ListGroup>
      <ListRow icon="musical-notes" iconColor="#1F9D55" title={spotifyConnected ? 'Import a Spotify playlist' : 'Connect Spotify'} subtitle={spotifyConnected ? `Uses the first ${MAX_SONGS} songs` : 'Import playlists and search your library'}
        onPress={() => router.push(spotifyConnected ? { pathname: '/spotify', params: { target: 'moodboard' } } : '/settings')} />
    </ListGroup>

    <SectionHeader title="Who can see it" />
    <Visibility value={draft.visibility} onChange={(visibility) => setDraft((v) => ({ ...v, visibility }))} />

    <MusicPicker visible={picking} onClose={() => setPicking(false)} selected={draft.items} onToggle={toggleSong} spotifyConnected={spotifyConnected} songsOnly limit={MAX_SONGS} />
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  subtitle: { marginTop: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  swatchRing: { padding: 3, borderRadius: 32, borderWidth: 2.5 },
  swatch: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, ...curve },
}));

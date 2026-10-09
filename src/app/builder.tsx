import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { activeKinds } from '../lib/categories';
import { MusicPicker, useAvailableKinds } from '../ui/MusicPicker';
import { SpotifyLinkImport } from '../ui/SpotifyLinkImport';
import { Artwork, Button, Card, EmptyState, IconButton, Ionicons, ListGroup, ListRow, SectionHeader, T } from '../ui/primitives';
import { makeStyles, noOutline, space, type, useTheme } from '../ui/theme';

export default function BuilderScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { draft, setDraft, addMusic, removeMusic, moveMusic, publish, allRankings, user, spotifyConnected, config } = useApp();
  const kinds = useAvailableKinds(activeKinds);
  const { busy, run } = useTask();
  const [picking, setPicking] = useState(false);
  const origin = allRankings.find((ranking) => ranking.id === draft.originId);
  const battle = mode === 'battle';
  const missing = !draft.title.trim() ? 'Give your ranking a title to publish.' : draft.items.length < 2 ? 'Add at least two picks to publish.' : '';

  const onPublish = async () => {
    const ranking = await publish();
    haptic.success();
    router.replace(`/ranking/${ranking.id}`);
  };
  const title = draft.editingId ? 'Edit ranking' : battle ? 'Battle Mode' : 'New ranking';

  return <Screen back title={title}
    right={<T v="caption" tone="tertiary">{draft.items.length || draft.title ? 'Saved' : ''}</T>}
    footer={<View style={{ gap: space.sm }}>
      {!!user && !!missing && <T v="footnote" tone="secondary" center>{missing}</T>}
      {user ? battle && draft.items.length >= 2 && !draft.editingId
        ? <Button label="Start the battle" icon="flash" onPress={() => router.push('/battle')} />
        : <Button label={draft.editingId ? 'Save changes' : 'Publish'} iconRight="arrow-up" loading={busy} disabled={!!missing} onPress={() => void run(onPublish)} />
        : <Button label="Sign in to publish" onPress={() => router.push('/auth')} />}
    </View>}>

    {origin && <View style={s.remix}><Ionicons name="git-branch-outline" size={15} color={c.accent} /><T v="footnote" weight="semibold" tone="accent">Your version of {origin.author}’s ranking</T></View>}
    {battle && !draft.editingId && <Card style={{ marginTop: space.sm, flexDirection: 'row', gap: space.md }}>
      <Ionicons name="flash" size={20} color={c.accent} />
      <T v="subhead" tone="secondary" style={{ flex: 1 }}>Add the contenders, then go head-to-head two at a time. Your picks decide the order.</T>
    </Card>}

    <TextInput accessibilityLabel="Ranking title" value={draft.title} onChangeText={(value) => setDraft((current) => ({ ...current, title: value }))}
      placeholder="Name your ranking" placeholderTextColor={c.tertiary} selectionColor={c.accent} multiline maxLength={100} maxFontSizeMultiplier={1.4}
      style={[type.title1, s.titleInput, { color: c.text }, noOutline]} />
    <TextInput accessibilityLabel="Ranking description" value={draft.subtitle} onChangeText={(value) => setDraft((current) => ({ ...current, subtitle: value }))}
      placeholder="Add some context (optional)" placeholderTextColor={c.tertiary} selectionColor={c.accent} maxLength={140} maxFontSizeMultiplier={1.4}
      style={[type.body, s.subtitleInput, { color: c.secondary }, noOutline]} />

    <SectionHeader title={battle ? 'Contenders' : 'Your order'} action={draft.items.length ? { label: 'Add', onPress: () => setPicking(true) } : undefined} />
    {draft.items.length ? <Card padded={false} style={{ overflow: 'hidden' }}>
      {draft.items.map((item, index) => <Animated.View key={item.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={FadeOut.duration(150)}
        style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }]}>
        <T v="headline" tabular center tone={index < 3 ? 'accent' : 'secondary'} style={{ width: 24 }}>{index + 1}</T>
        <Artwork item={item} size={40} />
        <View style={{ flex: 1, gap: 1 }}><T v="callout" weight="semibold" numberOfLines={1}>{item.title}</T><T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}</T></View>
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="chevron-up" label={`Move ${item.title} up`} filled={false} size={30} tone="secondary" disabled={index === 0} onPress={() => moveMusic(index, -1)} />
          <IconButton icon="chevron-down" label={`Move ${item.title} down`} filled={false} size={30} tone="secondary" disabled={index === draft.items.length - 1} onPress={() => moveMusic(index, 1)} />
          <IconButton icon="close" label={`Remove ${item.title}`} filled={false} size={30} tone="tertiary" onPress={() => removeMusic(item.id)} />
        </View>
      </Animated.View>)}
    </Card> : <Card><EmptyState icon="musical-notes" title="Every list starts somewhere" text="Add a few songs, albums, or artists, then put them in your order."
      action={<Button label="Add picks" icon="add" inline onPress={() => setPicking(true)} />} /></Card>}
    {draft.items.length > 0 && <T v="footnote" tone="secondary" style={{ marginTop: space.sm, marginLeft: 4 }}>{draft.items.length} of 100 picks</T>}

    {config?.spotifyCatalog && <SpotifyLinkImport label="Add to ranking" style={{ marginTop: space.xl }} onImport={(result) => {
      setDraft((current) => ({ ...current, title: current.title || result.title, items: [...current.items, ...result.items.filter((i) => !current.items.some((x) => x.id === i.id))].slice(0, 100) }));
    }} />}
    <ListGroup>
      <ListRow icon="musical-notes" iconColor="#1DB954" title={spotifyConnected ? 'Import a Spotify playlist' : 'Connect Spotify'} subtitle={spotifyConnected ? 'Replaces the picks in this draft' : 'Import playlists and search your library'} onPress={() => router.push(spotifyConnected ? '/spotify' : '/settings')} />
      {draft.items.length >= 2 && !battle && <ListRow icon="flash" iconColor="#007AFF" title="Sort with Battle Mode" subtitle="Pick favourites head-to-head" onPress={() => router.push('/battle')} />}
    </ListGroup>

    <SectionHeader title="Who can see it" />
    <Visibility value={draft.visibility} onChange={(visibility) => setDraft((current) => ({ ...current, visibility }))} />

    <MusicPicker visible={picking} onClose={() => setPicking(false)} selected={draft.items} limit={100} kinds={kinds} title="Add picks" spotifyConnected={spotifyConnected}
      onToggle={(item) => draft.items.some((chosen) => chosen.id === item.id) ? removeMusic(item.id) : addMusic(item)} />
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  remix: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginTop: space.sm },
  titleInput: { marginTop: space.xl, paddingVertical: 0, textAlignVertical: 'top', minHeight: 40 },
  subtitleInput: { marginTop: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: space.md, paddingRight: 2, minHeight: 64 },
}));

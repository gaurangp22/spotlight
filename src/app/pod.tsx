import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { activeKinds, categories } from '../lib/categories';
import { MusicItem, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker, useAvailableKinds } from '../ui/MusicPicker';
import { Artwork, Button, Card, EmptyState, IconButton, SectionHeader, T } from '../ui/primitives';
import { SpotifyLinkImport } from '../ui/SpotifyLinkImport';
import { makeStyles, noOutline, space, type, useTheme } from '../ui/theme';

/** Create or edit a pod: a collection of anything, optionally open for others to add to. */
export default function PodScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { itemId, editId } = useLocalSearchParams<{ itemId?: string; editId?: string }>();
  const { itemFor, allRankings, savePod, user, spotifyConnected, config } = useApp();
  const editing = editId ? allRankings.find((p) => p.id === editId && p.kind === 'pod') : undefined;
  const seed = itemId ? itemFor(itemId) : undefined;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? '');
  const [items, setItems] = useState<MusicItem[]>(editing?.items ?? (seed ? [seed] : []));
  const [visibility, setVisibility] = useState<Ranking['visibility']>(editing?.visibility ?? 'public');
  const [open, setOpen] = useState(editing?.open ?? true);
  const [picking, setPicking] = useState(false);
  const kinds = useAvailableKinds(activeKinds);
  const { busy, run } = useTask();
  const add = (list: MusicItem[]) => setItems((current) => [...current, ...list.filter((i) => !current.some((x) => x.id === i.id))].slice(0, 100));
  const toggle = (item: MusicItem) => setItems((current) => current.some((i) => i.id === item.id) ? current.filter((i) => i.id !== item.id) : [...current, item].slice(0, 100));
  const publish = async () => {
    const post = await savePod({ title: title.trim(), subtitle: subtitle.trim(), items, visibility, open: open && visibility !== 'private', sourceUrl: editing?.sourceUrl, editingId: editing?.id });
    haptic.success();
    router.replace(`/ranking/${post.id}`);
  };

  return <Screen back title={editing ? 'Edit pod' : 'New pod'}
    footer={user ? <View style={{ gap: space.sm }}>
      {!title.trim() && <T v="footnote" tone="secondary" center>Name your pod to publish it.</T>}
      <Button label={editing ? 'Save changes' : 'Publish pod'} iconRight="arrow-up" loading={busy} disabled={!title.trim()} onPress={() => void run(publish)} />
    </View> : <Button label="Sign in to publish" onPress={() => router.push('/auth')} />}>
    <TextInput accessibilityLabel="Pod name" value={title} onChangeText={setTitle} placeholder="Name your pod" placeholderTextColor={c.tertiary} selectionColor={c.accent} multiline maxLength={100} maxFontSizeMultiplier={1.4}
      style={[type.title1, s.titleInput, { color: c.text }, noOutline]} />
    <TextInput accessibilityLabel="Pod description" value={subtitle} onChangeText={setSubtitle} placeholder="What belongs here? (optional)" placeholderTextColor={c.tertiary} selectionColor={c.accent} maxLength={300} maxFontSizeMultiplier={1.4}
      style={[type.body, s.subtitleInput, { color: c.secondary }, noOutline]} />
    <T v="footnote" tone="secondary" style={{ marginTop: space.md }}>Pods collect music around one idea — a mood, a city, a summer. No order, no scores; just the good stuff.</T>

    <SectionHeader title="In this pod" action={items.length ? { label: 'Add', onPress: () => setPicking(true) } : undefined} />
    {items.length ? <Card padded={false} style={{ overflow: 'hidden' }}>
      {items.map((item, index) => <Animated.View key={item.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={FadeOut.duration(150)}
        style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }]}>
        <Artwork item={item} size={40} />
        <View style={{ flex: 1, gap: 1 }}>
          <T v="callout" weight="semibold" numberOfLines={1}>{item.title}</T>
          <T v="footnote" tone="secondary" numberOfLines={1}>{categories[item.kind].label} · {item.artist}{item.addedBy ? ` · added by ${item.addedBy}` : ''}</T>
        </View>
        <IconButton icon="close" label={`Remove ${item.title}`} filled={false} size={30} tone="tertiary" onPress={() => setItems((v) => v.filter((i) => i.id !== item.id))} />
      </Animated.View>)}
    </Card> : <Card><EmptyState icon="albums-outline" title="Start the collection" text="Add a few things yourself, or leave it open and let friends fill it."
      action={<Button label="Add things" icon="add" inline onPress={() => setPicking(true)} />} /></Card>}
    {items.length > 0 && <T v="footnote" tone="secondary" style={{ marginTop: space.sm, marginLeft: 4 }}>{items.length} of 100</T>}
    {config?.spotifyCatalog && <SpotifyLinkImport label="Add to pod" style={{ marginTop: space.lg }} onImport={(result) => add(result.items)} />}

    <SectionHeader title="Who can see it" />
    <Visibility value={visibility} onChange={setVisibility} />
    <Card style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">Let others add to it</T>
        <T v="footnote" tone="secondary">{visibility === 'private' ? 'Private pods are just for you.' : 'Anyone who can see the pod can contribute. You can remove anything.'}</T>
      </View>
      <Switch value={open && visibility !== 'private'} disabled={visibility === 'private'} onValueChange={(v) => { haptic.select(); setOpen(v); }} trackColor={{ true: c.accentFill, false: c.fillStrong }} accessibilityLabel="Let others add to this pod" />
    </Card>

    <MusicPicker visible={picking} onClose={() => setPicking(false)} selected={items} onToggle={toggle} limit={100} kinds={kinds} title="Add to pod" spotifyConnected={spotifyConnected} />
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  titleInput: { marginTop: space.lg, paddingVertical: 0, textAlignVertical: 'top', minHeight: 40 },
  subtitleInput: { marginTop: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: space.md, paddingRight: 2, minHeight: 64 },
}));

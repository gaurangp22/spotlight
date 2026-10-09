import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { categories, formatScore } from '../../lib/categories';
import { MusicItem, Ranking } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, RankingCard, Screen, ScoreBadge } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { SaveItemButton } from '../../ui/library';
import { haptic } from '../../ui/haptics';
import { Artwork, Badge, Button, Card, EmptyState, IconButton, ListRow, SectionHeader, Sheet, T } from '../../ui/primitives';
import { curve, gutter, radius, space, useTheme } from '../../ui/theme';

type ItemData = { item: MusicItem | null; average: number | null; count: number; reviews: Ranking[]; pods: Ranking[] };

function linkLabel(url: string) {
  if (url.includes('spotify.com')) return 'Open in Spotify';
  if (url.includes('apple.com')) return 'Open in Apple';
  if (url.includes('deezer.com')) return 'Open in Deezer';
  if (url.includes('themoviedb.org')) return 'Open on TMDB';
  if (url.includes('tvmaze.com')) return 'Open on TVmaze';
  if (url.includes('openlibrary.org')) return 'Open in Open Library';
  return 'Open link';
}

export default function ItemScreen() {
  const { c } = useTheme();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(raw);
  const { itemFor, ratingFor, rememberItem, following, rankings, user, contribute, setNotice } = useApp();
  const key = `${id}:${user?.id ?? 'guest'}`;
  const [snapshot, setSnapshot] = useState<{ key: string; data: ItemData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const data = snapshot?.key === key ? snapshot.data : null;
  const error = failure?.key === key ? failure.message : '';
  const [podding, setPodding] = useState(false);
  const { busy, run } = useTask();
  const mine = ratingFor(id);
  useEffect(() => {
    let active = true;
    api<ItemData>(`/items/${encodeURIComponent(id)}`).then((v) => { if (active) { setSnapshot({ key, data: v }); setFailure(null); if (v.item) rememberItem(v.item); } }).catch((e) => { if (active) setFailure({ key, message: errorMessage(e) }); });
    return () => { active = false; };
  }, [id, mine?.score, rememberItem, key]);
  const item = itemFor(id) ?? data?.item ?? undefined;

  if (!item) return <Screen back title="Details">{error || (data && !data.item)
    ? <Card style={{ marginTop: space.xl }}><EmptyState icon="help-circle-outline" title="Nothing here yet" text={error || 'No one has rated this yet. Find it in search to be the first.'} /></Card>
    : <Loading label="Loading…" />}</Screen>;

  const category = categories[item.kind];
  const reviews = data?.reviews ?? [];
  const friends = reviews.filter((r) => following.includes(r.handle) && r.score !== undefined);
  const friendAverage = friends.length ? Math.round(friends.reduce((sum, r) => sum + (r.score ?? 0), 0) / friends.length * 10) / 10 : null;
  const ordered = [...friends, ...reviews.filter((r) => !friends.includes(r))].filter((r) => r.userId !== user?.id);
  const myPods = rankings.filter((p) => p.kind === 'pod');
  const score = (label: string, value: number | null | undefined, detail: string) => <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
    {value != null ? <ScoreBadge score={value} size={48} /> : <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: c.hairline, borderStyle: 'dashed' }} />}
    <T v="caption" weight="semibold">{label}</T>
    <T v="caption" tone="secondary" center>{detail}</T>
  </View>;

  return <Screen back title={item.title} fadeTitle>
    <View style={{ borderRadius: radius.xl, overflow: 'hidden', padding: space.xl, alignItems: 'center', backgroundColor: '#15131C', ...curve }}>
      {item.artwork && <Image source={{ uri: item.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={Platform.OS === 'android' ? 25 : 40} />}
      <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
      <Artwork item={item} size={180} rounded={radius.lg} />
      <View style={{ marginTop: space.lg }}><Badge label={category.label} icon={category.icon} tone="inverse" /></View>
      <T v="title1" center style={{ color: '#FFFFFF', marginTop: space.sm }}>{item.title}</T>
      <T v="body" center style={{ color: '#FFFFFFCC' }}>{item.artist}</T>
    </View>

    <Card style={{ flexDirection: 'row', marginTop: space.lg, paddingVertical: space.lg }}>
      {score('You', mine?.score, mine ? 'Your score' : 'Not rated')}
      {score('Friends', friendAverage, friends.length ? `${friends.length} ${friends.length === 1 ? 'rating' : 'ratings'}` : 'No ratings yet')}
      {score('Everyone', data?.average, data ? `${data.count} ${data.count === 1 ? 'rating' : 'ratings'}` : '…')}
    </Card>

    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
      <Button label={mine ? 'Rate again' : 'Rate it'} icon="star" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/rate', params: { itemId: item.id } })} />
      <Button label="Video" icon="videocam" variant="tinted" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/video', params: { itemId: item.id } })} />
    </View>
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
      <Button label="Add to a pod" icon="albums-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => user ? setPodding(true) : router.push('/auth')} />
      {item.externalUrl && <Button label={linkLabel(item.externalUrl)} icon="open-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => void run(() => Linking.openURL(item.externalUrl!))} />}
    </View>
    {mine?.review ? <Card style={{ marginTop: space.lg }}><T v="overline" tone="secondary">Your review · {formatScore(mine.score)}</T><T v="body" style={{ marginTop: space.xs }}>“{mine.review}”</T></Card> : null}

    <View style={{ marginTop: space.md }}><SaveItemButton item={item} /></View>
    <SectionHeader title={friends.length ? 'Friends & everyone' : 'Reviews'} detail={ordered.length ? `${ordered.length}` : undefined} />
    {!data ? <Loading label="Loading reviews…" /> : ordered.length ? ordered.map((r) => <RankingCard key={r.id} ranking={r} />)
      : <Card><EmptyState icon="chatbubbles-outline" title="No reviews yet" text={`Be the first to rate this ${category.label.toLowerCase()}.`} /></Card>}

    {!!data?.pods.length && <>
      <SectionHeader title="In pods" detail={`${data.pods.length}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md }}>
        {data.pods.map((p) => <Card key={p.id} onPress={() => router.push(`/ranking/${p.id}`)} style={{ width: 200, gap: 4 }}>
          <T v="headline" numberOfLines={2}>{p.title}</T><T v="footnote" tone="secondary">{p.author} · {p.items.length} items</T>
        </Card>)}
      </ScrollView>
    </>}

    <Sheet visible={podding} onClose={() => setPodding(false)} title="Add to a pod">
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.xxl }}>
        <Button label="New pod with this" icon="add" onPress={() => { setPodding(false); router.push({ pathname: '/pod', params: { itemId: item.id } }); }} />
        {myPods.length ? <View style={{ marginTop: space.xl, backgroundColor: c.surface, borderRadius: radius.md, overflow: 'hidden' }}>
          {myPods.map((p) => {
            const added = p.items.some((i) => i.id === item.id);
            return <ListRow key={p.id} icon="albums" iconColor="#AF52DE" title={p.title} subtitle={added ? 'Already added' : `${p.items.length} items`} disabled={added || busy}
              trailing={added ? <IconButton icon="checkmark" label="Added" size={28} filled={false} tone="success" onPress={() => {}} /> : undefined}
              onPress={() => void run(async () => { await contribute(p.id, item); haptic.success(); setPodding(false); setNotice(`Added to ${p.title}.`); })} />;
          })}
        </View> : <T v="subhead" tone="secondary" center style={{ marginTop: space.xl }}>You haven’t made any pods yet.</T>}
      </ScrollView>
    </Sheet>
  </Screen>;
}

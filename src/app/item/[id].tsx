import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { categories, formatScore, scoreColor } from '../../lib/categories';
import { MusicItem, Ranking } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, RankingCard, Screen, ScoreBadge } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { SaveItemButton } from '../../ui/library';
import { haptic } from '../../ui/haptics';
import { Artwork, Badge, Button, Card, EmptyState, IconButton, ListRow, SectionHeader, Sheet, T } from '../../ui/primitives';
import { curve, font, gutter, radius, space, useTheme } from '../../ui/theme';

type ItemData = { item: MusicItem | null; average: number | null; count: number; distribution?: number[]; reviews: Ranking[]; pods: Ranking[] };

/** How everyone scored it, 0 to 10, with your own score marked on its bar. */
function ScoreChart({ distribution, mine }: { distribution: number[]; mine?: number }) {
  const { c } = useTheme();
  const peak = Math.max(1, ...distribution);
  const yours = mine === undefined ? -1 : Math.max(0, Math.min(10, Math.round(mine)));
  return <View accessible accessibilityLabel={`Ratings by score: ${distribution.map((n, i) => `${i}: ${n}`).join(', ')}`} style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 64 }}>
      {distribution.map((n, i) => <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
        {i === yours && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginBottom: 3 }} />}
        <View style={{ width: '100%', height: n ? Math.max(6, (n / peak) * 52) : 3, borderRadius: 3, backgroundColor: n ? scoreColor(i) : c.fill, opacity: n ? 1 : 0.8 }} />
      </View>)}
    </View>
    <LinearGradient colors={[scoreColor(0), scoreColor(5), scoreColor(10)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2, borderRadius: 1, marginTop: 6, opacity: 0.7 }} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
      {['0', '5', '10'].map((label) => <T key={label} v="caption" tone="tertiary">{label}</T>)}
    </View>
  </View>;
}

function linkLabel(url: string) {
  if (url.includes('spotify.com')) return 'Open in Spotify';
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

    <Card style={{ marginTop: space.lg, paddingVertical: space.lg }}>
      {!!data?.count && !!data.distribution && <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.xl, paddingBottom: space.lg, marginBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.heavy, fontSize: 44, lineHeight: 48, letterSpacing: -1.6, color: scoreColor(data.average ?? 0), fontVariant: ['tabular-nums'] }}>{formatScore(data.average ?? 0)}</Text>
            <T v="subhead" tone="secondary">/10</T>
          </View>
          <T v="caption" tone="secondary">{data.count} {data.count === 1 ? 'rating' : 'ratings'}</T>
        </View>
        <ScoreChart distribution={data.distribution} mine={mine?.score} />
      </View>}
      <View style={{ flexDirection: 'row' }}>
        {score('You', mine?.score, mine ? 'Your score' : 'Not rated')}
        {score('Friends', friendAverage, friends.length ? `${friends.length} ${friends.length === 1 ? 'rating' : 'ratings'}` : 'No ratings yet')}
        {score('Everyone', data?.average, data ? `${data.count} ${data.count === 1 ? 'rating' : 'ratings'}` : '…')}
      </View>
    </Card>

    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
      <Button label={mine ? 'Rate again' : 'Rate it'} icon="star" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/rate', params: { itemId: item.id } })} />
      <Button label="Video" icon="videocam" variant="tinted" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/video', params: { itemId: item.id } })} />
    </View>
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
      <Button label="Add to a pod" icon="albums-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => user ? setPodding(true) : router.push('/auth')} />
      {item.externalUrl && <Button label={linkLabel(item.externalUrl)} icon="open-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => void run(() => Linking.openURL(item.externalUrl!))} />}
    </View>
    {item.kind === 'album' && <Button label="Rate every track" icon="list" variant="secondary" size="md" style={{ marginTop: space.sm }} onPress={() => router.push({ pathname: '/album-rate', params: { itemId: item.id } })} />}
    {mine?.review ?<Card style={{ marginTop: space.lg }}><T v="overline" tone="secondary">Your review · {formatScore(mine.score)}</T><T v="body" style={{ marginTop: space.xs }}>“{mine.review}”</T></Card> : null}

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

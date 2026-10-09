import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { displayDate } from '../lib/dates';
import { MusicItem, Profile, Ranking, Rating, SharedArtist, TasteMatch, TasteTwins } from '../lib/types';
import { useApp } from '../store/AppContext';
import { useTask } from './forms';
import { Artwork, Avatar, BotBadge, Button, Card, IconButton, Ionicons, SectionHeader, Segmented, T } from './primitives';
import { canPreview, usePreview } from './preview';
import { chipColor, curve, font, gutter, radius, space, useTheme } from './theme';

/** Feed switcher: the native segmented control. */
export function UnderlineTabs<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (value: V) => void }) {
  return <Segmented value={value} onChange={onChange} options={options} style={{ marginBottom: space.lg }} />;
}

export function FavoriteArtists({ items = [] }: { items?: MusicItem[] }) {
  if (!items.length) return null;
  return <View><SectionHeader title="Favourite artists" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{items.map((item) => <ArtistChip key={item.id} artist={{ name: item.title, artwork: item.artwork }} />)}</View></View>;
}

/** A track attached to a post: cover, title, and a way to listen. */
export function TrackPill({ item }: { item: MusicItem }) {
  const { c } = useTheme();
  const { rememberItem, setNotice } = useApp();
  const preview = usePreview();
  const playable = canPreview(item);
  const playing = preview.item?.id === item.id && preview.playing;
  const service = item.externalUrl?.includes('spotify.com') ? 'Spotify' : 'Apple Music';
  return <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.fill, padding: space.sm, paddingRight: space.xs, borderRadius: radius.md, gap: space.sm, borderWidth: 1, borderColor: c.border, ...curve }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title} by ${item.artist}`} onPress={() => { rememberItem(item); router.push(`/item/${encodeURIComponent(item.id)}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1, minHeight: 52 }}>
      <Artwork item={item} size={52} rounded={10} />
      <View style={{ flex: 1, gap: 2 }}><T v="callout" weight="semibold" numberOfLines={1}>{item.title}</T><T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}</T></View>
    </Pressable>
    {playable ? <Pressable accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Preview'} ${item.title}`} onPress={() => preview.toggle(item)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentFill, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={playing ? 'pause' : 'play'} size={18} color={c.onAccent} style={{ marginLeft: playing ? 0 : 2 }} />
    </Pressable>
      : item.externalUrl ? <IconButton icon="open-outline" label={`Open ${item.title} in ${service}`} size={44} filled={false} tone="secondary" onPress={() => void Linking.openURL(item.externalUrl!).catch((e) => setNotice(errorMessage(e)))} /> : null}
  </View>;
}

/** Like, reply, send to a friend, and share — the Equals action row. */
export function PostActions({ ranking }: { ranking: Ranking }) {
  const { c } = useTheme();
  const { user, toggleReaction } = useApp();
  const { busy, run } = useTask();
  const liked = !!ranking.reacted;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm, marginLeft: -space.sm }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${liked ? 'Unlike' : 'Like'} post, ${ranking.reactionCount} likes`} accessibilityState={{ selected: liked, disabled: busy || !!ranking.isSample }} disabled={busy || ranking.isSample}
      onPress={() => user ? void run(() => toggleReaction(ranking.id)) : router.push('/auth')} style={[styles.action, liked && { backgroundColor: c.heartSoft }]}>
      <Ionicons name={liked ? 'heart' : 'heart-outline'} size={21} color={liked ? c.heart : c.secondary} /><T v="mono" style={{ color: liked ? c.heart : c.secondary }}>{ranking.reactionCount}</T>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${ranking.comments.length} comments`} onPress={() => router.push(`/ranking/${ranking.id}`)} style={styles.action}>
      <Ionicons name="chatbubble-outline" size={20} color={c.secondary} /><T v="mono" tone="secondary">{ranking.comments.length}</T>
    </Pressable>
    <View style={{ flex: 1 }} />
    {!ranking.isSample && <IconButton icon="paper-plane-outline" label="Send to a friend" filled={false} tone="secondary" size={44} onPress={() => user ? router.push({ pathname: '/messages', params: { postId: ranking.id } }) : router.push('/auth')} />}
    <IconButton icon="share-outline" label="Share post" filled={false} tone="secondary" size={44} onPress={() => router.push(`/share/${ranking.id}`)} />
  </View>;
}

export function PollCard({ ranking }: { ranking: Ranking }) {
  const { c } = useTheme();
  const { user, vote, allRankings } = useApp();
  const { busy, run } = useTask();
  // Person pages keep their own snapshot. Prefer the latest vote response from the shared store.
  const post = allRankings.find((p) => p.id === ranking.id) ?? ranking;
  const poll = post.poll;
  if (!poll) return null;
  const first = poll.counts && poll.total ? Math.round(100 * poll.counts[0] / poll.total) : 0;
  const leader = poll.counts ? (first >= 50 ? 0 : 1) : null;
  return <View style={{ gap: space.sm }}>
    {post.items.slice(0, 2).map((item, i) => {
      const choice = i as 0 | 1;
      const percent = poll.total ? (i === 0 ? first : 100 - first) : 0;
      const selected = poll.mine === choice;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Vote for ${item.title}${poll.counts ? `, ${percent}%` : ''}`} accessibilityState={{ selected, disabled: busy }} disabled={busy}
        onPress={() => user ? void run(() => vote(post.id, choice)) : router.push('/auth')}
        style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: selected ? c.accent : c.border, backgroundColor: c.fill, minHeight: 72, ...curve }}>
        {poll.counts && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${percent}%`, backgroundColor: leader === choice ? c.accentSoft : c.fillStrong }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.md }}>
          <Artwork item={item} size={46} rounded={10} />
          <View style={{ flex: 1 }}><T v="callout" weight="semibold" numberOfLines={2}>{item.title}</T><T v="caption" tone="secondary" numberOfLines={1}>{item.artist}</T></View>
          {selected && <Ionicons name="checkmark-circle" color={c.accent} size={20} />}
          {poll.counts && <Text style={{ fontFamily: font.bold, fontSize: 17, letterSpacing: -0.4, color: leader === choice ? c.accent : c.text, fontVariant: ['tabular-nums'] }}>{percent}%</Text>}
        </View>
      </Pressable>;
    })}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T v="mono" tone="secondary" accessibilityLiveRegion="polite" style={{ flex: 1 }}>{poll.total} {poll.total === 1 ? 'vote' : 'votes'} · {poll.mine !== null ? 'tap to change' : poll.counts ? 'your poll' : 'vote to see results'}</T>
      {poll.mine !== null && <Button label="Undo" variant="plain" size="sm" disabled={busy} onPress={() => void run(() => vote(post.id, null))} />}
    </View>
  </View>;
}

/** Text-first post: the opinion is the hero, set big in the display face. */
export function TakeCard({ ranking }: { ranking: Ranking }) {
  const { c } = useTheme();
  const { allRankings } = useApp();
  const post = allRankings.find((p) => p.id === ranking.id) ?? ranking;
  const kind = post.poll ? { label: 'Poll', color: c.violet, bg: c.violetSoft } : { label: 'Hot take', color: c.accent, bg: c.accentSoft };
  return <Card style={{ marginBottom: space.lg }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${post.author}'s profile`} onPress={() => router.push(`/person/${post.handle.slice(1)}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}>
      <Avatar name={post.author} seed={post.handle} uri={post.avatar} size={40} />
      <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><T v="headline" numberOfLines={1} style={{ flexShrink: 1 }}>{post.author}</T>{post.authorBot && <BotBadge />}</View><T v="mono" tone="secondary" numberOfLines={1}>{post.handle} · {displayDate(post.updatedAt || post.createdAt)}</T></View>
      <View style={{ backgroundColor: kind.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}><T v="caption" weight="semibold" style={{ color: kind.color }}>{kind.label}</T></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Open post" onPress={() => router.push(`/ranking/${post.id}`)} style={{ paddingTop: space.md, paddingBottom: space.lg }}>
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: post.title.length > 140 ? font.medium : font.semibold, fontSize: post.title.length > 140 ? 17 : 20, lineHeight: post.title.length > 140 ? 24 : 27, letterSpacing: -0.45, color: c.text }}>{post.title}</Text>
    </Pressable>
    {post.poll ? <PollCard ranking={post} /> : post.items[0] ? <TrackPill item={post.items[0]} /> : null}
    <PostActions ranking={post} />
  </Card>;
}

/** What someone has on repeat, shown as a speech bubble above their avatar. */
export function StatusBubble({ status }: { status?: string }) {
  const { c } = useTheme();
  if (!status) return null;
  return <View style={{ alignItems: 'center', marginBottom: space.md, maxWidth: '100%' }}>
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: c.elevated, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: c.hairline, maxWidth: '100%', ...curve }}>
      <Ionicons name="musical-notes" size={15} color={c.accent} /><T v="subhead" weight="medium" style={{ flexShrink: 1 }}>{status}</T>
    </View>
    <View style={{ width: 12, height: 12, backgroundColor: c.elevated, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.hairline, transform: [{ rotate: '45deg' }], marginTop: -7 }} />
  </View>;
}

export function ArtistChip({ artist }: { artist: SharedArtist }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: chipColor(artist.name), borderRadius: radius.pill, paddingLeft: artist.artwork ? 4 : space.md, paddingRight: space.md, paddingVertical: 4, minHeight: 32 }}>
    {artist.artwork && <Artwork item={{ id: `chip-${artist.name}`, kind: 'artist', title: artist.name, artist: '', artwork: artist.artwork }} size={24} rounded={12} />}
    <T v="caption" weight="semibold" style={{ color: c.onAccent, fontSize: 13 }}>{artist.name}</T>
  </View>;
}

export function TopArtists({ ratings }: { ratings: Rating[] }) {
  const artists = new Map<string, { name: string; count: number }>();
  for (const rating of ratings) {
    if (rating.tier === 0) continue;
    const name = rating.item.kind === 'artist' ? rating.item.title : rating.item.artist;
    const key = name.trim().toLowerCase();
    if (!key || key === 'unknown') continue;
    const prior = artists.get(key); artists.set(key, { name: prior?.name ?? name, count: (prior?.count ?? 0) + 1 });
  }
  const top = [...artists.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  if (!top.length) return null;
  return <View><SectionHeader title="On repeat" /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{top.map((artist) => <ArtistChip key={artist.name} artist={artist} />)}</View></View>;
}

/** Taste match as a brand moment: the afterglow gradient behind a big percentage. */
export function MatchCard({ handle }: { handle: string }) {
  const { c } = useTheme();
  const { user, ratings } = useApp();
  const userId = user?.id;
  const ownHandle = user?.handle;
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ key: string; data?: TasteMatch; error?: string } | null>(null);
  const key = `${userId}:${handle}:${ratings.map((r) => `${r.item.id}:${r.score}`).join(',')}:${attempt}`;
  useEffect(() => {
    if (!userId || handle === ownHandle) return;
    const controller = new AbortController();
    api<TasteMatch>(`/people/${encodeURIComponent(handle.replace(/^@/, ''))}/match`, { signal: controller.signal }).then((data) => setState({ key, data })).catch((e) => { if (!controller.signal.aborted) setState({ key, error: errorMessage(e) }); });
    return () => controller.abort();
  }, [userId, ownHandle, handle, key]);
  if (!user || handle === user.handle) return null;
  const data = state?.key === key ? state.data : undefined;
  if (!state || state.key !== key) return <Card style={{ marginTop: space.xl }}><T v="subhead" tone="secondary">Comparing your taste…</T></Card>;
  if (state.error) return <Card style={{ marginTop: space.xl, gap: space.md }}><T v="subhead" tone="secondary">{state.error}</T><Button label="Retry match" size="sm" variant="secondary" onPress={() => retry((v) => v + 1)} /></Card>;
  return <LinearGradient colors={[c.glowA, c.glowB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ marginTop: space.xl, borderRadius: radius.lg, padding: space.xl, gap: space.sm, ...curve }}>
    <T v="overline" style={{ color: '#FFFFFFCC' }}>Taste match</T>
    <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.heavy, fontSize: data?.percent === null ? 28 : 54, lineHeight: data?.percent === null ? 34 : 58, letterSpacing: -1.6, color: '#FFFFFF' }}>{data?.percent === null ? 'A match in the making' : `${data?.percent}%`}</Text>
    <T v="subhead" style={{ color: '#FFFFFFE6' }}>{data?.percent === null ? 'Rate some of the same music to compare your taste.' : `similar · based on ${data?.shared.length} shared ${data?.shared.length === 1 ? 'rating' : 'ratings'}`}</T>
    {!!data?.sharedArtists.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>{data.sharedArtists.map((artist) => <ArtistChip key={artist.name} artist={artist} />)}</View>}
  </LinearGradient>;
}

/** A record sleeve with the vinyl peeking out — for walls of favourite music. */
export function VinylSleeve({ item, size }: { item: MusicItem; size: number }) {
  const { c } = useTheme();
  const disc = size * 0.92;
  return <View style={{ width: size * 1.14, height: size }}>
    <View style={{ position: 'absolute', right: 0, top: (size - disc) / 2, width: disc, height: disc, borderRadius: disc / 2, backgroundColor: '#111016', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2733' }}>
      {[0.78, 0.6].map((r) => <View key={r} style={{ position: 'absolute', width: disc * r, height: disc * r, borderRadius: disc, borderWidth: 1, borderColor: '#24212D' }} />)}
      <View style={{ width: disc * 0.3, height: disc * 0.3, borderRadius: disc, backgroundColor: c.accentFill, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#111016' }} /></View>
    </View>
    <Artwork item={item} size={size} rounded={6} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
  </View>;
}

export function CoverWall({ items, title = 'The rotation' }: { items: MusicItem[]; title?: string }) {
  const { rememberItem } = useApp();
  const unique = [...new Map(items.map((item) => [item.id, item])).values()].slice(0, 9);
  if (!unique.length) return null;
  return <View><SectionHeader title={title} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '2%' }}>{unique.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`View ${item.title} by ${item.artist}`} onPress={() => { rememberItem(item); router.push(`/item/${encodeURIComponent(item.id)}`); }} style={{ width: '32%', marginBottom: space.sm }}><Artwork item={item} fill rounded={radius.sm} /></Pressable>)}</View>
  </View>;
}

/** Friends' latest picks: avatars with a glow ring and the cover tucked beside them. */
export function StoryRail({ people, posts }: { people: Profile[]; posts: Ranking[] }) {
  const { c } = useTheme();
  // Captured once per mount: "fresh" (a glow ring) means posted within the last day.
  const [now] = useState(() => Date.now());
  const entries = people.map((person) => ({ person, post: posts.find((p) => p.userId === person.id && p.items.length > 0) })).filter((entry) => entry.post).slice(0, 12);
  if (!entries.length) return null;
  return <View style={{ marginBottom: space.lg }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.lg }}>
      {entries.map(({ person, post }) => {
        const fresh = now - Date.parse(post!.updatedAt || post!.createdAt) < 86400000;
        return <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`See ${person.name}'s latest pick, ${post!.items[0].title}`} onPress={() => router.push(`/ranking/${post!.id}`)} style={{ width: 76, alignItems: 'center' }}>
          <LinearGradient colors={fresh ? [c.glowA, c.glowB] : [c.fillStrong, c.fillStrong]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: c.bg, overflow: 'hidden' }}><Avatar name={person.name} seed={person.handle} uri={person.avatar} size={60} /></View>
          </LinearGradient>
          <View style={{ position: 'absolute', right: 0, top: 44, borderWidth: 2, borderColor: c.bg, borderRadius: 8, transform: [{ rotate: '8deg' }] }}><Artwork item={post!.items[0]} size={28} rounded={6} /></View>
          <T v="caption" weight="semibold" numberOfLines={1} style={{ marginTop: space.sm }}>{person.name.split(/\s+/)[0]}</T>
          <T v="caption" tone="secondary" numberOfLines={1}>{post!.items[0].title}</T>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function TasteTwinsRow() {
  const { user, ratings, following, connected, refreshing } = useApp();
  const userId = user?.id;
  const { c } = useTheme();
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ key: string; data?: TasteTwins; error?: string } | null>(null);
  const key = `${userId}:${ratings.map((r) => `${r.item.id}:${r.score}`).join(',')}:${following.join(',')}:${connected}:${attempt}`;
  useEffect(() => {
    if (!userId || refreshing) return;
    const controller = new AbortController();
    api<TasteTwins>('/twins', { signal: controller.signal }).then((data) => setState({ key, data })).catch((e) => { if (!controller.signal.aborted) setState({ key, error: errorMessage(e) }); });
    return () => controller.abort();
  }, [key, userId, refreshing]);
  if (!user) return null;
  const data = state?.key === key ? state.data : undefined;
  return <><SectionHeader title="Your taste twins" />
    {!state || state.key !== key ? <ActivityIndicator color={c.secondary} /> : state.error ? <Card style={{ gap: space.md }}><T v="subhead" tone="secondary">{state.error}</T><Button label="Try again" size="sm" variant="secondary" onPress={() => retry((v) => v + 1)} /></Card>
      : data?.twins.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md }}>{data.twins.map((twin) => <Card key={twin.user.id} onPress={() => router.push(`/person/${twin.user.handle.slice(1)}`)} style={{ width: 210, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Avatar name={twin.user.name} seed={twin.user.handle} uri={twin.user.avatar} size={48} />
          <LinearGradient colors={[c.glowA, c.glowB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: font.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: -0.3 }}>{twin.percent}%</Text></LinearGradient>
        </View>
        <T v="headline" numberOfLines={1}>{twin.user.name}</T><T v="mono" tone="secondary" numberOfLines={1}>{twin.user.handle}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>{twin.sharedArtists.slice(0, 3).map((artist) => <ArtistChip key={artist.name} artist={artist} />)}</View>
      </Card>)}</ScrollView> : <Card style={{ gap: space.md }}><T v="headline">{data?.needed ? `Rate ${data.needed} more to find your people` : 'Your twin hasn’t turned up yet'}</T><T v="subhead" tone="secondary">{data?.needed ? 'Taste twins compare how you score the same music.' : 'As more people rate the music you love, matches will appear here.'}</T><Button label="Rate music" variant="tinted" size="md" inline onPress={() => router.push('/rate')} /></Card>}
  </>;
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 10, borderRadius: radius.pill },
});

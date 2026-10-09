import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ranking } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { RiffsWordmark } from '../../ui/brand';
import { RankingCard, Screen } from '../../ui/components';
import { StoryRail, UnderlineTabs } from '../../ui/equals';
import { usePages } from '../../ui/pages';
import { Avatar, Button, Card, EmptyState, IconButton, Ionicons, ListGroup, ListRow, T } from '../../ui/primitives';
import { curve, font, radius, shadow, space, useTheme } from '../../ui/theme';

/** Signed-out welcome: the afterglow gradient, one promise, one action. */
function Welcome() {
  const { c } = useTheme();
  return <LinearGradient colors={[c.glowA, c.glowB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: space.xl, paddingTop: space.xxl, marginBottom: space.xl, overflow: 'hidden', ...curve }}>
    <T v="overline" style={{ color: '#FFFFFFCC' }}>Music, out loud</T>
    <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.heavy, fontSize: 36, lineHeight: 40, letterSpacing: -1.1, color: '#FFFFFF', marginTop: space.sm }}>Your taste deserves an audience.</Text>
    <T v="body" style={{ color: '#FFFFFFE6', marginTop: space.md }}>Rate albums head-to-head, post hot takes, and find the people whose taste matches yours.</T>
    <View style={{ gap: space.sm, marginTop: space.xl }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Join Riffs" onPress={() => router.push('/auth')} style={{ minHeight: 52, borderRadius: radius.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...curve }}>
        <T v="label" style={{ color: '#D9124B' }}>Join Riffs — it’s free</T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="I already have an account" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <T v="label" style={{ color: '#FFFFFF' }}>I already have an account</T>
      </Pressable>
    </View>
  </LinearGradient>;
}

/** One line to start a take, with quick routes to a poll or a rating. */
function Composer() {
  const { c } = useTheme();
  const { user, takeDraft, startTake } = useApp();
  const hasTake = takeDraft.items.length > 0 || !!takeDraft.title.trim();
  const first = user?.name.split(/\s+/)[0];
  return <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, marginBottom: space.xl }}>
    <Avatar name={user?.name ?? 'You'} seed={user?.handle ?? 'guest'} uri={user?.avatar} size={40} />
    <Pressable accessibilityRole="button" accessibilityLabel={hasTake ? 'Continue your take' : 'Post a hot take'} onPress={() => { if (!hasTake) startTake(undefined, false); router.push('/take'); }} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
      <T v="callout" tone="secondary" numberOfLines={1}>{hasTake ? 'Continue your take…' : first ? `What’s on repeat, ${first}?` : 'What’s on repeat?'}</T>
    </Pressable>
    <IconButton icon="stats-chart" label="Start a poll" size={40} tone="secondary" onPress={() => { startTake(undefined, true); router.push('/take'); }} />
    <Pressable accessibilityRole="button" accessibilityLabel="Rate music" onPress={() => router.push('/rate')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentFill, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="star" size={18} color={c.onAccent} />
    </Pressable>
  </Card>;
}

export default function HomeScreen() {
  const { c } = useTheme();
  const { allRankings, draft, following, people, user, refresh, refreshing, unread, connected } = useApp();
  const [tab, setTab] = useState<'you' | 'following'>('you');
  const visible = allRankings.filter((post) => post.visibility !== 'private');
  const pages = usePages<Ranking>(`/feed?mode=${tab}`, 'posts', tab !== 'following' || !!user);
  const feed = pages.rows.map((post) => allRankings.find((cached) => cached.id === post.id) || post);
  const circle = people.filter((person) => following.includes(person.handle));
  const hasDraft = draft.items.length > 0 || !!draft.title.trim();

  return <Screen tab onRefresh={() => { pages.reload(); void refresh(); }} refreshing={refreshing || pages.loading} onEndReached={() => { if (pages.hasMore && !pages.busy && !pages.error) void pages.loadMore(); }}
    left={<RiffsWordmark width={76} />}
    right={user ? <IconButton icon="notifications-outline" label={unread ? `Activity, ${unread} unread` : 'Activity'} badge={unread > 0} onPress={() => router.push('/notifications')} />
      : <Button label="Sign in" size="sm" variant="secondary" inline onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} />}>
    <View style={{ height: space.sm }} />
    {!user && <Welcome />}
    {user && <StoryRail people={circle} posts={visible} />}
    {user && <Composer />}
    {user && !user.onboardingComplete && <Pressable accessibilityRole="button" accessibilityLabel="Set up your music profile" onPress={() => router.push('/onboarding')}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface, marginBottom: space.xl, ...curve }, shadow(c, 1)]}>
      <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: '#AF52DE', alignItems: 'center', justifyContent: 'center', ...curve }}><Ionicons name="sparkles" size={19} color="#FFFFFF" /></View>
      <View style={{ flex: 1, gap: 2 }}><T v="headline">Make Riffs sound like you</T><T v="footnote" tone="secondary">Pick your artists and rate three favourites — two minutes.</T></View>
      <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
    </Pressable>}
    <UnderlineTabs value={tab} onChange={setTab} options={[{ value: 'you', label: 'For you' }, { value: 'following', label: 'Following' }]} />
    {hasDraft && <ListGroup style={{ marginTop: 0, marginBottom: space.lg }}><ListRow icon="create-outline" title={draft.title.trim() || 'Untitled ranking'} subtitle={`Draft · ${draft.items.length} picks on this device`} onPress={() => router.push('/builder')} /></ListGroup>}
    {!connected && !refreshing && <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg, alignItems: 'center' }}><Ionicons name="cloud-offline-outline" size={18} color={c.secondary} /><T v="footnote" tone="secondary" style={{ flex: 1 }}>You’re offline. Pull to refresh when you’re connected.</T></View>}
    {tab === 'following' && !user ? <Card><EmptyState icon="people-outline" title="Find your circle" text="Sign in and follow people to see their latest music opinions here." action={<Button label="Sign in" inline onPress={() => router.push('/auth')} />} /></Card>
      : feed.length ? feed.map((post) => <RankingCard key={post.id} ranking={post} />)
        : !pages.loading && !pages.error && <Card><EmptyState icon="musical-notes" title={tab === 'following' ? 'Your circle is quiet' : 'Start the conversation'} text={tab === 'following' ? 'Follow people in Discover to bring their music into your feed.' : 'Be the first to share a take, rate an album, or build a pod.'}
          action={<Button label={tab === 'following' ? 'Find people' : 'Post a take'} inline onPress={() => router.push(tab === 'following' ? '/(tabs)/discover' : '/take')} />} /></Card>}
    {!!pages.error && <Card style={{ gap: space.md }}><T>{pages.error}</T><Button label="Try again" variant="secondary" onPress={pages.reload} /></Card>}
    {pages.loading && !pages.rows.length && <ActivityIndicator color={c.accent} style={{ marginTop: space.xl }} />}
    {pages.hasMore && <Button label="More posts" variant="secondary" loading={pages.busy} onPress={() => void pages.loadMore()} />}
  </Screen>;
}

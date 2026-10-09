import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { activeKinds, categories, tiers } from '../../lib/categories';
import { useApp } from '../../store/AppContext';
import { RankingCard, Screen, ScoreBadge, TopFive } from '../../ui/components';
import { CoverWall, FavoriteArtists, StatusBubble, TopArtists } from '../../ui/equals';
import { InviteCard } from '../../ui/invite';
import { Artwork, Avatar, Button, Card, Chips, EmptyState, IconButton, ListGroup, ListRow, Segmented, T } from '../../ui/primitives';
import { space, tints, useTheme } from '../../ui/theme';

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 1 }} accessible accessibilityLabel={`${value} ${label}`}>
    <T v="title3" tabular>{value}</T><T v="caption" tone="secondary">{label}</T>
  </Pressable>;
}

export default function ProfileScreen() {
  const { c } = useTheme();
  const { rankings, draft, moodDraft, takeDraft, archivedDrafts, archivedTakes, archivedMoods, openDraft, openTakeDraft, openMoodDraft, user, refresh, refreshing, unread, ratings, rememberItem } = useApp();
  const [tab, setTab] = useState<'posts' | 'ratings' | 'drafts'>('posts');
  const rated = activeKinds.filter((kind) => ratings.some((r) => r.category === kind));
  const [chosenKind, setKind] = useState(rated[0] ?? 'song');
  const kind = rated.includes(chosenKind) ? chosenKind : rated[0] ?? 'song';
  const posts = rankings.filter((p) => p.kind !== 'review');
  const hasDraft = draft.items.length > 0 || !!draft.title.trim();
  const hasMood = !!(moodDraft.title || moodDraft.tiles.length || moodDraft.items.length);
  const hasTake = !!(takeDraft.title || takeDraft.items.length);
  const draftCount = (hasDraft ? 1 : 0) + (hasMood ? 1 : 0) + (hasTake ? 1 : 0) + archivedDrafts.length + archivedTakes.length + archivedMoods.length;

  if (!user) return <Screen tab title="Profile" large right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}>
    <Card><EmptyState icon="person-circle-outline" title="Your taste, on record" text="Create an account to rate and review music, build your top fives, follow friends, and film video reviews."
      action={<View style={{ gap: space.sm, alignSelf: 'stretch' }}><Button label="Create account" onPress={() => router.push('/auth')} /><Button label="Sign in" variant="plain" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} /></View>} /></Card>
    {hasDraft && <ListGroup header="On this device"><ListRow icon="create-outline" title={draft.title.trim() || 'Untitled ranking'} subtitle="Draft" onPress={() => router.push('/builder')} /></ListGroup>}
  </Screen>;

  return <Screen tab title={user.name} fadeTitle onRefresh={() => void refresh()} refreshing={refreshing}
    left={<IconButton icon="notifications-outline" label="Activity" badge={unread > 0} onPress={() => router.push('/notifications')} />}
    right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}>
    <View style={{ alignItems: 'center', paddingTop: space.sm }}>
      <StatusBubble status={user.status} />
      <Avatar name={user.name} seed={user.handle} uri={user.avatar} size={92} />
      <T v="title1" center style={{ marginTop: space.md }}>{user.name}</T>
      <T v="subhead" tone="secondary">{user.handle}</T>
      {!!user.bio && <T v="body" center style={{ marginTop: space.sm, maxWidth: 360 }}>{user.bio}</T>}
    </View>
    <Card style={{ flexDirection: 'row', marginTop: space.xl, paddingVertical: space.md }}>
      <Stat value={ratings.length} label="Ratings" />
      <View style={{ width: 1, backgroundColor: c.separator }} />
      <Stat value={posts.length} label="Posts" />
      <View style={{ width: 1, backgroundColor: c.separator }} />
      <Stat value={user.followers ?? 0} label="Followers" onPress={() => router.push({ pathname: '/connections/[handle]', params: { handle: user.handle.slice(1), kind: 'followers' } })} />
      <View style={{ width: 1, backgroundColor: c.separator }} />
      <Stat value={user.following ?? 0} label="Following" onPress={() => router.push({ pathname: '/connections/[handle]', params: { handle: user.handle.slice(1), kind: 'following' } })} />
    </Card>
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
      <Button label="Edit profile" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/settings')} />
      <Button label="Rate music" variant="tinted" size="md" icon="star" style={{ flex: 1 }} onPress={() => router.push('/rate')} />
    </View>

    {(user.following ?? 0) < 10 && <InviteCard />}
    <ListGroup><ListRow icon="bookmark" iconColor={tints.amber} title="Listen later & saved posts" onPress={() => router.push('/library')} /><ListRow icon="disc" iconColor={tints.violet} title="Listening clubs" onPress={() => router.push('/clubs')} /></ListGroup>
    <FavoriteArtists items={user.favoriteArtists} />
    <TopArtists ratings={ratings} />
    <CoverWall items={[...ratings.filter((r) => r.tier === 2).sort((a, b) => b.score - a.score).map((r) => r.item), ...rankings.flatMap((post) => post.items)]} />
    {rated.length > 0 && rated.map((k) => <TopFive key={k} kind={k} ratings={ratings} onShare={() => router.push({ pathname: '/share/top', params: { category: k } })} />)}

    <Segmented value={tab} onChange={setTab} style={{ marginTop: space.xxl, marginBottom: space.lg }}
      options={[{ value: 'posts', label: 'Posts' }, { value: 'ratings', label: `Ratings${ratings.length ? ` · ${ratings.length}` : ''}` }, { value: 'drafts', label: `Drafts${draftCount ? ` · ${draftCount}` : ''}` }]} />

    {tab === 'posts' ? (rankings.length ? rankings.map((ranking) => <RankingCard ranking={ranking} key={ranking.id} />)
      : <Card><EmptyState icon="star-outline" title="Your shelf starts here" text="Rate an album you love, or rank five songs. Even private posts belong to you."
        action={<Button label="Rate your first thing" inline onPress={() => router.push('/rate')} />} /></Card>)
      : tab === 'ratings' ? (rated.length ? <>
        {rated.length > 1 && <Chips value={kind} onChange={setKind} options={rated.map((k) => ({ value: k, label: categories[k].plural, icon: categories[k].icon }))} style={{ marginBottom: space.md }} />}
        {tiers.map((t) => {
          const list = ratings.filter((r) => r.category === kind && r.tier === t.value).sort((a, b) => a.position - b.position);
          return list.length ? <View key={t.value} style={{ marginBottom: space.lg }}>
            <T v="overline" tone="secondary" style={{ marginBottom: space.sm, marginLeft: 4 }}>{t.label} · {list.length}</T>
            <Card padded={false}>{list.map((r, i) => <Pressable key={r.item.id} accessibilityRole="button" accessibilityLabel={`${r.item.title}, ${r.score}`}
              onPress={() => { rememberItem(r.item); router.push(`/item/${encodeURIComponent(r.item.id)}`); }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }, i > 0 && { borderTopWidth: 0.5, borderColor: c.hairline }, pressed && { backgroundColor: c.fill }]}>
              <Artwork item={r.item} size={44} />
              <View style={{ flex: 1 }}><T v="callout" weight="semibold" numberOfLines={1}>{r.item.title}</T><T v="footnote" tone="secondary" numberOfLines={1}>{r.review ? `“${r.review}”` : r.item.artist}</T></View>
              <ScoreBadge score={r.score} size={36} />
            </Pressable>)}</Card>
          </View> : null;
        })}
      </> : <Card><EmptyState icon="star-outline" title="No ratings yet" text="Rate a song, album, or artist. A few head-to-heads turn your gut feeling into a score."
        action={<Button label="Rate something" inline onPress={() => router.push('/rate')} />} /></Card>)
      : draftCount ? <ListGroup style={{ marginTop: 0 }} footer="Drafts save automatically on this device and aren’t visible to anyone else.">
        {archivedTakes.map((entry) => <ListRow key={entry.id} icon="chatbubble-outline" title={entry.draft.title.trim() || 'Untitled take'} subtitle={entry.draft.poll ? 'Saved poll draft' : 'Saved take draft'} onPress={() => { openTakeDraft(entry.id); router.push('/take'); }} />)}
        {archivedMoods.map((entry) => <ListRow key={entry.id} icon="images-outline" title={entry.draft.title.trim() || 'Untitled mood board'} subtitle="Saved mood board draft" onPress={() => { openMoodDraft(entry.id); router.push('/moodboard'); }} />)}
        {hasTake && <ListRow icon="chatbubble-outline" title={takeDraft.title.trim() || 'Untitled take'} subtitle={takeDraft.poll ? 'Poll draft' : 'Take draft'} onPress={() => router.push('/take')} />}
        {hasDraft && <ListRow icon="create-outline" title={draft.title.trim() || 'Untitled ranking'} subtitle={`Current draft · ${draft.items.length} picks`} onPress={() => router.push('/builder')} />}
        {hasMood && <ListRow icon="images-outline" iconColor="#AF52DE" title={moodDraft.title.trim() || 'Untitled mood board'} subtitle="Mood board draft" onPress={() => router.push('/moodboard')} />}
        {archivedDrafts.map((entry) => <ListRow key={entry.id} icon="document-text-outline" iconColor="#8E8E93" title={entry.draft.title.trim() || 'Untitled ranking'} subtitle={`${entry.draft.items.length} picks`} onPress={() => { openDraft(entry.id); router.push('/builder'); }} />)}
      </ListGroup> : <Card><EmptyState icon="document-text-outline" title="No drafts" text="Anything you start but don’t publish is kept here." /></Card>}
  </Screen>;
}

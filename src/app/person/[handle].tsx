import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { activeKinds } from '../../lib/categories';
import { Profile, Ranking, Rating } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, RankingCard, Screen, TopFive } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { CoverWall, FavoriteArtists, MatchCard, StatusBubble, TopArtists } from '../../ui/equals';
import { haptic } from '../../ui/haptics';
import { Avatar, Button, Card, Dialog, EmptyState, ListGroup, ListRow, SectionHeader, T, BotBadge } from '../../ui/primitives';
import { space } from '../../ui/theme';

export default function Person() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { user, following, toggleFollow, blockUser } = useApp();
  const key = `${handle}:${user?.id ?? 'guest'}`;
  const [snapshot, setSnapshot] = useState<{ key: string; data: { user: Profile; posts: Ranking[]; ratings: Rating[] } } | null>(null), [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const data = snapshot?.key === key ? snapshot.data : null;
  const error = failure?.key === key ? failure.message : '';
  const [blocking, setBlocking] = useState(false);
  const { busy, run } = useTask();
  useEffect(() => { let active = true; api<{ user: Profile; posts: Ranking[]; ratings: Rating[] }>(`/people/${encodeURIComponent(handle)}`).then((v) => { if (active) { setSnapshot({ key, data: v }); setFailure(null); } }).catch((e) => { if (active) setFailure({ key, message: errorMessage(e) }); }); return () => { active = false; }; }, [handle, following, key]);

  if (error) return <Screen back title="Profile"><Card style={{ marginTop: space.xl }}><EmptyState icon="person-outline" title="Profile unavailable" text={error} /></Card></Screen>;
  if (!data) return <Screen back title="Profile"><Loading label="Loading profile…" /></Screen>;
  const person = data.user;
  const followed = following.includes(person.handle);
  const me = user?.id === person.id;

  return <Screen back title={person.name} fadeTitle>
    <View style={{ alignItems: 'center', paddingTop: space.sm }}>
      <StatusBubble status={person.status} />
      <Avatar name={person.name} seed={person.handle} uri={person.avatar} size={92} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}><T v="title1" center>{person.name}</T>{person.bot && <BotBadge />}</View>
      {person.bot && <T v="footnote" tone="secondary" center style={{ marginTop: space.xs, maxWidth: 320 }}>A Riffs house bot. It posts real music and never reads your messages. You can hide bots in Settings → Messages, alerts & email.</T>}
      <T v="subhead" tone="secondary">{person.handle}</T>
      {!!person.bio && <T v="body" center style={{ marginTop: space.sm, maxWidth: 360 }}>{person.bio}</T>}
      <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.lg }}>
        {[[data.posts.length, 'Posts'], [person.followers ?? 0, 'Followers'], [person.following ?? 0, 'Following']].map(([value, label]) =>
          <Pressable key={label} disabled={label === 'Posts'} accessibilityRole={label === 'Posts' ? undefined : 'button'} accessibilityLabel={`${value} ${label}`} onPress={() => router.push({ pathname: '/connections/[handle]', params: { handle: person.handle.slice(1), kind: String(label).toLowerCase() } })} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 48 }}><T v="headline" tabular>{value}</T><T v="caption" tone="secondary">{label}</T></Pressable>)}
      </View>
    </View>
    {!me && <Button label={followed ? 'Following' : 'Follow'} icon={followed ? 'checkmark' : 'add'} variant={followed ? 'secondary' : 'primary'} loading={busy} style={{ marginTop: space.xl }}
      onPress={() => user ? void run(async () => { await toggleFollow(person.handle); haptic.success(); }) : router.push('/auth')} />}
    {!me && user && <Button label="Message" icon="chatbubble-outline" variant="secondary" loading={busy} style={{ marginTop: space.md }} onPress={() => void run(async () => { const result = await api<{ conversation: { id: string } }>('/conversations', { method: 'POST', body: { handles: [person.handle] } }); router.push(`/messages/${result.conversation.id}`); })} />}
    <MatchCard handle={person.handle} />
    <FavoriteArtists items={person.favoriteArtists} />
    <TopArtists ratings={data.ratings ?? []} />
    <CoverWall items={[...(data.ratings ?? []).filter((r) => r.tier === 2).sort((a, b) => b.score - a.score).map((r) => r.item), ...data.posts.flatMap((post) => post.items)]} />
    {activeKinds.map((kind) => <TopFive key={kind} kind={kind} ratings={data.ratings ?? []} onShare={() => router.push({ pathname: '/share/top', params: { category: kind, handle: person.handle.slice(1) } })} />)}

    <SectionHeader title="Posts" detail={data.posts.length ? `${data.posts.length}` : undefined} />
    {data.posts.length ? data.posts.map((p) => <RankingCard key={p.id} ranking={p} />)
      : <Card><EmptyState icon="list" title="Nothing to see yet" text={`${person.name} hasn’t posted anything you can view.`} /></Card>}

    {!me && user && <ListGroup footer="Blocking stops you following each other and hides each other’s posts and comments. You can unblock in Settings.">
      <ListRow title={`Block ${person.name}`} destructive chevron={false} onPress={() => setBlocking(true)} />
    </ListGroup>}
    <Dialog visible={blocking} title={`Block ${person.name}?`} description="You’ll stop following each other and won’t see each other’s posts or comments. You can unblock them in Settings." confirmLabel="Block" destructive busy={busy}
      onCancel={() => setBlocking(false)} onConfirm={() => void run(async () => { await blockUser(person.handle); setBlocking(false); router.replace('/(tabs)/discover'); })} />
  </Screen>;
}

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { Profile, Ranking } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, RankingCard, Screen } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { haptic } from '../../ui/haptics';
import { Avatar, Button, Card, Dialog, EmptyState, ListGroup, ListRow, SectionHeader, T } from '../../ui/primitives';
import { space } from '../../ui/theme';

export default function Person() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { user, following, toggleFollow, blockUser } = useApp();
  const [data, setData] = useState<{ user: Profile; posts: Ranking[] } | null>(null), [error, setError] = useState('');
  const [blocking, setBlocking] = useState(false);
  const { busy, run } = useTask();
  useEffect(() => { let active = true; api<{ user: Profile; posts: Ranking[] }>(`/people/${encodeURIComponent(handle)}`).then((v) => { if (active) setData(v); }).catch((e) => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, [handle, following]);

  if (error) return <Screen back title="Profile"><Card style={{ marginTop: space.xl }}><EmptyState icon="person-outline" title="Profile unavailable" text={error} /></Card></Screen>;
  if (!data) return <Screen back title="Profile"><Loading label="Loading profile…" /></Screen>;
  const person = data.user;
  const followed = following.includes(person.handle);
  const me = user?.id === person.id;

  return <Screen back title={person.name} fadeTitle>
    <View style={{ alignItems: 'center', paddingTop: space.sm }}>
      <Avatar name={person.name} seed={person.handle} size={92} />
      <T v="title1" center style={{ marginTop: space.md }}>{person.name}</T>
      <T v="subhead" tone="secondary">{person.handle}</T>
      {!!person.bio && <T v="body" center style={{ marginTop: space.sm, maxWidth: 360 }}>{person.bio}</T>}
      <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.lg }}>
        {[[data.posts.length, 'Posts'], [person.followers ?? 0, 'Followers'], [person.following ?? 0, 'Following']].map(([value, label]) =>
          <View key={label} style={{ alignItems: 'center' }}><T v="headline" tabular>{value}</T><T v="caption" tone="secondary">{label}</T></View>)}
      </View>
    </View>
    {!me && <Button label={followed ? 'Following' : 'Follow'} icon={followed ? 'checkmark' : 'add'} variant={followed ? 'secondary' : 'primary'} loading={busy} style={{ marginTop: space.xl }}
      onPress={() => user ? void run(async () => { await toggleFollow(person.handle); haptic.success(); }) : router.push('/auth')} />}

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

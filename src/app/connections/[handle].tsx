import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Profile } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, Screen } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { Avatar, Button, Card, EmptyState, Segmented, T } from '../../ui/primitives';
import { useRemote } from '../../ui/remote';
import { space } from '../../ui/theme';

export default function Connections() {
  const { handle, kind: initial } = useLocalSearchParams<{ handle: string; kind?: string }>();
  const [kind, setKind] = useState<'followers' | 'following'>(initial === 'following' ? 'following' : 'followers');
  const [offset, setOffset] = useState(0);
  const { user, following, toggleFollow } = useApp(), { busy, run } = useTask();
  const { data, error, loading, reload } = useRemote<{ people: Profile[]; nextOffset: number | null }>(`/people/${encodeURIComponent(handle)}/${kind}?offset=${offset}`);
  return <Screen back title={`@${handle}`} onRefresh={reload} refreshing={loading}>
    <Segmented value={kind} options={[{ value: 'followers', label: 'Followers' }, { value: 'following', label: 'Following' }]} onChange={(next) => { setKind(next); setOffset(0); }} style={{ marginBottom: space.lg }} />
    {error ? <Card><T tone="secondary">{error}</T><Button label="Try again" onPress={reload} /></Card> : !data ? <Loading label="Loading people…" />
      : !data.people.length ? <Card><EmptyState icon="people-outline" title="No one here yet" text={kind === 'followers' ? 'Followers will appear here.' : 'People this listener follows will appear here.'} /></Card>
        : <View style={{ gap: space.lg }}>{data.people.map((person) => <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.name}'s profile`} onPress={() => router.push(`/person/${person.handle.slice(1)}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
            <Avatar name={person.name} seed={person.handle} uri={person.avatar} size={44} /><View style={{ flex: 1 }}><T v="headline" numberOfLines={1}>{person.name}</T><T v="caption" tone="secondary">{person.handle}</T></View>
          </Pressable>
          {person.id !== user?.id && <Button label={following.includes(person.handle) ? 'Following' : 'Follow'} variant="secondary" size="sm" disabled={busy} onPress={() => user ? void run(async () => { await toggleFollow(person.handle); reload(); }) : router.push('/auth')} />}
        </View>)}</View>}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl }}>
      {offset > 0 && <Button label="Previous" variant="plain" size="md" disabled={loading} onPress={() => setOffset(Math.max(0, offset - 30))} />}
      {data?.nextOffset != null && <Button label="More people" variant="secondary" size="md" disabled={loading} onPress={() => setOffset(data.nextOffset!)} />}
    </View>
  </Screen>;
}

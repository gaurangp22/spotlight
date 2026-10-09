import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ListeningClub } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, Screen } from '../../ui/components';
import { Avatar, Button, Card, EmptyState, Segmented, T } from '../../ui/primitives';
import { useRemote } from '../../ui/remote';
import { space, useTheme } from '../../ui/theme';

export default function Clubs() {
  const { user } = useApp(), { c } = useTheme();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const { data, error, loading, reload } = useRemote<{ clubs: ListeningClub[] }>('/clubs');
  const clubs = (data?.clubs || []).filter((club) => tab === 'all' || club.joined);
  return <Screen back title="Listening clubs" large onRefresh={reload} refreshing={loading} right={<Button label="New club" size="sm" variant="tinted" inline onPress={() => router.push(user ? '/clubs/new' : '/auth')} />}>
    <T v="body" tone="secondary" style={{ marginBottom: space.xl }}>One album a week. A few people to hear it with. Listen in your own music app, then bring your opinion here.</T>
    <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'Discover clubs' }, { value: 'mine', label: 'My clubs' }]} style={{ marginBottom: space.xl }} />
    {error ? <Card><T tone="secondary">{error}</T><Button label="Try again" onPress={reload} /></Card> : !data ? <Loading label="Loading clubs…" /> : clubs.length ? clubs.map((club) => <Pressable key={club.id} accessibilityRole="button" accessibilityLabel={`Open ${club.name}`} onPress={() => router.push(`/clubs/${club.id}`)} style={{ borderBottomWidth: 1, borderColor: c.separator, paddingVertical: space.xl, gap: space.sm }}>
      <T v="title2">{club.name}</T><T v="subhead" tone="secondary">{club.description || 'A weekly album and a conversation worth having.'}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Avatar name={club.owner} seed={club.handle} uri={club.avatar} size={32} /><T v="caption" tone="secondary" style={{ flex: 1 }}>{club.owner} · {club.members} {club.members === 1 ? 'member' : 'members'}</T>{club.joined && <T v="caption" tone="accent">Joined</T>}</View>
    </Pressable>) : <Card><EmptyState icon="disc-outline" title={tab === 'mine' ? 'Find your listening circle' : 'Start a listening tradition'} text={tab === 'mine' ? 'Join a club to keep up with its weekly album picks.' : 'Create a club and choose the first album. Clubs and discussions are public.'} action={<Button label={tab === 'mine' ? 'Discover clubs' : 'Create a club'} onPress={() => tab === 'mine' ? setTab('all') : router.push(user ? '/clubs/new' : '/auth')} />} /></Card>}
  </Screen>;
}

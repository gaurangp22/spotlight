import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../../lib/api';
import { ListeningClub, Ranking } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Loading, Screen } from '../../ui/components';
import { TrackPill } from '../../ui/equals';
import { useTask } from '../../ui/forms';
import { MusicPicker } from '../../ui/MusicPicker';
import { Button, Card, Dialog, ListGroup, ListRow, SectionHeader, T } from '../../ui/primitives';
import { useRemote } from '../../ui/remote';
import { space } from '../../ui/theme';

type ClubData = { club: ListeningClub; weeks: { week: string; post: Ranking }[]; currentWeek: string };
export default function Club() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, spotifyConnected, rememberItem } = useApp(), { busy, run } = useTask();
  const { data, error, loading, reload } = useRemote<ClubData>(`/clubs/${id}`);
  const [picking, setPicking] = useState(false), [deleting, setDeleting] = useState(false);
  if (error) return <Screen back title="Listening club"><Card><T tone="secondary">{error}</T><Button label="Try again" onPress={reload} /></Card></Screen>;
  if (!data) return <Screen back title="Listening club"><Loading label="Loading club…" /></Screen>;
  const { club, weeks, currentWeek } = data, owned = user?.id === club.ownerId;
  const current = weeks.find((entry) => entry.week === currentWeek), item = current?.post.items[0];
  return <Screen back title={club.name} onRefresh={reload} refreshing={loading}>
    <T v="largeTitle">{club.name}</T><T v="body" tone="secondary" style={{ marginTop: space.md }}>{club.description}</T>
    <T v="caption" tone="secondary" style={{ marginTop: space.md }}>{club.members} {club.members === 1 ? 'member' : 'members'} · Hosted by {club.owner} · Public</T>
    {!owned && <Button label={club.joined ? 'Leave club' : 'Join club'} variant={club.joined ? 'secondary' : 'primary'} disabled={busy} style={{ marginTop: space.xl }} onPress={() => user ? void run(async () => { await api(`/clubs/${id}/join`, { method: club.joined ? 'DELETE' : 'PUT' }); reload(); }) : router.push('/auth')} />}
    <SectionHeader title="This week’s album" />
    {current && item ? <View style={{ gap: space.md }}>
      <TrackPill item={item} /><T v="caption" tone="secondary">Week of {current.week} · Listen in your own music app, then discuss here.</T>
      <Button label="Join the discussion" icon="chatbubbles-outline" onPress={() => router.push(`/ranking/${current.post.id}`)} />
      <Button label="Rate this album" icon="star-outline" variant="secondary" onPress={() => { rememberItem(item); router.push({ pathname: '/rate', params: { itemId: item.id } }); }} />
    </View> : <Card style={{ gap: space.md }}><T v="headline">A new week, an open slot.</T><T v="subhead" tone="secondary">{owned ? 'Choose the album everyone will explore this week.' : 'The host hasn’t chosen this week’s album yet. Previous discussions are below.'}</T>{owned && <Button label="Choose this week’s album" onPress={() => setPicking(true)} disabled={busy} />}</Card>}
    {weeks.some((entry) => entry.week !== currentWeek) && <ListGroup header="Previous weeks">{weeks.filter((entry) => entry.week !== currentWeek).map((entry) => <ListRow key={entry.week} title={entry.post.items[0]?.title || 'Album discussion'} subtitle={`Week of ${entry.week}`} onPress={() => router.push(`/ranking/${entry.post.id}`)} />)}</ListGroup>}
    {owned && <ListGroup footer="Deleting a club removes its weekly discussions and comments."><ListRow title="Delete club" destructive onPress={() => setDeleting(true)} /></ListGroup>}
    <MusicPicker visible={picking} onClose={() => setPicking(false)} kinds={['album']} spotifyConnected={spotifyConnected} title="Choose one album for this week" onPick={(album) => void run(async () => { await api(`/clubs/${id}/weeks`, { method: 'POST', body: { item: album } }); setPicking(false); reload(); })} />
    <Dialog visible={deleting} title="Delete this club?" description="This permanently removes the club and all of its weekly conversations." confirmLabel="Delete club" destructive busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => void run(async () => { await api(`/clubs/${id}`, { method: 'DELETE' }); router.replace('/clubs'); })} />
  </Screen>;
}

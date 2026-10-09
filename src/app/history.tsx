import { router } from 'expo-router';
import { useState } from 'react';
import { api } from '../lib/api';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MusicRow, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { MusicPicker } from '../ui/MusicPicker';
import { usePages } from '../ui/pages';
import { Button, Card, Dialog, EmptyState, T } from '../ui/primitives';
import { space } from '../ui/theme';

type Play = { id?: string; item: MusicItem; playedAt: string };
export default function History() {
  const { user, rememberItem } = useApp(); const pages = usePages<Play>('/history', 'plays', !!user); const { busy, run } = useTask();
  const [picking, setPicking] = useState(false), [clearing, setClearing] = useState(false);
  return <Screen back title="Listening diary" large onRefresh={pages.reload} refreshing={pages.loading} onEndReached={() => { if (pages.hasMore && !pages.error) void pages.loadMore(); }}>
    <T v="subhead" tone="secondary" style={{ marginBottom: space.lg }}>A private record of music you choose to log. Riffs doesn’t track playback in another app.</T>
    {!user ? <Button label="Sign in" onPress={() => router.push('/auth')} /> : <>
      <Button label="Log a listen" icon="add" onPress={() => setPicking(true)} style={{ marginBottom: space.lg }} />
      {!!pages.error && <Card><T>{pages.error}</T><Button label="Try again" onPress={pages.reload} /></Card>}
      {!pages.loading && !pages.rows.length && !pages.error && <Card><EmptyState icon="headset-outline" title="What did you listen to?" text="Log a song or album to start your diary. Your diary also helps tune For You." /></Card>}
      {pages.rows.map((play, i) => <Card key={`${play.item.id}:${play.playedAt}:${i}`} padded={false} style={{ paddingHorizontal: space.md, marginBottom: space.md }}><MusicRow item={play.item} onPress={() => { rememberItem(play.item); router.push(`/item/${encodeURIComponent(play.item.id)}`); }} /><T v="caption" tone="secondary" style={{ marginBottom: space.md }}>Logged {new Date(play.playedAt).toLocaleString()}</T></Card>)}
      {pages.hasMore && <Button label="Earlier listens" variant="secondary" loading={pages.busy} onPress={() => void pages.loadMore()} />}
      {!!pages.rows.length && <Button label="Clear diary" variant="plain" onPress={() => setClearing(true)} />}
      <MusicPicker spotifyConnected={false} visible={picking} onClose={() => setPicking(false)} onPick={(item) => void run(async () => { await api('/history', { method: 'POST', body: { item } }); setPicking(false); pages.reload(); })} />
      <Dialog visible={clearing} title="Clear your listening diary?" description="This removes all your logged listens. Ratings and saved music remain." confirmLabel="Clear diary" destructive busy={busy} onCancel={() => setClearing(false)} onConfirm={() => void run(async () => { await api('/history', { method: 'DELETE' }); setClearing(false); pages.reload(); })} />
    </>}
  </Screen>;
}

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { activeKinds } from '../lib/categories';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { TrackPill } from '../ui/equals';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker } from '../ui/MusicPicker';
import { Button, Card, IconButton, Segmented, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

export default function TakeComposer() {
  const { takeDraft: draft, setTakeDraft, publishTake, user, spotifyConnected, allRankings } = useApp();
  const { busy, run } = useTask();
  const [picking, setPicking] = useState(false);
  const original = allRankings.find((post) => post.id === draft.editingId);
  const locked = !!original?.poll?.total;
  const valid = !!draft.title.trim() && (!draft.poll || draft.items.length === 2);
  const toggle = (item: MusicItem) => setTakeDraft((v) => ({ ...v, items: v.items.some((entry) => entry.id === item.id) ? v.items.filter((entry) => entry.id !== item.id) : [...v.items, item].slice(0, v.poll ? 2 : 1) }));
  return <Screen back title={draft.editingId ? 'Edit post' : 'Start a conversation'} footer={<View style={{ gap: space.sm }}>
    {!valid && <T v="footnote" tone="secondary" center>{!draft.title.trim() ? 'Write your take or poll question.' : 'Choose two different picks for your poll.'}</T>}
    <Button label={!user ? 'Sign in to publish' : draft.editingId ? 'Save changes' : draft.poll ? 'Publish poll' : 'Post take'} loading={busy} disabled={!!user && !valid} onPress={() => !user ? router.push('/auth') : void run(async () => { const post = await publishTake(); haptic.success(); router.replace(`/ranking/${post.id}`); })} />
  </View>}>
    <Segmented value={draft.poll ? 'poll' : 'take'} options={[{ value: 'take', label: 'Hot take', icon: 'chatbubble' }, { value: 'poll', label: 'This or that', icon: 'stats-chart' }]}
      onChange={(mode) => { if (!locked) setTakeDraft((v) => ({ ...v, poll: mode === 'poll', items: v.items.slice(0, mode === 'poll' ? 2 : 1) })); }} />
    <TextField label={draft.poll ? 'Your question' : 'Your take'} placeholder={draft.poll ? 'Which one are you keeping?' : 'What’s the music opinion you’ll stand by?'} value={draft.title} onChangeText={(title) => setTakeDraft((v) => ({ ...v, title }))} multiline maxLength={280} hint={`${draft.title.length}/280 · Draft saves on this device`} style={{ minHeight: 130 }} />
    <View style={{ gap: space.md, marginTop: space.sm, marginBottom: space.xxl }}>
      {draft.items.map((item) => <View key={item.id} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}><View style={{ flex: 1 }}><TrackPill item={item} /></View>{!locked && <IconButton icon="close" label={`Remove ${item.title}`} size={44} onPress={() => toggle(item)} />}</View>)}
      {locked ? <Card><T v="footnote" tone="secondary">The picks are locked because people have voted. You can still edit the question and visibility.</T></Card> : draft.items.length < (draft.poll ? 2 : 1) ? <Button label={draft.poll ? `Choose pick ${draft.items.length + 1}` : 'Attach music · optional'} icon="add" variant="secondary" onPress={() => setPicking(true)} /> : null}
      <T v="subhead" tone="secondary">{draft.poll ? 'Two picks. One vote. Results appear after voting.' : 'An opinion is enough. Add a song, album, or artist if it helps make your point.'}</T>
    </View>
    <Visibility value={draft.visibility} onChange={(visibility) => setTakeDraft((v) => ({ ...v, visibility }))} />
    <MusicPicker visible={picking} onClose={() => setPicking(false)} selected={draft.items} onToggle={toggle} limit={draft.poll ? 2 : 1} kinds={activeKinds} spotifyConnected={spotifyConnected} title={draft.poll ? 'Choose your two picks' : 'Attach music'} />
  </Screen>;
}

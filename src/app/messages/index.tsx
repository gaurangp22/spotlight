import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, AppState } from 'react-native';
import { api } from '../../lib/api';
import { Conversation, Profile } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { useRemote } from '../../ui/remote';
import { Button, Card, EmptyState, ListRow, SearchField, Segmented, T, TextField } from '../../ui/primitives';
import { space } from '../../ui/theme';

function Inbox({ tab = false }: { tab?: boolean }) {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const { user } = useApp(); const { busy, run } = useTask();
  const inbox = useRemote<{ conversations: Conversation[]; nextOffset: number | null }>('/conversations', !!user);
  const [extra, setExtra] = useState<Conversation[]>([]), [offset, setOffset] = useState<number | null | undefined>(undefined);
  const reloadInbox = inbox.reload;
  useFocusEffect(useCallback(() => { const timer = setInterval(() => { if (AppState.currentState === 'active') reloadInbox(); }, 10000); return () => clearInterval(timer); }, [reloadInbox]));
  const [creating, setCreating] = useState(false), [kind, setKind] = useState<'direct' | 'group'>('direct');
  const [name, setName] = useState(''), [query, setQuery] = useState(''), [selected, setSelected] = useState<Profile[]>([]);
  const candidates = useRemote<{ people: Profile[] }>(`/people?q=${encodeURIComponent(query)}`, creating && !!user);
  const [shareKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  async function open(id: string) { if (postId) await api(`/conversations/${id}/messages`, { method: 'POST', body: { postId, clientId: shareKey } }); router.push(`/messages/${id}`); }
  async function create() { const r = await api<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { kind, name, handles: selected.map((p) => p.handle) } }); await open(r.conversation.id); setCreating(false); inbox.reload(); }
  if (!user) return <Screen back={!tab} tab={tab} title="Messages" large={tab}><Card><EmptyState icon="chatbubbles-outline" title="Keep the conversation going" text="Sign in to message another listener." action={<Button label="Sign in" onPress={() => router.push('/auth')} />} /></Card></Screen>;
  const chats = [...(inbox.data?.conversations || []), ...extra].filter((c, i, list) => list.findIndex((x) => x.id === c.id) === i);
  const next = offset === undefined ? inbox.data?.nextOffset : offset;
  return <Screen back={!tab} tab={tab} title="Messages" large onRefresh={() => { setExtra([]); setOffset(undefined); inbox.reload(); }} refreshing={inbox.loading}>
    {!!postId && <Card style={{ marginBottom: space.lg }}><T v="headline">Send this post</T><T v="subhead" tone="secondary">Choose a conversation or start a new one. Recipients can view the post only if its visibility allows them.</T></Card>}
    <Button label={creating ? 'Cancel new conversation' : 'New conversation'} variant="secondary" onPress={() => setCreating((v) => !v)} style={{ marginBottom: space.lg }} />
    {creating && <Card style={{ gap: space.md, marginBottom: space.lg }}>
      <Segmented value={kind} onChange={(k) => { setKind(k); setSelected([]); }} options={[{ value: 'direct', label: 'Direct' }, { value: 'group', label: 'Group' }]} />
      {kind === 'group' && <TextField label="Group name" value={name} onChangeText={setName} maxLength={60} />}
      <SearchField value={query} onChangeText={setQuery} placeholder="Find a listener" />
      <T v="caption" tone="secondary">{selected.length ? selected.map((p) => p.name).join(', ') : kind === 'group' ? 'Choose up to 11 people.' : 'Choose one person.'}</T>
      {!!candidates.error && <T tone="secondary">{candidates.error}</T>}
      {candidates.data?.people.filter((p) => p.id !== user.id).map((p) => <ListRow key={p.id} title={p.name} subtitle={p.handle} selection={selected.some((s) => s.id === p.id)} chevron={false} value={selected.some((s) => s.id === p.id) ? 'Selected' : undefined} onPress={() => setSelected((list) => list.some((s) => s.id === p.id) ? list.filter((s) => s.id !== p.id) : kind === 'direct' ? [p] : [...list, p].slice(0, 11))} />)}
      <Button label="Start conversation" disabled={!selected.length || (kind === 'group' && !name.trim())} loading={busy} onPress={() => void run(create)} />
    </Card>}
    {!!inbox.error && <Card><T>{inbox.error}</T><Button label="Try again" onPress={inbox.reload} /></Card>}
    {inbox.loading && <ActivityIndicator />}
    {!inbox.loading && !inbox.error && !chats.length && <Card><EmptyState icon="chatbubbles-outline" title="Your inbox is quiet" text="Share a song with someone, or start a group for your listening circle." /></Card>}
    {chats.map((chat) => <Card key={chat.id} padded={false} style={{ marginBottom: space.md }}><ListRow icon="chatbubble-outline" title={chat.name} accessibilityLabel={`${chat.name}, ${chat.unread} unread ${chat.unread === 1 ? 'message' : 'messages'}`} subtitle={chat.lastMessage ? `${chat.lastMessage.sender}: ${chat.lastMessage.text}` : chat.kind === 'group' ? `${chat.members.length} members` : chat.members.find((p) => p.id !== user.id)?.handle} value={chat.unread ? `${chat.unread} new` : undefined} disabled={busy} onPress={() => void run(() => open(chat.id))} /></Card>)}
    {next != null && <Button label="Load more conversations" variant="secondary" loading={busy} onPress={() => void run(async () => { const r = await api<{ conversations: Conversation[]; nextOffset: number | null }>(`/conversations?offset=${next}`); setExtra((list) => [...list, ...r.conversations]); setOffset(r.nextOffset); })} />}
  </Screen>;
}
export function MessagesScreen({ tab = false }: { tab?: boolean }) { const { user } = useApp(); const { postId } = useLocalSearchParams<{ postId?: string }>(); return <Inbox tab={tab} key={`${user?.id || 'guest'}:${postId || ''}`} />; }
export default function Messages() { return <MessagesScreen />; }

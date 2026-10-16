import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../lib/api';
import { displayDate } from '../../lib/dates';
import { Conversation, Profile } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { useRemote } from '../../ui/remote';
import { Avatar, BotBadge, Button, Card, EmptyState, IconButton, Ionicons, SearchField, Segmented, Sheet, T, Tap, TextField } from '../../ui/primitives';
import { gutter, space, useTheme } from '../../ui/theme';

/** One conversation: who, the latest line, when, and an unread count. */
function ConversationRow({ chat, me, onPress, last }: { chat: Conversation; me: string; onPress: () => void; last: boolean }) {
  const { c } = useTheme();
  const other = chat.kind === 'direct' ? chat.members.find((p) => p.id !== me) : undefined;
  const unread = chat.unread > 0;
  const preview = chat.lastMessage ? `${chat.kind === 'group' ? `${chat.lastMessage.sender.split(' ')[0]}: ` : ''}${chat.lastMessage.text || 'Shared a song'}` : chat.kind === 'group' ? `${chat.members.length} members` : 'Say hi';
  return <Tap onPress={onPress} scaleTo={0.99} accessibilityLabel={`${chat.name}${unread ? `, ${chat.unread} unread` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg }}>
    {other ? <Avatar size={52} name={other.name} uri={other.avatar} seed={other.handle} />
      : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="people" size={24} color={c.secondary} /></View>}
    <View style={{ flex: 1, paddingVertical: space.md, paddingRight: space.lg, gap: 2, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: c.hairline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}><T v="headline" numberOfLines={1} style={{ flexShrink: 1 }}>{chat.name}</T>{other?.bot && <BotBadge />}</View>
        {!!chat.lastMessage && <T v="footnote" tone={unread ? 'accent' : 'secondary'}>{displayDate(chat.lastMessage.createdAt)}</T>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <T v="subhead" tone={unread ? 'primary' : 'secondary'} weight={unread ? 'semibold' : undefined} numberOfLines={2} style={{ flex: 1 }}>{preview}</T>
        {unread && <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.accentFill, alignItems: 'center', justifyContent: 'center' }}>
          <T v="caption" weight="bold" style={{ color: c.onAccent }}>{chat.unread > 99 ? '99+' : chat.unread}</T>
        </View>}
      </View>
    </View>
  </Tap>;
}

function Inbox({ tab = false }: { tab?: boolean }) {
  const { c } = useTheme();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const { user } = useApp(); const { busy, run } = useTask();
  const inbox = useRemote<{ conversations: Conversation[]; nextOffset: number | null }>('/conversations', !!user);
  const [extra, setExtra] = useState<Conversation[]>([]), [offset, setOffset] = useState<number | null | undefined>(undefined);
  const reloadInbox = inbox.reload;
  useFocusEffect(useCallback(() => { reloadInbox(); const timer = setInterval(() => { if (AppState.currentState === 'active') reloadInbox(); }, 8000); return () => clearInterval(timer); }, [reloadInbox]));
  const [creating, setCreating] = useState(false), [kind, setKind] = useState<'direct' | 'group'>('direct');
  const [name, setName] = useState(''), [query, setQuery] = useState(''), [selected, setSelected] = useState<Profile[]>([]);
  const candidates = useRemote<{ people: Profile[] }>(`/people?q=${encodeURIComponent(query)}`, creating && !!user);
  const [shareKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  async function open(id: string) { if (postId) await api(`/conversations/${id}/messages`, { method: 'POST', body: { postId, clientId: shareKey } }); router.push(`/messages/${id}`); }
  async function create(people = selected) {
    const r = await api<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { kind, name, handles: people.map((p) => p.handle) } });
    setCreating(false); setSelected([]); setQuery(''); setName(''); inbox.reload(); await open(r.conversation.id);
  }
  const compose = <IconButton icon="create-outline" label="New message" onPress={() => setCreating(true)} />;
  if (!user) return <Screen back={!tab} tab={tab} title="Messages" large={tab}><Card><EmptyState icon="chatbubbles-outline" title="Keep the conversation going" text="Sign in to message another listener." action={<Button label="Sign in" onPress={() => router.push('/auth')} />} /></Card></Screen>;
  const chats = [...(inbox.data?.conversations || []), ...extra].filter((x, i, list) => list.findIndex((y) => y.id === x.id) === i);
  const next = offset === undefined ? inbox.data?.nextOffset : offset;
  const people = (candidates.data?.people || []).filter((p) => p.id !== user.id);
  return <Screen back={!tab} tab={tab} title="Messages" large right={compose} onRefresh={() => { setExtra([]); setOffset(undefined); inbox.reload(); }} refreshing={false}>
    {!!postId && <Card style={{ marginBottom: space.lg, flexDirection: 'row', gap: space.md, alignItems: 'center' }}><Ionicons name="paper-plane" size={22} color={c.accent} /><View style={{ flex: 1 }}><T v="headline">Send this post</T><T v="footnote" tone="secondary">Pick a chat, or start a new one.</T></View></Card>}
    {!!inbox.error && <Card style={{ gap: space.md }}><T>{inbox.error}</T><Button label="Try again" onPress={inbox.reload} /></Card>}
    {inbox.loading && !chats.length && <ActivityIndicator color={c.secondary} style={{ marginTop: space.xl }} />}
    {!inbox.loading && !inbox.error && !chats.length && <Card><EmptyState icon="chatbubbles-outline" title="No messages yet" text="Send a song to a friend, or start a group for your listening circle." action={<Button label="New message" icon="create-outline" inline onPress={() => setCreating(true)} />} /></Card>}
    {chats.length > 0 && <Card padded={false} style={{ overflow: 'hidden' }}>
      {chats.map((chat, i) => <ConversationRow key={chat.id} chat={chat} me={user.id} last={i === chats.length - 1} onPress={() => void run(() => open(chat.id))} />)}
    </Card>}
    {next != null && <Button label="Older conversations" variant="plain" loading={busy} style={{ marginTop: space.md }} onPress={() => void run(async () => { const r = await api<{ conversations: Conversation[]; nextOffset: number | null }>(`/conversations?offset=${next}`); setExtra((list) => [...list, ...r.conversations]); setOffset(r.nextOffset); })} />}

    <Sheet visible={creating} onClose={() => setCreating(false)} title="New message"
      action={kind === 'group' ? <Button label={selected.length ? `Start group · ${selected.length}` : 'Start group'} disabled={!selected.length || !name.trim()} loading={busy} onPress={() => void run(() => create())} /> : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.xxl }}>
        <Segmented value={kind} onChange={(k) => { setKind(k); setSelected([]); }} options={[{ value: 'direct', label: 'Direct' }, { value: 'group', label: 'Group' }]} />
        {kind === 'group' && <TextField label="Group name" value={name} onChangeText={setName} maxLength={60} placeholder="Sunday listening club" />}
        <SearchField value={query} onChangeText={setQuery} placeholder="Search people" />
        {kind === 'group' && !!selected.length && <T v="footnote" tone="secondary">{selected.map((p) => p.name).join(', ')}</T>}
        {!!candidates.error && <T tone="secondary">{candidates.error}</T>}
        {candidates.loading && !people.length && <ActivityIndicator color={c.secondary} />}
        {people.map((p) => {
          const on = selected.some((s) => s.id === p.id);
          return <Tap key={p.id} disabled={busy} accessibilityLabel={kind === 'direct' ? `Message ${p.name}` : `${on ? 'Remove' : 'Add'} ${p.name}`} scaleTo={0.99}
            onPress={() => kind === 'direct' ? void run(() => create([p])) : setSelected((list) => on ? list.filter((s) => s.id !== p.id) : [...list, p].slice(0, 11))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
            <Avatar size={42} name={p.name} uri={p.avatar} seed={p.handle} />
            <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><T v="headline" numberOfLines={1} style={{ flexShrink: 1 }}>{p.name}</T>{p.bot && <BotBadge />}</View><T v="footnote" tone="secondary">{p.handle}</T></View>
            {kind === 'group' ? <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? c.accent : c.tertiary} /> : <Ionicons name="chatbubble-outline" size={20} color={c.secondary} />}
          </Tap>;
        })}
      </ScrollView>
    </Sheet>
  </Screen>;
}
export function MessagesScreen({ tab = false }: { tab?: boolean }) { const { user } = useApp(); const { postId } = useLocalSearchParams<{ postId?: string }>(); return <Inbox tab={tab} key={`${user?.id || 'guest'}:${postId || ''}`} />; }
export default function Messages() { return <MessagesScreen />; }

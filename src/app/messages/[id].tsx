import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { Conversation, Message, MusicItem } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { MusicPicker } from '../../ui/MusicPicker';
import { useTask } from '../../ui/forms';
import { haptic } from '../../ui/haptics';
import { useRemote } from '../../ui/remote';
import { Artwork, Avatar, Button, Card, Dialog, IconButton, Ionicons, T, Tap, TextField } from '../../ui/primitives';
import { curve, font, noOutline, radius, space, useTheme } from '../../ui/theme';

const MINUTES_APART = 10;
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function day(value: string) {
  const date = new Date(value), today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
const apart = (a: Message, b: Message) => Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) > MINUTES_APART * 60000;

/** One chat bubble: yours on the right in rose, theirs on the left in grey. Long-press for actions. */
function Bubble({ message, mine, group, first, last, selected, onLongPress, onOpenItem }: {
  message: Message; mine: boolean; group: boolean; first: boolean; last: boolean; selected: boolean; onLongPress: () => void; onOpenItem: (item: MusicItem) => void;
}) {
  const { c } = useTheme();
  const ink = mine ? c.onAccent : c.text;
  const corner = { borderTopLeftRadius: !mine && !first ? 6 : 20, borderBottomLeftRadius: !mine && !last ? 6 : 20, borderTopRightRadius: mine && !first ? 6 : 20, borderBottomRightRadius: mine && !last ? 6 : 20 };
  const removed = message.deleted;
  return <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: space.xs, marginTop: first ? space.sm : 2 }}>
    {!mine && group && <View style={{ width: 28 }}>{last && <Avatar size={28} name={message.sender.name} uri={message.sender.avatar} seed={message.sender.handle} />}</View>}
    <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {!mine && group && first && <T v="caption" tone="secondary" style={{ marginLeft: 12, marginBottom: 2 }}>{message.sender.name}</T>}
      <Pressable onLongPress={removed ? undefined : onLongPress} delayLongPress={300} accessibilityHint={removed ? undefined : 'Long press for options'}
        style={[{ backgroundColor: removed ? 'transparent' : mine ? c.accentFill : c.fill, paddingHorizontal: 14, paddingVertical: 9, gap: 8, borderWidth: removed ? StyleSheet.hairlineWidth : 0, borderColor: c.hairline, opacity: selected ? 0.7 : 1, ...curve }, corner]}>
        {!!message.item && !removed && <Pressable accessibilityRole="button" accessibilityLabel={`${message.item.title} by ${message.item.artist}`} onPress={() => onOpenItem(message.item!)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 200 }}>
          <Artwork item={message.item} size={48} rounded={10} />
          <View style={{ flex: 1 }}>
            <T v="callout" weight="semibold" numberOfLines={1} style={{ color: ink }}>{message.item.title}</T>
            <T v="footnote" numberOfLines={1} style={{ color: ink, opacity: 0.75 }}>{message.item.artist}</T>
          </View>
        </Pressable>}
        {!!message.post && !removed && <Pressable accessibilityRole="button" onPress={() => router.push(`/ranking/${message.post!.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 180 }}>
          <Ionicons name="albums-outline" size={20} color={ink} />
          <T v="callout" weight="semibold" numberOfLines={2} style={{ color: ink, flex: 1 }}>{message.post.title}</T>
          <Ionicons name="chevron-forward" size={16} color={ink} />
        </Pressable>}
        {(removed || !!message.text) && <T v="body" style={{ color: removed ? c.secondary : ink, fontStyle: removed ? 'italic' : 'normal' }}>{removed ? 'Message removed' : message.text}</T>}
      </Pressable>
      {last && <T v="caption" tone="tertiary" style={{ marginTop: 3, marginHorizontal: 6 }}>{time(message.createdAt)}</T>}
    </View>
  </View>;
}

function Thread() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>(); const { user, rememberItem } = useApp(); const { busy, run } = useTask();
  const meta = useRemote<{ conversation: Conversation }>(`/conversations/${id}`, !!user);
  const key = `${user?.id}:${id}`, [snapshot, setSnapshot] = useState<{ key: string; messages: Message[]; more: boolean; error: string } | null>(null);
  const [draft, setDraft] = useState<{ key: string; text: string; item: MusicItem | null; nonce: string }>({ key: '', text: '', item: null, nonce: '' });
  const [picking, setPicking] = useState(false), [leaving, setLeaving] = useState(false), [details, setDetails] = useState(false);
  const [sending, setSending] = useState(false), [selected, setSelected] = useState<Message | null>(null);
  const [reporting, setReporting] = useState(''), [reason, setReason] = useState('');
  const scrollRef = useRef<ScrollView>(null), pinned = useRef(true), initialized = useRef(false), forceLatest = useRef(false);
  const position = useRef({ offset: 0, height: 0 }), anchor = useRef<{ offset: number; height: number } | null>(null);
  const sequence = useRef(0), scrolling = useRef(false); const [newMessages, setNewMessages] = useState(false);
  const jumpToLatest = useCallback(() => {
    pinned.current = true; initialized.current = true; forceLatest.current = false; scrolling.current = true;
    requestAnimationFrame(() => { scrollRef.current?.scrollToEnd({ animated: false }); setNewMessages(false); setTimeout(() => { scrolling.current = false; }, 150); });
  }, []);

  const focused = useIsFocused(); const alive = useRef(false);
  useEffect(() => { alive.current = focused; return () => { alive.current = false; }; }, [focused]);
  const messages = snapshot?.key === key ? snapshot.messages : [], text = draft.key === key ? draft.text : '', item = draft.key === key ? draft.item : null;
  const tail = messages.at(-1)?.sequence || 0;
  useEffect(() => {
    if (!tail) return;
    const incoming = sequence.current > 0 && tail > sequence.current; sequence.current = tail;
    if (anchor.current) return;
    if (!initialized.current || pinned.current || forceLatest.current) jumpToLatest();
    else if (incoming) requestAnimationFrame(() => setNewMessages(true));
  }, [tail, jumpToLatest]);
  const recordPosition = useCallback((offset: number, height: number, viewport: number) => {
    position.current = { offset, height };
    if (initialized.current && !scrolling.current) pinned.current = height - offset - viewport < 120;
    if (pinned.current) setNewMessages(false);
  }, []);
  const contentHeight = useCallback((height: number) => {
    if (anchor.current) { const saved = anchor.current; anchor.current = null; requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: saved.offset + height - saved.height, animated: false })); }
    else if (sequence.current && (!initialized.current || pinned.current || forceLatest.current)) jumpToLatest();
  }, [jumpToLatest]);
  function change(value: string, pick = item) { setDraft({ key, text: value, item: pick, nonce: draft.nonce && draft.key === key ? draft.nonce : `${Date.now()}-${Math.random().toString(36).slice(2)}` }); }
  async function load(before?: number) {
    const r = await api<{ messages: Message[]; hasMore: boolean }>(`/conversations/${id}/messages${before ? `?before=${before}` : ''}`);
    if (!alive.current) return;
    if (before) anchor.current = { ...position.current };
    setSnapshot((old) => {
      const previous = old?.key === key ? old.messages : [];
      const merged = before ? [...r.messages, ...previous] : [...previous.filter((m) => m.sequence < (r.messages[0]?.sequence ?? Infinity)), ...r.messages];
      return { key, messages: merged.filter((m, i, list) => list.findIndex((x) => x.id === m.id) === i), more: before || !old ? r.hasMore : old.more, error: '' };
    });
    const last = r.messages.at(-1); if (last && !before) await api(`/conversations/${id}/read`, { method: 'POST', body: { sequence: last.sequence } });
  }
  useEffect(() => {
    if (!user || !focused) return;
    let active = true;
    const poll = () => { if (active && AppState.currentState === 'active') load().catch((e) => { if (active && alive.current) setSnapshot({ key, messages: [], more: false, error: errorMessage(e) }); }); };
    poll(); const timer = setInterval(poll, 4000); return () => { active = false; clearInterval(timer); };
    // Poll state is scoped to the viewer/thread, not to the composer text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user?.id, focused]);

  /** Sending clears the composer straight away and restores it if the request fails. */
  async function send() {
    const sending = draft;
    if ((!sending.text.trim() && !sending.item) || busy) return;
    setSending(true); haptic.select();
    setDraft({ key, text: '', item: null, nonce: '' });
    try {
      await api(`/conversations/${id}/messages`, { method: 'POST', body: { text: sending.text, item: sending.item, clientId: sending.nonce || `${Date.now()}` } });
      if (alive.current) { forceLatest.current = true; await load(); }
    } catch (e) {
      setDraft((current) => current.text || current.item ? current : sending);
      throw e;
    } finally { setSending(false); }
  }

  if (!user) return <Screen back title="Messages"><Button label="Sign in" onPress={() => router.push('/auth')} /></Screen>;
  const chat = meta.data?.conversation;
  const other = chat?.kind === 'direct' ? chat.members.find((p) => p.id !== user.id) : undefined;
  const group = chat?.kind === 'group';
  const canSend = (!!text.trim() || !!item) && !sending;

  const composer = !meta.error && chat ? <View style={{ gap: space.sm }}>
    {newMessages && <Button label="New messages" icon="arrow-down" variant="tinted" size="sm" inline onPress={jumpToLatest} style={{ alignSelf: 'center' }} />}
    {!!selected && <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
      {selected.sender.id === user.id
        ? <Button label="Remove message" icon="trash-outline" variant="destructive" size="sm" inline onPress={() => void run(async () => { await api(`/conversations/${id}/messages/${selected.id}`, { method: 'DELETE' }); setSelected(null); await load(); })} />
        : <Button label="Report" icon="flag-outline" variant="secondary" size="sm" inline onPress={() => { setReason(''); setReporting(selected.id); setSelected(null); }} />}
      <Button label="Cancel" variant="plain" size="sm" inline onPress={() => setSelected(null)} />
    </View>}
    {!!item && <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.fill, borderRadius: radius.md, padding: space.xs, ...curve }}>
      <Artwork item={item} size={40} rounded={8} />
      <View style={{ flex: 1 }}><T v="subhead" weight="semibold" numberOfLines={1}>{item.title}</T><T v="caption" tone="secondary" numberOfLines={1}>{item.artist}</T></View>
      <IconButton icon="close" label="Remove song" size={32} filled={false} tone="secondary" onPress={() => change(text, null)} />
    </View>}
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
      <IconButton icon="musical-notes" label="Share a song" size={40} onPress={() => setPicking(true)} />
      <View style={{ flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, backgroundColor: c.fill, paddingHorizontal: 14, justifyContent: 'center', ...curve }}>
        <TextInput value={text} onChangeText={(value) => change(value)} placeholder={other ? `Message ${other.name.split(' ')[0]}` : 'Message'} placeholderTextColor={c.tertiary}
          multiline numberOfLines={Platform.OS === 'web' ? 1 : undefined} maxLength={2000} accessibilityLabel="Message" onSubmitEditing={() => void run(send)} blurOnSubmit={false}
          style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 21, color: c.text, paddingVertical: 9, ...noOutline }} />
      </View>
      <Tap onPress={() => void run(send)} disabled={!canSend} accessibilityLabel="Send" scaleTo={0.9}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: canSend ? c.accentFill : c.fill, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="arrow-up" size={22} color={canSend ? c.onAccent : c.tertiary} />
      </Tap>
    </View>
  </View> : undefined;

  return <Screen back title={chat?.name || 'Conversation'} scrollRef={scrollRef} onScrollPosition={recordPosition} onContentHeight={contentHeight} footer={composer}
    right={group ? <IconButton icon="people-outline" label="Group details" onPress={() => setDetails((v) => !v)} /> : other ? <Tap onPress={() => router.push(`/person/${other.handle.slice(1)}`)} accessibilityLabel={`View ${other.name}'s profile`}><Avatar size={34} name={other.name} uri={other.avatar} seed={other.handle} /></Tap> : undefined}>
    {!!(meta.error || (snapshot?.key === key && snapshot.error)) && <Card style={{ gap: space.md }}><T>{meta.error || snapshot?.error}</T><Button label="Try again" onPress={() => { meta.reload(); void run(() => load()); }} /></Card>}
    {group && details && chat && <Card style={{ gap: space.sm, marginBottom: space.md }}>
      <T v="headline">{chat.members.length} members</T>
      {chat.members.map((p) => <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar size={30} name={p.name} uri={p.avatar} seed={p.handle} />
        <T v="callout" style={{ flex: 1 }} numberOfLines={1}>{p.id === user.id ? 'You' : p.name}</T>
        {chat.ownerId === user.id && p.id !== user.id && <Button label="Remove" size="sm" variant="plain" inline onPress={() => void run(async () => { await api(`/conversations/${id}/members/${p.id}`, { method: 'DELETE' }); meta.reload(); })} />}
      </View>)}
      <Button label="Leave group" size="sm" variant="destructive" onPress={() => setLeaving(true)} />
    </Card>}
    {!!snapshot?.more && <Button label="Earlier messages" variant="plain" size="sm" loading={busy} onPress={() => void run(() => load(messages[0]?.sequence))} />}
    {chat && snapshot?.key === key && !messages.length && !snapshot.error && <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl }}>
      {other ? <Avatar size={72} name={other.name} uri={other.avatar} seed={other.handle} /> : <Ionicons name="chatbubbles-outline" size={44} color={c.tertiary} />}
      <T v="headline">{other ? other.name : chat.name}</T>
      <T v="subhead" tone="secondary" center>Say hi, or send a song with the ♪ button.</T>
    </View>}
    {messages.map((message, index) => {
      const prev = messages[index - 1], next = messages[index + 1];
      const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
      const first = !prev || prev.sender.id !== message.sender.id || apart(prev, message) || newDay;
      const last = !next || next.sender.id !== message.sender.id || apart(message, next) || new Date(next.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
      return <View key={message.id}>
        {newDay && <T v="caption" tone="secondary" center style={{ marginTop: space.lg, marginBottom: space.xs }}>{day(message.createdAt)}</T>}
        <Bubble message={message} mine={message.sender.id === user.id} group={group} first={first} last={last} selected={selected?.id === message.id}
          onLongPress={() => { haptic.select(); setSelected(message); }}
          onOpenItem={(pick) => { rememberItem(pick); router.push(`/item/${encodeURIComponent(pick.id)}`); }} />
      </View>;
    })}
    <View style={{ height: space.md }} />
    <MusicPicker spotifyConnected={false} visible={picking} onClose={() => setPicking(false)} title="Share a song" onPick={(pick) => { change(text, pick); setPicking(false); }} />
    <Dialog visible={!!reporting} title="Report this message?" description="Your report goes to moderation. You can also block this person from their profile." confirmLabel="Send report" busy={busy} onCancel={() => setReporting('')} onConfirm={() => void run(async () => { await api(`/conversations/${id}/messages/${reporting}/report`, { method: 'POST', body: { reason } }); setReporting(''); })}><TextField label="Reason for reporting" value={reason} onChangeText={setReason} multiline maxLength={300} placeholder="What should we review?" /></Dialog>
    <Dialog visible={leaving} title="Leave this group?" description="You will lose access to its messages. If you own the group, ownership passes to another member." confirmLabel="Leave group" destructive busy={busy} onCancel={() => setLeaving(false)} onConfirm={() => void run(async () => { await api(`/conversations/${id}/leave`, { method: 'POST' }); router.replace('/(tabs)/inbox'); })} />
  </Screen>;
}
export default function ThreadScreen() { const { user } = useApp(); const { id } = useLocalSearchParams<{ id: string }>(); return <Thread key={`${user?.id || 'guest'}:${id}`} />; }

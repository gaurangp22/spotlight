import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { Conversation, Message, MusicItem } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { MusicRow, Screen } from '../../ui/components';
import { MusicPicker } from '../../ui/MusicPicker';
import { useTask } from '../../ui/forms';
import { useRemote } from '../../ui/remote';
import { Avatar, Button, Card, Dialog, T, TextField } from '../../ui/primitives';
import { space } from '../../ui/theme';

function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { user, rememberItem } = useApp(); const { busy, run } = useTask();
  const meta = useRemote<{ conversation: Conversation }>(`/conversations/${id}`, !!user);
  const key = `${user?.id}:${id}`, [snapshot, setSnapshot] = useState<{ key: string; messages: Message[]; more: boolean; error: string } | null>(null);
  const [draft, setDraft] = useState<{ key: string; text: string; item: MusicItem | null; nonce: string }>({ key: '', text: '', item: null, nonce: '' });
  const [picking, setPicking] = useState(false), [leaving, setLeaving] = useState(false);
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
  function change(value: string, pick = item) { setDraft({ key, text: value, item: pick, nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}` }); }
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
    poll(); const timer = setInterval(poll, 5000); return () => { active = false; clearInterval(timer); };
    // Poll state is scoped to the viewer/thread, not to the composer text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user?.id, focused]);
  if (!user) return <Screen back title="Messages"><Button label="Sign in" onPress={() => router.push('/auth')} /></Screen>;
  const chat = meta.data?.conversation;
  return <Screen back title={chat?.name || 'Conversation'} scrollRef={scrollRef} onScrollPosition={recordPosition} onContentHeight={contentHeight} onRefresh={() => void run(() => load())} refreshing={busy} footer={!meta.error && chat ? <View style={{ gap: space.sm }}>
    {newMessages && <Button label="New messages · Jump to latest" variant="tinted" size="sm" onPress={jumpToLatest} />}
    {!!item && <View><T v="caption">Sharing {item.title}</T><Button label="Remove music" size="sm" variant="plain" onPress={() => change(text, null)} /></View>}
    <TextField label="Message" placeholder="Send a thought or a song…" value={text} onChangeText={(value) => change(value)} multiline maxLength={2000} editable={!busy} />
    <View style={{ flexDirection: 'row', gap: space.sm }}><Button label="Add music" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setPicking(true)} /><Button label="Send" size="sm" style={{ flex: 1 }} disabled={!text.trim() && !item} loading={busy} onPress={() => void run(async () => { const sending = draft; await api(`/conversations/${id}/messages`, { method: 'POST', body: { text, item, clientId: sending.nonce } }); if (alive.current) { forceLatest.current = true; setDraft({ key, text: '', item: null, nonce: '' }); await load(); } })} /></View>
  </View> : undefined}>
    {!!(meta.error || (snapshot?.key === key && snapshot.error)) && <Card><T>{meta.error || snapshot?.error}</T><Button label="Try again" onPress={() => { meta.reload(); void run(() => load()); }} /></Card>}
    {chat?.kind === 'group' && <Card style={{ gap: space.sm, marginBottom: space.md }}><T v="caption" tone="secondary">{chat.members.map((p) => p.name).join(', ')}</T><Button label="Leave group" size="sm" variant="plain" onPress={() => setLeaving(true)} />{chat.ownerId === user.id && chat.members.filter((p) => p.id !== user.id).map((p) => <Button key={p.id} label={`Remove ${p.name}`} size="sm" variant="plain" onPress={() => void run(async () => { await api(`/conversations/${id}/members/${p.id}`, { method: 'DELETE' }); meta.reload(); })} />)}</Card>}
    {!!snapshot?.more && <Button label="Earlier messages" variant="secondary" loading={busy} onPress={() => void run(() => load(messages[0]?.sequence))} />}
    {chat && !messages.length && !snapshot?.error && <T tone="secondary">Start with a pick or a thought. Messages are visible to this conversation’s members.</T>}
    {messages.map((message) => <Card key={message.id} style={{ gap: space.sm, marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}><Avatar size={30} name={message.sender.name} uri={message.sender.avatar} seed={message.sender.handle} /><T v="caption" tone="secondary">{message.sender.name} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</T></View>
      <T>{message.deleted ? 'Message removed' : message.text}</T>
      {message.item && <MusicRow item={message.item} onPress={() => { rememberItem(message.item!); router.push(`/item/${encodeURIComponent(message.item!.id)}`); }} />}
      {message.post && <Button label={message.post.title} variant="secondary" onPress={() => router.push(`/ranking/${message.post!.id}`)} />}
      {!message.deleted && message.sender.id === user.id && <Button label="Remove message" size="sm" variant="plain" onPress={() => void run(async () => { await api(`/conversations/${id}/messages/${message.id}`, { method: 'DELETE' }); await load(); })} />}
      {!message.deleted && message.sender.id !== user.id && <Button label="Report message" size="sm" variant="plain" onPress={() => { setReason(''); setReporting(message.id); }} />}
    </Card>)}
    <MusicPicker spotifyConnected={false} visible={picking} onClose={() => setPicking(false)} onPick={(pick) => { change(text, pick); setPicking(false); }} />
    <Dialog visible={!!reporting} title="Report this message?" description="Your report goes to moderation. You can also block this person from their profile." confirmLabel="Send report" busy={busy} onCancel={() => setReporting('')} onConfirm={() => void run(async () => { await api(`/conversations/${id}/messages/${reporting}/report`, { method: 'POST', body: { reason } }); setReporting(''); })}><TextField label="Reason for reporting" value={reason} onChangeText={setReason} multiline maxLength={300} placeholder="What should we review?" /></Dialog>
    <Dialog visible={leaving} title="Leave this group?" description="You will lose access to its messages. If you own the group, ownership passes to another member." confirmLabel="Leave group" destructive busy={busy} onCancel={() => setLeaving(false)} onConfirm={() => void run(async () => { await api(`/conversations/${id}/leave`, { method: 'POST' }); router.replace('/messages'); })} />
  </Screen>;
}
export default function ThreadScreen() { const { user } = useApp(); const { id } = useLocalSearchParams<{ id: string }>(); return <Thread key={`${user?.id || 'guest'}:${id}`} />; }

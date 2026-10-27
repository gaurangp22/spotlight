import { router, useLocalSearchParams, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { api, errorMessage } from '../../lib/api';
import { ChatLive, Conversation, Message, MusicItem } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { MusicPicker } from '../../ui/MusicPicker';
import { useTask } from '../../ui/forms';
import { haptic } from '../../ui/haptics';
import { useRemote } from '../../ui/remote';
import { Artwork, Avatar, Button, Card, Dialog, IconButton, Ionicons, T, Tap, TextField } from '../../ui/primitives';
import { curve, font, noOutline, radius, space, useTheme } from '../../ui/theme';

const MINUTES_APART = 10;
const REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👍'];
/** How often "typing" is re-sent while someone keeps typing; the server forgets it after 6 seconds. */
const TYPING_EVERY = 3000;
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function day(value: string) {
  const date = new Date(value), today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
const apart = (a: Message, b: Message) => Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) > MINUTES_APART * 60000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nonce = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** A message shown straight away while it is on its way; `failed` offers a retry with the same key. */
type Pending = { clientId: string; text: string; item: MusicItem | null; replyTo: Message | null; failed?: boolean };

function quoteText(quote: { text: string; itemTitle?: string | null; item?: MusicItem | null; deleted: boolean }) {
  if (quote.deleted) return 'Message removed';
  const title = quote.itemTitle ?? quote.item?.title;
  return quote.text || (title ? `♪ ${title}` : 'Shared music');
}

/** The quoted message at the top of a reply, or above the composer while writing one. */
function Quote({ sender, text, ink, accent }: { sender: string; text: string; ink: string; accent: string }) {
  return <View style={{ borderLeftWidth: 3, borderColor: accent, paddingLeft: 8, paddingVertical: 2, opacity: 0.9 }}>
    <T v="caption" weight="semibold" numberOfLines={1} style={{ color: ink }}>{sender}</T>
    <T v="footnote" numberOfLines={2} style={{ color: ink, opacity: 0.8 }}>{text}</T>
  </View>;
}

/** One chat bubble: yours on the right in volt, theirs on the left in grey. Long-press for actions, double-tap to heart. */
function Bubble({ message, mine, group, first, last, selected, viewerId, onLongPress, onDoubleTap, onReact, onOpenItem }: {
  message: Message; mine: boolean; group: boolean; first: boolean; last: boolean; selected: boolean; viewerId: string;
  onLongPress: () => void; onDoubleTap: () => void; onReact: (emoji: string) => void; onOpenItem: (item: MusicItem) => void;
}) {
  const { c } = useTheme();
  const lastTap = useRef(0);
  const ink = mine ? c.onAccent : c.text;
  const corner = { borderTopLeftRadius: !mine && !first ? 6 : 20, borderBottomLeftRadius: !mine && !last ? 6 : 20, borderTopRightRadius: mine && !first ? 6 : 20, borderBottomRightRadius: mine && !last ? 6 : 20 };
  const removed = message.deleted;
  const reactions = message.reactions ?? [];
  const tap = () => { const now = Date.now(); if (now - lastTap.current < 300) { lastTap.current = 0; onDoubleTap(); } else lastTap.current = now; };
  return <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: space.xs, marginTop: first ? space.sm : 2 }}>
    {!mine && group && <View style={{ width: 28 }}>{last && <Avatar size={28} name={message.sender.name} uri={message.sender.avatar} seed={message.sender.handle} />}</View>}
    <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {!mine && group && first && <T v="caption" tone="secondary" style={{ marginLeft: 12, marginBottom: 2 }}>{message.sender.name}</T>}
      <Pressable onPress={removed ? undefined : tap} onLongPress={removed ? undefined : onLongPress} delayLongPress={300} accessibilityHint={removed ? undefined : 'Double tap to react with a heart, long press for options'}
        style={[{ backgroundColor: removed ? 'transparent' : mine ? c.accentFill : c.fill, paddingHorizontal: 14, paddingVertical: 9, gap: 8, borderWidth: removed ? StyleSheet.hairlineWidth : 0, borderColor: c.hairline, opacity: selected ? 0.7 : 1, ...curve }, corner]}>
        {!!message.replyTo && !removed && <Quote sender={message.replyTo.senderId === viewerId ? 'You' : message.replyTo.sender} text={quoteText(message.replyTo)} ink={ink} accent={mine ? 'rgba(0,0,0,0.35)' : c.accent} />}
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
      {!!reactions.length && <View style={{ flexDirection: 'row', gap: 4, marginTop: -6, marginHorizontal: 8 }}>
        {reactions.map((r) => <Pressable key={r.emoji} accessibilityRole="button" accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ', yours. Tap to remove' : '. Tap to react the same'}`} onPress={() => onReact(r.emoji)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, minHeight: 24, borderRadius: radius.pill, backgroundColor: r.mine ? c.accentSoft : c.elevated, borderWidth: 1, borderColor: r.mine ? c.accent : c.bg }}>
          <Text style={{ fontSize: 13 }}>{r.emoji}</Text>{r.count > 1 && <T v="caption" weight="semibold">{r.count}</T>}
        </Pressable>)}
      </View>}
      {last && <T v="caption" tone="tertiary" style={{ marginTop: 3, marginHorizontal: 6 }}>{time(message.createdAt)}</T>}
    </View>
  </View>;
}

function Dot({ delay }: { delay: number }) {
  const { c } = useTheme();
  const lift = useSharedValue(0.35);
  useEffect(() => { lift.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0.35, { duration: 300 })), -1)); }, [delay, lift]);
  const style = useAnimatedStyle(() => ({ opacity: lift.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.secondary }, style]} />;
}

/** Three pulsing dots in a bubble, with names when it's a group. */
function Typing({ names }: { names: string[] }) {
  const { c } = useTheme();
  return <View accessibilityLiveRegion="polite" accessibilityLabel={`${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing`} style={{ alignItems: 'flex-start', marginTop: space.sm }}>
    <View style={{ flexDirection: 'row', gap: 4, backgroundColor: c.fill, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 13, ...curve }}>
      <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
    </View>
    {names.length > 0 && <T v="caption" tone="tertiary" style={{ marginTop: 3, marginHorizontal: 6 }}>{names.join(', ')}</T>}
  </View>;
}

function Thread() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>(); const { user, rememberItem, setNotice } = useApp(); const { busy, run } = useTask();
  const meta = useRemote<{ conversation: Conversation }>(`/conversations/${id}`, !!user);
  const key = `${user?.id}:${id}`, [snapshot, setSnapshot] = useState<{ key: string; messages: Message[]; more: boolean; error: string } | null>(null);
  const [live, setLive] = useState<ChatLive | null>(null);
  const [draft, setDraft] = useState<{ key: string; text: string; item: MusicItem | null; nonce: string }>({ key: '', text: '', item: null, nonce: '' });
  const [pending, setPending] = useState<Pending[]>([]), [replying, setReplying] = useState<Message | null>(null);
  const [picking, setPicking] = useState(false), [leaving, setLeaving] = useState(false), [details, setDetails] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [reporting, setReporting] = useState(''), [reason, setReason] = useState('');
  const scrollRef = useRef<ScrollView>(null), pinned = useRef(true), initialized = useRef(false), forceLatest = useRef(false);
  const position = useRef({ offset: 0, height: 0 }), anchor = useRef<{ offset: number; height: number } | null>(null);
  const sequence = useRef(0), scrolling = useRef(false); const [newMessages, setNewMessages] = useState(false);
  const typingSent = useRef(0);
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

  /** Tells the others you're typing (at most every few seconds), or that you stopped. */
  function signalTyping(typing: boolean) {
    const now = Date.now();
    if (typing && now - typingSent.current < TYPING_EVERY) return;
    if (!typing && !typingSent.current) return;
    typingSent.current = typing ? now : 0;
    api(`/conversations/${id}/typing`, { method: 'POST', body: { typing } }).catch(() => {});
  }
  function change(value: string, pick = item) {
    setDraft({ key, text: value, item: pick, nonce: draft.nonce && draft.key === key ? draft.nonce : nonce() });
    signalTyping(!!value.trim());
  }
  async function load(before?: number) {
    const r = await api<{ messages: Message[]; hasMore: boolean } & ChatLive>(`/conversations/${id}/messages${before ? `?before=${before}` : ''}`);
    if (!alive.current) return;
    if (before) anchor.current = { ...position.current };
    else setLive({ version: r.version, typing: r.typing, reads: r.reads });
    setSnapshot((old) => {
      const previous = old?.key === key ? old.messages : [];
      // The newest page replaces what it covers, so reactions and removals on recent messages stay current.
      const merged = before ? [...r.messages, ...previous] : [...previous.filter((m) => m.sequence < (r.messages[0]?.sequence ?? Infinity)), ...r.messages];
      return { key, messages: merged.filter((m, i, list) => list.findIndex((x) => x.id === m.id) === i), more: before || !old ? r.hasMore : old.more, error: '' };
    });
    const last = r.messages.at(-1); if (last && !before) await api(`/conversations/${id}/read`, { method: 'POST', body: { sequence: last.sequence } });
  }
  // Live: wait on the server for anything to change in this chat, then reload. The server answers at once
  // when something happens, or after 20 seconds with nothing new, and the loop asks again.
  useEffect(() => {
    if (!user || !focused) return;
    let active = true, request: AbortController | null = null;
    void (async () => {
      let since = '';
      while (active) {
        if (AppState.currentState !== 'active') { await sleep(1500); continue; }
        request = new AbortController();
        const timeout = setTimeout(() => request?.abort(), 30000);
        try {
          const update = await api<ChatLive>(`/conversations/${id}/updates?since=${encodeURIComponent(since)}`, { signal: request.signal });
          if (!active) break;
          setLive(update);
          if (update.version !== since) { since = update.version; await load(); }
        } catch (e) {
          if (!active) break;
          // A timed-out wait just asks again; anything else shows and backs off.
          if (!request.signal.aborted && alive.current) setSnapshot((old) => old?.key === key && old.messages.length ? old : { key, messages: [], more: false, error: errorMessage(e) });
          await sleep(3000);
        } finally { clearTimeout(timeout); }
      }
    })();
    return () => { active = false; request?.abort(); signalTyping(false); };
    // The loop is scoped to the viewer and thread, not to the composer text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user?.id, focused]);

  /** The message appears at once as "Sending…"; a failure keeps it with a retry that reuses its key. */
  async function deliver(message: Pending) {
    setPending((list) => [...list.filter((p) => p.clientId !== message.clientId), { ...message, failed: false }]);
    try {
      await api(`/conversations/${id}/messages`, { method: 'POST', body: { text: message.text, item: message.item, replyTo: message.replyTo?.id, clientId: message.clientId } });
      if (alive.current) { forceLatest.current = true; await load(); }
      setPending((list) => list.filter((p) => p.clientId !== message.clientId));
    } catch (e) {
      setPending((list) => list.map((p) => (p.clientId === message.clientId ? { ...p, failed: true } : p)));
      throw e;
    }
  }
  function send() {
    if (!text.trim() && !item) return;
    haptic.select();
    const message: Pending = { clientId: draft.nonce || nonce(), text, item, replyTo: replying };
    setDraft({ key, text: '', item: null, nonce: '' }); setReplying(null); typingSent.current = 0;
    forceLatest.current = true; jumpToLatest();
    void deliver(message).catch(failed);
  }
  // Sends skip useTask's one-at-a-time lock, which would drop a quick second message.
  function failed(e: unknown) { haptic.warn(); setNotice(errorMessage(e)); }
  async function react(message: Message, emoji: string) {
    const current = message.reactions?.find((r) => r.mine)?.emoji;
    haptic.select(); setSelected(null);
    await api(`/conversations/${id}/messages/${message.id}/reaction`, { method: 'PUT', body: { emoji: current === emoji ? null : emoji } });
    await load();
  }

  if (!user) return <Screen back title="Messages"><Button label="Sign in" onPress={() => router.push('/auth')} /></Screen>;
  const chat = meta.data?.conversation;
  const other = chat?.kind === 'direct' ? chat.members.find((p) => p.id !== user.id) : undefined;
  const group = chat?.kind === 'group';
  const canSend = !!text.trim() || !!item;
  const nameOf = (userId: string) => chat?.members.find((p) => p.id === userId)?.name.split(' ')[0] ?? 'Someone';
  const typing = (live?.typing ?? []).filter((uid) => uid !== user.id);
  // "Seen" sits under your latest message while it's the last thing in the chat, as in Instagram DMs.
  const latest = messages.at(-1);
  const receipt = !pending.length && latest && latest.sender.id === user.id && !latest.deleted ? (() => {
    const seenBy = (live?.reads ?? []).filter((r) => r.sequence >= latest.sequence).map((r) => r.userId);
    if (!seenBy.length) return 'Sent';
    if (!group) return 'Seen';
    return seenBy.length >= (chat?.members.length ?? 1) - 1 ? 'Seen by everyone' : `Seen by ${seenBy.map(nameOf).join(', ')}`;
  })() : '';

  const composer = !meta.error && chat ? <View style={{ gap: space.sm }}>
    {newMessages && <Button label="New messages" icon="arrow-down" variant="tinted" size="sm" inline onPress={jumpToLatest} style={{ alignSelf: 'center' }} />}
    {!!selected && <View style={{ gap: space.sm, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 2, backgroundColor: c.elevated, borderRadius: radius.pill, padding: 4, ...curve }}>
        {REACTIONS.map((emoji) => {
          const chosen = selected.reactions?.some((r) => r.mine && r.emoji === emoji);
          return <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} accessibilityState={{ selected: chosen }} onPress={() => void run(() => react(selected, emoji))}
            style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: chosen ? c.accentSoft : 'transparent' }}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </Pressable>;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button label="Reply" icon="arrow-undo-outline" variant="secondary" size="sm" inline onPress={() => { setReplying(selected); setSelected(null); }} />
        {selected.sender.id === user.id
          ? <Button label="Remove" icon="trash-outline" variant="destructive" size="sm" inline onPress={() => void run(async () => { await api(`/conversations/${id}/messages/${selected.id}`, { method: 'DELETE' }); setSelected(null); await load(); })} />
          : <Button label="Report" icon="flag-outline" variant="secondary" size="sm" inline onPress={() => { setReason(''); setReporting(selected.id); setSelected(null); }} />}
        <Button label="Cancel" variant="plain" size="sm" inline onPress={() => setSelected(null)} />
      </View>
    </View>}
    {!!replying && <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.fill, borderRadius: radius.md, padding: space.sm, ...curve }}>
      <View style={{ flex: 1 }}><Quote sender={replying.sender.id === user.id ? 'Replying to yourself' : `Replying to ${replying.sender.name}`} text={quoteText(replying)} ink={c.text} accent={c.accent} /></View>
      <IconButton icon="close" label="Cancel reply" size={32} filled={false} tone="secondary" onPress={() => setReplying(null)} />
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
          multiline numberOfLines={Platform.OS === 'web' ? 1 : undefined} maxLength={2000} accessibilityLabel="Message" onSubmitEditing={send} blurOnSubmit={false} onBlur={() => signalTyping(false)}
          // A multiline box never submits on the web, so Enter sends there and Shift+Enter adds a line.
          onKeyPress={Platform.OS === 'web' ? (e) => { const key = e.nativeEvent as { key: string; shiftKey?: boolean }; if (key.key === 'Enter' && !key.shiftKey) { e.preventDefault(); send(); } } : undefined}
          style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 21, color: c.text, paddingVertical: 9, ...noOutline }} />
      </View>
      <Tap onPress={send} disabled={!canSend} accessibilityLabel="Send" scaleTo={0.9}
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
    {chat && snapshot?.key === key && !messages.length && !pending.length && !snapshot.error && <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl }}>
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
        <Bubble message={message} mine={message.sender.id === user.id} group={group} first={first} last={last} selected={selected?.id === message.id} viewerId={user.id}
          onLongPress={() => { haptic.select(); setSelected(message); }}
          onDoubleTap={() => void run(() => react(message, '❤️'))}
          onReact={(emoji) => void run(() => react(message, emoji))}
          onOpenItem={(pick) => { rememberItem(pick); router.push(`/item/${encodeURIComponent(pick.id)}`); }} />
      </View>;
    })}
    {!!receipt && <T v="caption" tone="secondary" style={{ alignSelf: 'flex-end', marginTop: 2, marginHorizontal: 6 }} accessibilityLiveRegion="polite">{receipt}</T>}
    {pending.map((message) => <View key={message.clientId} style={{ alignItems: 'flex-end', marginTop: space.sm }}>
      <View style={{ maxWidth: '78%', backgroundColor: c.accentFill, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, gap: 8, opacity: message.failed ? 0.55 : 0.8, ...curve }}>
        {!!message.replyTo && <Quote sender={message.replyTo.sender.id === user.id ? 'You' : message.replyTo.sender.name} text={quoteText(message.replyTo)} ink={c.onAccent} accent="rgba(0,0,0,0.35)" />}
        {!!message.item && <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 200 }}>
          <Artwork item={message.item} size={48} rounded={10} />
          <View style={{ flex: 1 }}><T v="callout" weight="semibold" numberOfLines={1} style={{ color: c.onAccent }}>{message.item.title}</T><T v="footnote" numberOfLines={1} style={{ color: c.onAccent, opacity: 0.75 }}>{message.item.artist}</T></View>
        </View>}
        {!!message.text && <T v="body" style={{ color: c.onAccent }}>{message.text}</T>}
      </View>
      {message.failed
        ? <Pressable accessibilityRole="button" accessibilityLabel="Not sent. Tap to try again" onPress={() => void deliver(message).catch(failed)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginHorizontal: 6, minHeight: 24 }}>
          <Ionicons name="alert-circle" size={14} color={c.danger} /><T v="caption" style={{ color: c.danger }}>Not sent · Tap to retry</T>
        </Pressable>
        : <T v="caption" tone="tertiary" style={{ marginTop: 3, marginHorizontal: 6 }}>Sending…</T>}
    </View>)}
    {typing.length > 0 && <Typing names={group ? typing.map(nameOf) : []} />}
    <View style={{ height: space.md }} />
    <MusicPicker spotifyConnected={false} visible={picking} onClose={() => setPicking(false)} title="Share a song" onPick={(pick) => { change(text, pick); setPicking(false); }} />
    <Dialog visible={!!reporting} title="Report this message?" description="Your report goes to moderation. You can also block this person from their profile." confirmLabel="Send report" busy={busy} onCancel={() => setReporting('')} onConfirm={() => void run(async () => { await api(`/conversations/${id}/messages/${reporting}/report`, { method: 'POST', body: { reason } }); setReporting(''); })}><TextField label="Reason for reporting" value={reason} onChangeText={setReason} multiline maxLength={300} placeholder="What should we review?" /></Dialog>
    <Dialog visible={leaving} title="Leave this group?" description="You will lose access to its messages. If you own the group, ownership passes to another member." confirmLabel="Leave group" destructive busy={busy} onCancel={() => setLeaving(false)} onConfirm={() => void run(async () => { await api(`/conversations/${id}/leave`, { method: 'POST' }); router.replace('/(tabs)/inbox'); })} />
  </Screen>;
}
export default function ThreadScreen() { const { user } = useApp(); const { id } = useLocalSearchParams<{ id: string }>(); return <Thread key={`${user?.id || 'guest'}:${id}`} />; }

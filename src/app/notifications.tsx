import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { displayDate } from '../lib/dates';
import { AppNotification } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Loading, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { Avatar, Button, Card, EmptyState, IconName, Ionicons, T } from '../ui/primitives';
import { space, useTheme } from '../ui/theme';

const kinds: Record<AppNotification['kind'], { icon: IconName; color: string; text: string }> = {
  reaction: { icon: 'heart', color: '#C63A22', text: 'agreed with your post' },
  comment: { icon: 'chatbubble', color: '#2F5F7A', text: 'commented on your post' },
  follow: { icon: 'person-add', color: '#2F7D4F', text: 'started following you' },
};

export default function Notifications() {
  const { c } = useTheme();
  const { user, setNotice, setUnread, refresh, refreshing } = useApp();
  const [notes, setNotes] = useState<AppNotification[]>([]), [loading, setLoading] = useState(true);
  const { busy, run } = useTask();
  const userId = user?.id;
  const load = useCallback((isActive: () => boolean = () => true) => api<{ notifications: AppNotification[] }>('/notifications')
    .then((result) => { if (isActive()) { setNotes(result.notifications); setUnread(result.notifications.filter((n) => !n.seen).length); } })
    .catch((e) => { if (isActive()) setNotice(errorMessage(e)); })
    .finally(() => { if (isActive()) setLoading(false); }), [setNotice, setUnread]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const isActive = () => active;
    void load(isActive); const timer = setInterval(() => void load(isActive), 30000);
    return () => { active = false; clearInterval(timer); };
  }, [userId, load]);
  const unseen = notes.some((n) => !n.seen);

  return <Screen back title="Activity" large onRefresh={() => { void load(); void refresh(); }} refreshing={refreshing}
    right={user && unseen ? <Button label="Mark all read" variant="plain" size="sm" inline disabled={busy} onPress={() => void run(async () => { await api('/notifications/read', { method: 'POST' }); setNotes((v) => v.map((n) => ({ ...n, seen: true }))); setUnread(0); })} /> : undefined}>
    {!user ? <Card><EmptyState icon="notifications-outline" title="Sign in to see activity" text="Reactions, comments, and new followers will show up here." action={<Button label="Sign in" inline onPress={() => router.push('/auth')} />} /></Card>
      : loading && !notes.length ? <Loading label="Loading activity…" />
      : !notes.length ? <Card><EmptyState icon="notifications-outline" title="All quiet for now" text="When people agree with, comment on, or follow you, it’ll show up here." /></Card>
      : <Card padded={false}>{notes.map((n, i) => {
        const kind = kinds[n.kind];
        return <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.name} ${kind.text}. ${displayDate(n.createdAt)}${n.seen ? '' : '. Unread'}`}
          onPress={() => n.postId ? router.push(`/ranking/${n.postId}`) : router.push(`/person/${n.handle.slice(1)}`)}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, pressed && { backgroundColor: c.fill }]}>
          <View>
            <Avatar name={n.name} seed={n.handle} size={44} />
            <View style={{ position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: kind.color, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
              <Ionicons name={kind.icon} size={11} color="#FFFFFF" />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="subhead"><T v="subhead" weight="semibold">{n.name}</T> {kind.text}.</T>
            <T v="caption" tone="secondary">{displayDate(n.createdAt)}</T>
          </View>
          {!n.seen && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} />}
        </Pressable>;
      })}</Card>}
  </Screen>;
}

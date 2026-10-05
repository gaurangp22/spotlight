import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { AppNotification } from '../lib/types';
import { displayDate } from '../lib/dates';
import { useApp } from '../store/AppContext';
import { Action, Header, Page } from '../ui/components';
import { F, useTask } from '../ui/forms';
import { C } from '../ui/theme';

export default function Notifications() {
  const { user, setNotice } = useApp();
  const [notes, setNotes] = useState<AppNotification[]>([]), [loading, setLoading] = useState(true);
  const { busy, run } = useTask();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => { try { const result = await api<{ notifications: AppNotification[] }>('/notifications'); if (active) setNotes(result.notifications); } catch (e) { if (active) setNotice(errorMessage(e)); } finally { if (active) setLoading(false); } };
    void load(); const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [userId, setNotice]);
  return <Page><Header title="Activity" back /><Text style={F.title}>The conversation continues.</Text>{!user ? <Action label="Sign in" onPress={() => router.push('/auth')} /> : <><View style={{ marginBottom: 20 }}><Action label="Mark all as read" secondary disabled={busy || !notes.some((n) => !n.seen)} onPress={() => void run(async () => { await api('/notifications/read', { method: 'POST' }); setNotes((v) => v.map((n) => ({ ...n, seen: true }))); })} /></View>{notes.map((n) => <Pressable accessibilityRole="button" key={n.id} style={{ padding: 18, marginBottom: 12, backgroundColor: n.seen ? C.white : C.soft, borderLeftWidth: n.seen ? 0 : 3, borderColor: C.accent }} onPress={() => n.postId ? router.push(`/ranking/${n.postId}`) : router.push(`/person/${n.handle.slice(1)}`)}><Text style={{ fontWeight: '800', color: C.ink, fontSize: 15 }}>{n.name} {n.kind === 'follow' ? 'started following you' : n.kind === 'comment' ? 'commented on your post' : 'reacted to your post'}.</Text><Text style={[F.note, { marginTop: 7 }]}>{displayDate(n.createdAt)}</Text></Pressable>)}{!notes.length && <Text style={F.note}>{loading ? 'Loading activity…' : 'Reactions, comments, and new followers will appear here.'}</Text>}</>}</Page>;
}

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Loading, RankingCard, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { Artwork, Button, Card, EmptyState, IconButton, Segmented, T } from '../ui/primitives';
import { useRemote } from '../ui/remote';
import { space } from '../ui/theme';

export default function Library() {
  const { user, savedItems, savedPostIds, toggleSavedItem, toggleSavedPost, rememberItem, refresh } = useApp();
  const [tab, setTab] = useState<'items' | 'posts'>('items'), { busy, run } = useTask();
  const { data, error, loading, reload } = useRemote<{ posts: Ranking[] }>('/library', !!user);
  if (!user) return <Screen back title="Your library"><Card><EmptyState icon="bookmark-outline" title="Keep the good finds" text="Sign in to save music and posts for later." action={<Button label="Sign in" onPress={() => router.push('/auth')} />} /></Card></Screen>;
  const posts = (data?.posts || []).filter((post) => savedPostIds.includes(post.id));
  return <Screen back title="Your library" large onRefresh={() => { reload(); void refresh(); }} refreshing={loading}>
    <T v="subhead" tone="secondary" style={{ marginBottom: space.lg }}>A private place for music to try and conversations to return to.</T>
    <Segmented value={tab} onChange={setTab} options={[{ value: 'items', label: 'Listen later' }, { value: 'posts', label: 'Saved posts' }]} style={{ marginBottom: space.xl }} />
    {tab === 'items' ? savedItems.length ? <View style={{ gap: space.md }}>{savedItems.map((item) => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => { rememberItem(item); router.push(`/item/${encodeURIComponent(item.id)}`); }} style={{ flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'center', minHeight: 60 }}><Artwork item={item} size={52} /><View style={{ flex: 1 }}><T v="headline" numberOfLines={2}>{item.title}</T><T v="caption" tone="secondary" numberOfLines={1}>{item.artist}</T></View></Pressable>
      <IconButton icon="bookmark" label={`Remove ${item.title} from Listen later`} size={48} disabled={busy} onPress={() => void run(() => toggleSavedItem(item))} />
    </View>)}</View> : <Card><EmptyState icon="musical-notes-outline" title="Your next listen starts here" text="Open a song, album, or artist and tap Listen later to save it." action={<Button label="Find music" variant="tinted" onPress={() => router.push('/(tabs)/discover')} />} /></Card>
      : error ? <Card><T tone="secondary">{error}</T><Button label="Try again" onPress={reload} /></Card> : loading && !data ? <Loading label="Loading saved posts…" /> : posts.length ? posts.map((post) => <View key={post.id}><RankingCard ranking={post} /><Button label="Remove saved post" size="md" variant="plain" disabled={busy} onPress={() => void run(async () => { await toggleSavedPost(post.id); reload(); })} /></View>) : <Card><EmptyState icon="bookmark-outline" title="Keep a conversation" text="Tap Save post on a post’s detail page. Saved posts still follow the author’s privacy settings." /></Card>}
  </Screen>;
}

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { RankingCard, Screen } from '../../ui/components';
import { Avatar, Button, Card, EmptyState, IconButton, ListGroup, ListRow, Segmented, T } from '../../ui/primitives';
import { space, useTheme } from '../../ui/theme';

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={{ flex: 1, alignItems: 'center', gap: 1 }} accessible accessibilityLabel={`${value} ${label}`}>
    <T v="title3" tabular>{value}</T><T v="caption" tone="secondary">{label}</T>
  </View>;
}

export default function ProfileScreen() {
  const { c } = useTheme();
  const { rankings, draft, moodDraft, archivedDrafts, openDraft, user, refresh, refreshing, unread } = useApp();
  const [tab, setTab] = useState<'posts' | 'drafts'>('posts');
  const hasDraft = draft.items.length > 0 || !!draft.title.trim();
  const hasMood = !!(moodDraft.title || moodDraft.tiles.length || moodDraft.items.length);
  const draftCount = (hasDraft ? 1 : 0) + (hasMood ? 1 : 0) + archivedDrafts.length;

  if (!user) return <Screen tab title="Profile" large right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}>
    <Card><EmptyState icon="person-circle-outline" title="Your taste, on record" text="Create an account to publish rankings, follow friends, and keep your music opinions in one place."
      action={<View style={{ gap: space.sm, alignSelf: 'stretch' }}><Button label="Create account" onPress={() => router.push('/auth')} /><Button label="Sign in" variant="plain" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} /></View>} /></Card>
    {hasDraft && <ListGroup header="On this device"><ListRow icon="create-outline" title={draft.title.trim() || 'Untitled ranking'} subtitle="Draft" onPress={() => router.push('/builder')} /></ListGroup>}
  </Screen>;

  return <Screen tab title={user.name} fadeTitle onRefresh={() => void refresh()} refreshing={refreshing}
    left={<IconButton icon="notifications-outline" label="Activity" badge={unread > 0} onPress={() => router.push('/notifications')} />}
    right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}>
    <View style={{ alignItems: 'center', paddingTop: space.sm }}>
      <Avatar name={user.name} seed={user.handle} size={92} />
      <T v="title1" center style={{ marginTop: space.md }}>{user.name}</T>
      <T v="subhead" tone="secondary">{user.handle}</T>
      {!!user.bio && <T v="body" center style={{ marginTop: space.sm, maxWidth: 360 }}>{user.bio}</T>}
    </View>
    <Card style={{ flexDirection: 'row', marginTop: space.xl, paddingVertical: space.md }}>
      <Stat value={rankings.length} label="Posts" />
      <View style={{ width: 1, backgroundColor: c.separator }} />
      <Stat value={user.followers ?? 0} label="Followers" />
      <View style={{ width: 1, backgroundColor: c.separator }} />
      <Stat value={user.following ?? 0} label="Following" />
    </Card>
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
      <Button label="Edit profile" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/settings')} />
      <Button label="New ranking" variant="tinted" size="md" icon="add" style={{ flex: 1 }} onPress={() => router.push('/(tabs)/create')} />
    </View>

    <Segmented value={tab} onChange={setTab} style={{ marginTop: space.xxl, marginBottom: space.lg }}
      options={[{ value: 'posts', label: `Posts${rankings.length ? ` · ${rankings.length}` : ''}` }, { value: 'drafts', label: `Drafts${draftCount ? ` · ${draftCount}` : ''}` }]} />

    {tab === 'posts' ? (rankings.length ? rankings.map((ranking) => <RankingCard ranking={ranking} key={ranking.id} />)
      : <Card><EmptyState icon="list" title="Your shelf starts here" text="Rank five songs you love. Even a private ranking belongs to you."
        action={<Button label="Create your first ranking" inline onPress={() => router.push('/builder')} />} /></Card>)
      : draftCount ? <ListGroup style={{ marginTop: 0 }} footer="Drafts save automatically on this device and aren’t visible to anyone else.">
        {hasDraft && <ListRow icon="create-outline" title={draft.title.trim() || 'Untitled ranking'} subtitle={`Current draft · ${draft.items.length} picks`} onPress={() => router.push('/builder')} />}
        {hasMood && <ListRow icon="images-outline" iconColor="#4E3A78" title={moodDraft.title.trim() || 'Untitled mood board'} subtitle="Mood board draft" onPress={() => router.push('/moodboard')} />}
        {archivedDrafts.map((entry) => <ListRow key={entry.id} icon="document-text-outline" iconColor="#6B6862" title={entry.draft.title.trim() || 'Untitled ranking'} subtitle={`${entry.draft.items.length} picks`} onPress={() => { openDraft(entry.id); router.push('/builder'); }} />)}
      </ListGroup> : <Card><EmptyState icon="document-text-outline" title="No drafts" text="Anything you start but don’t publish is kept here." /></Card>}
  </Screen>;
}

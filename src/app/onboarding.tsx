import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { InviteCard } from '../ui/invite';
import { Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { MusicPicker } from '../ui/MusicPicker';
import { Avatar, Button, Card, IconButton, T } from '../ui/primitives';
import { space } from '../ui/theme';

export default function Onboarding() {
  const { user, people, posts, ratings, following, toggleFollow, completeOnboarding, rememberItem, spotifyConnected } = useApp();
  const [step, setStep] = useState(0), [artists, setArtists] = useState<MusicItem[]>(user?.favoriteArtists || []), [picking, setPicking] = useState(false);
  const { busy, run } = useTask();
  const artistNames = artists.map((item) => item.title.toLowerCase());
  const suggestions = people.filter((person) => person.id !== user?.id).map((person) => ({ person, shared: posts.filter((post) => post.userId === person.id && post.items.some((item) => artistNames.some((name) => item.artist.toLowerCase().includes(name)))).length })).sort((a, b) => b.shared - a.shared).slice(0, 8);
  const picks = [...new Map(posts.flatMap((post) => post.items).filter((item) => ['song', 'album'].includes(item.kind) && !ratings.some((rating) => rating.item.id === item.id)).map((item) => [item.id, item])).values()].slice(0, 5);
  const finish = async () => { await completeOnboarding(artists); if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); };
  if (!user) return <Screen back title="Your music profile"><Card><T v="headline">Create your account first.</T><Button label="Create account" onPress={() => router.push('/auth')} /></Card></Screen>;
  return <Screen back title="Find your people" footer={<View style={{ gap: space.sm }}>
    <Button label={step === 2 ? 'Start exploring' : 'Continue'} loading={busy} onPress={() => void run(async () => { if (step === 2) await finish(); else { await completeOnboarding(artists, false); setStep(step + 1); } })} />
    <Button label="Finish later" variant="plain" size="md" disabled={busy} onPress={() => void run(finish)} />
  </View>}>
    <T v="caption" tone="secondary" style={{ marginBottom: space.sm }}>Step {step + 1} of 3</T>
    <T v="largeTitle">{['Who’s always in your rotation?', 'Put your taste on record.', 'Bring your people closer.'][step]}</T>
    <T v="body" tone="secondary" style={{ marginTop: space.md, marginBottom: space.xl }}>{['Choose up to eight favourite artists. You can change them later in Settings.', 'Rate three songs or albums to unlock taste matches. Ratings express your opinion; they don’t imply listening history.', 'Follow a few listeners to fill your Following feed. These suggestions use the music people actually posted.'][step]}</T>
    {step === 0 ? <>
      <View style={{ gap: space.md }}>{artists.map((item) => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><T v="headline" style={{ flex: 1 }}>{item.title}</T><IconButton label={`Remove ${item.title}`} icon="close" size={48} onPress={() => setArtists((list) => list.filter((pick) => pick.id !== item.id))} /></View>)}</View>
      <Button label={artists.length ? 'Add another artist' : 'Choose artists'} icon="add" variant="secondary" disabled={artists.length >= 8} onPress={() => setPicking(true)} style={{ marginTop: space.lg }} />
      <MusicPicker visible={picking} onClose={() => setPicking(false)} selected={artists} limit={8} kinds={['artist']} title="Your favourite artists" spotifyConnected={spotifyConnected} onToggle={(item) => setArtists((list) => list.some((pick) => pick.id === item.id) ? list.filter((pick) => pick.id !== item.id) : [...list, item].slice(0, 8))} />
    </> : step === 1 ? <>
      <T v="headline" style={{ marginBottom: space.lg }}>{Math.min(ratings.length, 3)} of 3 starter ratings</T>
      <View style={{ gap: space.md }}>{picks.map((item) => <Button key={item.id} label={`Rate ${item.title}`} variant="secondary" onPress={() => { rememberItem(item); router.push({ pathname: '/rate', params: { itemId: item.id } }); }} />)}</View>
      <Button label="Search for my favourites" variant="plain" onPress={() => router.push('/rate')} />
    </> : <View style={{ gap: space.lg }}>{suggestions.length ? suggestions.map(({ person }) => <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.name}'s profile`} onPress={() => router.push(`/person/${person.handle.slice(1)}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}><Avatar name={person.name} seed={person.handle} uri={person.avatar} size={44} /><View style={{ flex: 1 }}><T v="headline" numberOfLines={1}>{person.name}</T><T v="caption" tone="secondary">{person.handle}</T></View></Pressable>
      <Button label={following.includes(person.handle) ? 'Following' : 'Follow'} variant="secondary" size="sm" disabled={busy} onPress={() => void run(() => toggleFollow(person.handle))} />
    </View>) : <><T tone="secondary">Your community is just getting started. Invite the friends whose taste you trust — they’ll follow you when they join.</T><InviteCard compact /></>}</View>}
  </Screen>;
}

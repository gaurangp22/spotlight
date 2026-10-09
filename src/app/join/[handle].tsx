import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { rememberInvite } from '../../lib/invite';
import { Profile } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { goBack, Loading, Screen } from '../../ui/components';
import { FavoriteArtists, MatchCard, StatusBubble } from '../../ui/equals';
import { useTask } from '../../ui/forms';
import { haptic } from '../../ui/haptics';
import { Avatar, Button, Card, EmptyState, IconButton, T } from '../../ui/primitives';
import { space } from '../../ui/theme';

/** Where an invite link lands in the app: who invited you, and one clear next step. */
export default function JoinScreen() {
  const { handle = '' } = useLocalSearchParams<{ handle: string }>();
  const { user, following, toggleFollow } = useApp();
  const [inviter, setInviter] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const { busy, run } = useTask();
  useEffect(() => {
    let active = true;
    api<{ inviter: Profile }>(`/invites/${encodeURIComponent(handle.toLowerCase())}`)
      .then((r) => { if (active) setInviter(r.inviter); })
      .catch((e) => { if (active) setError(errorMessage(e)); });
    // Kept until signup, even if they look around first.
    void rememberInvite(handle);
    return () => { active = false; };
  }, [handle]);
  const close = <IconButton icon="close" label="Close" onPress={() => (router.canGoBack() ? goBack() : router.replace('/'))} size={36} />;

  if (error) return <Screen left={close} title="Invite"><Card style={{ marginTop: space.xl }}><EmptyState icon="link-outline" title="This invite isn’t valid any more" text="You can still join Riffs and find your friends in Discover."
    action={<Button label={user ? 'Go to Riffs' : 'Join Riffs'} inline onPress={() => router.replace(user ? '/' : '/auth')} />} /></Card></Screen>;
  if (!inviter) return <Screen left={close} title="Invite"><Loading label="Opening your invite…" /></Screen>;

  const self = user?.id === inviter.id;
  const followed = following.includes(inviter.handle);
  const firstName = inviter.name.split(/\s+/)[0];
  return <Screen left={close} title="Invite"
    footer={self ? <Button label="Back to my profile" variant="secondary" onPress={() => router.replace('/(tabs)/profile')} />
      : user ? <Button label={followed ? `See ${firstName}’s profile` : `Follow ${firstName}`} icon={followed ? 'person' : 'person-add'} loading={busy}
        onPress={() => void run(async () => { if (!followed) { await toggleFollow(inviter.handle); haptic.success(); } router.replace(`/person/${inviter.handle.slice(1)}`); })} />
      : <View style={{ gap: space.sm }}>
        <Button label="Join Riffs" icon="sparkles" onPress={() => router.push('/auth')} />
        <Button label="I already have an account" variant="plain" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} />
      </View>}>
    <View style={{ alignItems: 'center', paddingTop: space.xl }}>
      <T v="overline" tone="accent">{self ? 'Your invite link' : 'You’re invited'}</T>
      <View style={{ marginTop: space.lg }}><StatusBubble status={inviter.status} /></View>
      <Avatar name={inviter.name} seed={inviter.handle} uri={inviter.avatar} size={96} />
      <T v="title1" center style={{ marginTop: space.md }}>{self ? 'This is what friends see' : `${inviter.name} wants you on Riffs`}</T>
      <T v="subhead" tone="secondary">{inviter.handle}</T>
      {!!inviter.bio && <T v="body" center style={{ marginTop: space.sm, maxWidth: 360 }}>{inviter.bio}</T>}
    </View>
    <FavoriteArtists items={inviter.favoriteArtists} />
    {user && !self && <MatchCard handle={inviter.handle} />}
    <Card style={{ marginTop: space.xl, gap: space.sm }}>
      <T v="headline">{self ? 'Share it with friends' : 'What happens next'}</T>
      <T v="subhead" tone="secondary">{self
        ? 'When someone joins with your link, they follow you automatically and you get a heads-up so you can follow back.'
        : user ? `Follow ${firstName} to see their ratings and hot takes in your Following feed.`
        : `Make an account and you’ll follow ${firstName} automatically. Rate a few albums and Riffs shows how close your taste is.`}</T>
    </Card>
  </Screen>;
}

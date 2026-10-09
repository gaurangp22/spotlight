import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';
import { inviteLink, shareLink } from '../lib/links';
import { Profile } from '../lib/types';
import { useApp } from '../store/AppContext';
import { useTask } from './forms';
import { haptic } from './haptics';
import { Button, Card, Ionicons, T } from './primitives';
import { radius, space, useTheme } from './theme';

/** Shares your personal invite link; signed-out people are sent to sign up first. */
export function useInvite() {
  const { user, setNotice } = useApp();
  const { busy, run } = useTask();
  const invite = () => {
    if (!user) { router.push('/auth'); return; }
    void run(async () => {
      const result = await shareLink('Come rate music with me on Riffs — hot takes, polls, and we can see how close our taste is.', inviteLink(user.handle));
      if (result === 'copied') setNotice('Invite link copied. Paste it to a friend.');
      if (result !== 'dismissed') haptic.success();
    });
  };
  return { invite, busy };
}

/** How many people joined with your link, for a little encouragement. */
export function useInvitedCount() {
  const { user } = useApp();
  const userId = user?.id;
  const [joined, setJoined] = useState<{ owner: string; people: Profile[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    api<{ joined: Profile[] }>('/me/invites').then((r) => { if (active) setJoined({ owner: userId, people: r.joined }); }).catch(() => {});
    return () => { active = false; };
  }, [userId]);
  return joined && joined.owner === userId ? joined.people.length : null;
}

/** A nudge to bring friends in: Riffs is only as good as the people you follow. */
export function InviteCard({ compact = false }: { compact?: boolean }) {
  const { c } = useTheme();
  const { invite, busy } = useInvite();
  const joined = useInvitedCount();
  return <Card style={{ marginTop: space.lg, gap: space.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="people" size={20} color={c.accent} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">Bring your people</T>
        <T v="footnote" tone="secondary">{joined ? `${joined} ${joined === 1 ? 'friend has' : 'friends have'} joined with your link.` : compact ? 'Riffs is better with friends.' : 'Riffs is better when your friends are here. They’ll follow you when they join.'}</T>
      </View>
    </View>
    <Button label="Invite friends" icon="share-social" size="md" loading={busy} onPress={invite} />
  </Card>;
}

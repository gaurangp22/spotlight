import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, errorMessage } from '../../lib/api';
import { Profile, Ranking } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Action, Header, Page, RankingPreview } from '../../ui/components';
import { Confirm, F, useTask } from '../../ui/forms';

export default function Person() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { user, following, toggleFollow, blockUser } = useApp();
  const [data, setData] = useState<{ user: Profile; posts: Ranking[] } | null>(null), [error, setError] = useState('');
  const [blocking, setBlocking] = useState(false);
  const { busy, run } = useTask();
  useEffect(() => { let active = true; api<{ user: Profile; posts: Ranking[] }>(`/people/${encodeURIComponent(handle)}`).then((v) => { if (active) setData(v); }).catch((e) => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, [handle, following]);
  return <Page><Header title="Music person" back />{error ? <Text style={[F.note, { marginTop: 30 }]}>{error}</Text> : !data ? <Text style={[F.note, { marginTop: 30 }]}>Loading profile…</Text> : <><Text style={F.title}>{data.user.name}</Text><Text style={F.label}>{data.user.handle}</Text><Text style={[F.note, { marginTop: 15 }]}>{data.user.bio || 'Music, in their own order.'}</Text><Text style={[F.note, { marginVertical: 18 }]}>{data.user.followers} followers · {data.user.following} following</Text>{user?.id !== data.user.id && <View style={{ gap: 10, marginBottom: 24 }}><Action label={following.includes(data.user.handle) ? 'Following · unfollow' : 'Follow'} disabled={busy} onPress={() => user ? void run(() => toggleFollow(data.user.handle)) : router.push('/auth')} /><Action label="Block this person" secondary onPress={() => user ? setBlocking(true) : router.push('/auth')} /></View>}{data.posts.map((p) => <RankingPreview key={p.id} ranking={p} />)}{!data.posts.length && <Text style={F.note}>No posts you can view yet.</Text>}<Confirm visible={blocking} title="Block this person?" description="You’ll stop following each other and won’t see each other’s posts or comments. You can unblock them in Settings." busy={busy} onCancel={() => setBlocking(false)} onConfirm={() => void run(async () => { await blockUser(data.user.handle); setBlocking(false); router.replace('/(tabs)/discover'); })} /></>}</Page>;
}

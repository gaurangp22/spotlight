import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Loading, Screen, ScoreBadge } from '../ui/components';
import { Artwork, Button, Card, EmptyState, Ionicons, Segmented, T } from '../ui/primitives';
import { space, useTheme } from '../ui/theme';

type Range = 'short_term' | 'medium_term' | 'long_term';

/** Your most-played songs and artists on Spotify: tap one to rate it, or rank the lot. */
export default function SpotifyTop() {
  const { c } = useTheme();
  const { user, spotifyConnected, rememberItem, ratingFor, startDraft, setDraft } = useApp();
  const [type, setType] = useState<'tracks' | 'artists'>('tracks');
  const [range, setRange] = useState<Range>('medium_term');
  const key = `${type}:${range}`;
  const [result, setResult] = useState<{ key: string; items: MusicItem[]; error: string }>({ key: '', items: [], error: '' });
  const ready = !!user && spotifyConnected;
  useEffect(() => {
    if (!ready) return;
    let active = true;
    api<{ items: MusicItem[] }>(`/spotify/top?type=${type}&range=${range}`)
      .then((data) => { if (active) setResult({ key, items: data.items, error: '' }); })
      .catch((e) => { if (active) setResult({ key, items: [], error: errorMessage(e) }); });
    return () => { active = false; };
  }, [ready, key, type, range]);
  const fresh = result.key === key;
  const rankThem = () => {
    startDraft();
    setDraft((d) => ({ ...d, title: type === 'tracks' ? 'My most-played songs, re-ranked' : 'My most-played artists, re-ranked', items: result.items.slice(0, 25) }));
    router.replace('/builder');
  };

  return <Screen back title="Your top music" large subtitle={ready ? 'Straight from your Spotify listening. Tap anything to rate it.' : undefined}
    footer={ready && fresh && result.items.length > 1 ? <Button label={`Rank your top ${Math.min(25, result.items.length)}`} icon="list" onPress={rankThem} /> : undefined}>
    {!ready ? <Card><EmptyState icon="musical-notes" title="Connect Spotify" text="Link your Spotify account in Settings to see your most-played music." action={<Button label="Open Settings" inline onPress={() => router.push('/settings')} />} /></Card> : <>
      <Segmented value={type} onChange={setType} options={[{ value: 'tracks', label: 'Songs' }, { value: 'artists', label: 'Artists' }]} />
      <Segmented value={range} onChange={setRange} style={{ marginTop: space.sm }} options={[{ value: 'short_term', label: '4 weeks' }, { value: 'medium_term', label: '6 months' }, { value: 'long_term', label: 'All time' }]} />
      {!fresh ? <Loading label="Asking Spotify…" />
        : result.error ? <Card style={{ marginTop: space.lg, gap: space.md }}><T v="subhead" tone="secondary">{result.error}</T>{/Reconnect/.test(result.error) && <Button label="Open Settings" variant="secondary" onPress={() => router.push('/settings')} />}</Card>
        : !result.items.length ? <Card style={{ marginTop: space.lg }}><EmptyState icon="headset-outline" title="Not enough listening yet" text="Spotify needs a little more history for this period. Try a longer one." /></Card>
        : <Card padded={false} style={{ marginTop: space.lg }}>{result.items.map((item, i) => {
          const mine = ratingFor(item.id);
          return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Rate ${item.title}`}
            onPress={() => { rememberItem(item); router.push({ pathname: '/rate', params: { itemId: item.id } }); }}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, pressed && { backgroundColor: c.fill }]}>
            <T v="headline" tabular tone="secondary" style={{ width: 24 }} center>{i + 1}</T>
            <Artwork item={item} size={44} rounded={item.kind === 'artist' ? 22 : undefined} />
            <View style={{ flex: 1 }}><T v="callout" weight="semibold" numberOfLines={1}>{item.title}</T><T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}</T></View>
            {mine ? <ScoreBadge score={mine.score} size={32} /> : <Ionicons name="star-outline" size={18} color={c.tertiary} />}
          </Pressable>;
        })}</Card>}
    </>}
  </Screen>;
}

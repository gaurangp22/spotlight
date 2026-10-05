import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Ranking } from '../lib/types';
import { curve, font, radius, space } from './theme';

export const MOOD_THEMES = {
  night: { label: 'Night', bg: '#1E2222', fg: '#F5F2EA', tile: '#2E3433' },
  paper: { label: 'Paper', bg: '#E9E2D6', fg: '#1C1B19', tile: '#F8F4EC' },
  rose: { label: 'Rose', bg: '#EBC9C3', fg: '#5A2427', tile: '#F5DDD9' },
  forest: { label: 'Forest', bg: '#2F4539', fg: '#F2ECD8', tile: '#435E4E' },
};

export function MoodGrid({ post, compact = false }: { post: Pick<Ranking, 'items' | 'tiles' | 'theme'>; compact?: boolean }) {
  const theme = MOOD_THEMES[post.theme || 'night'];
  const tiles = [...post.items.map((i) => ({ id: i.id, type: 'music' as const, uri: i.artwork, text: `${i.title}\n${i.artist}` })), ...(post.tiles || [])];
  const visible = tiles.slice(0, compact ? 4 : 112);
  return <View style={[styles.board, { backgroundColor: theme.bg }, compact && { marginTop: space.lg }]}>
    {!tiles.length && <View style={{ padding: space.lg, gap: 6 }}>
      <Text style={{ color: theme.fg, fontSize: 20, fontFamily: font.bold, letterSpacing: -0.4 }}>Your world starts here.</Text>
      <Text style={{ color: theme.fg, opacity: 0.8, fontSize: 14, lineHeight: 20, fontFamily: font.regular }}>Add music, a photo, or a note to see your board take shape.</Text>
    </View>}
    {visible.map((t) => <View key={t.id} style={[styles.tile, { backgroundColor: theme.tile }]}>
      {t.uri && <Image source={{ uri: t.uri }} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" transition={150} accessibilityLabel={t.text || 'Mood board photo'} />}
      {!!t.text && <Text numberOfLines={compact ? 2 : undefined} style={[styles.caption, { color: theme.fg, fontFamily: t.type === 'note' ? font.bold : font.medium, fontSize: t.type === 'note' ? (compact ? 15 : 19) : 12, lineHeight: t.type === 'note' ? (compact ? 19 : 24) : 16 }]}>{t.text}</Text>}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  board: { padding: 8, marginTop: space.lg, flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderRadius: radius.lg, overflow: 'hidden', ...curve },
  tile: { width: '47%', flexGrow: 1, overflow: 'hidden', justifyContent: 'center', minHeight: 96, borderRadius: radius.sm, ...curve },
  caption: { padding: 10, letterSpacing: -0.2 },
});

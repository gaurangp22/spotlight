import { Image, StyleSheet, Text, View } from 'react-native';
import { Ranking } from '../lib/types';
import { C } from './theme';

export const MOOD_THEMES = { night: { bg: C.night, fg: C.white, tile: '#404746' }, paper: { bg: '#E7DED0', fg: C.ink, tile: '#FFFDF7' }, rose: { bg: '#E9C6C1', fg: '#5F292B', tile: '#F4DCD8' }, forest: { bg: '#344A3F', fg: '#F4EDD9', tile: '#4D6756' } };
export function MoodGrid({ post, compact = false }: { post: Pick<Ranking, 'items' | 'tiles' | 'theme'>; compact?: boolean }) {
  const theme = MOOD_THEMES[post.theme || 'night'];
  const tiles = [...post.items.map((i) => ({ id: i.id, type: 'music' as const, uri: i.artwork, text: `${i.title}\n${i.artist}` })), ...(post.tiles || [])];
  return <View style={[styles.board, { backgroundColor: theme.bg }]}>{!tiles.length && <View style={{ padding: 22, gap: 8 }}><Text style={{ color: theme.fg, fontSize: 22, fontWeight: '800' }}>Your world starts here.</Text><Text style={{ color: theme.fg, fontSize: 13, lineHeight: 20 }}>Add music, a photo, or a note to see your board take shape.</Text></View>}{tiles.slice(0, compact ? 4 : 112).map((t) => <View key={t.id} style={[styles.tile, { backgroundColor: theme.tile }]}>{t.uri && <Image source={{ uri: t.uri }} style={{ width: '100%', aspectRatio: 1 }} accessibilityLabel={t.text || 'Mood board photo'} />}{!!t.text && <Text numberOfLines={compact ? 3 : undefined} style={[styles.caption, { color: theme.fg, fontSize: t.type === 'note' ? 21 : 13, lineHeight: t.type === 'note' ? 26 : 20 }]}>{t.text}</Text>}</View>)}</View>;
}
const styles = StyleSheet.create({ board: { padding: 12, marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, tile: { width: '48%', flexGrow: 1, overflow: 'hidden', justifyContent: 'center', minHeight: 100 }, caption: { padding: 12, fontWeight: '800', lineHeight: 24 } });

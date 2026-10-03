import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { compareRankings } from '../lib/compare';
import { useApp } from '../store/AppContext';
import { Artwork, Eyebrow, Header, Page } from '../ui/components';
import { C } from '../ui/theme';

export default function CompareScreen() {
  const { left, right } = useLocalSearchParams<{ left: string; right: string }>();
  const { allRankings } = useApp();
  const mine = allRankings.find((entry) => entry.id === left);
  const theirs = allRankings.find((entry) => entry.id === right);
  if (!mine || !theirs) return <Page><Header title="Taste comparison" back /><Text style={styles.missing}>Both rankings need to be on this device.</Text></Page>;
  const comparison = compareRankings(mine.items, theirs.items);
  return <Page>
    <Header title="Taste comparison" back />
    <View style={styles.hero}><Eyebrow light>YOUR TWO TAKES</Eyebrow><Text style={styles.names}>{mine.author} <Text style={{ color: C.accent }}>×</Text> {theirs.author}</Text><View style={styles.scoreRow}><Text style={styles.score}>{comparison.agreement}%</Text><Text style={styles.scoreLabel}>IN THE SAME ORDER</Text></View><Text style={styles.heroNote}>A playful measure of how closely your shared picks line up.</Text></View>
    <View style={styles.titleBlock}><Text style={styles.title}>{mine.title}</Text><Text style={styles.overlap}>{comparison.common} SHARED PICKS</Text></View>
    <View style={styles.columns}><Text style={styles.columnLabel}>{mine.author.toUpperCase()}</Text><Text style={styles.columnLabel}>{theirs.author.toUpperCase()}</Text></View>
    {Array.from({ length: Math.max(mine.items.length, theirs.items.length) }, (_, index) => <View key={index} style={styles.row}>{[mine.items[index], theirs.items[index]].map((item, side) => <View key={side} style={styles.cell}>{item && <><Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text><Artwork item={item} size={33} /><Text style={styles.item} numberOfLines={2}>{item.title}</Text></>}</View>)}</View>)}
    {comparison.biggest && <View style={styles.disagreement}><Eyebrow>YOUR BIGGEST SPLIT</Eyebrow><Text style={styles.disagreeTitle}>{comparison.biggest.title}</Text><Text style={styles.disagreeDetail}>{mine.author}: #{mine.items.findIndex((item) => item.id === comparison.biggest?.id) + 1}  ·  {theirs.author}: #{theirs.items.findIndex((item) => item.id === comparison.biggest?.id) + 1}</Text></View>}
    <Pressable accessibilityRole="button" onPress={() => router.push(`/share/${mine.id}`)} style={styles.share}><Text style={styles.shareText}>Share your ranking card</Text><MaterialCommunityIcons name="arrow-right" size={22} color={C.white} /></Pressable>
  </Page>;
}

const styles = StyleSheet.create({
  missing: { marginTop: 25, color: C.muted }, hero: { backgroundColor: C.night, marginHorizontal: -20, paddingHorizontal: 22, paddingTop: 31, paddingBottom: 28 }, names: { color: C.white, fontSize: 34, fontWeight: '900', letterSpacing: -1.3, marginTop: 10 }, scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 27 }, score: { color: C.white, fontSize: 74, fontWeight: '900', letterSpacing: -3.5 }, scoreLabel: { color: C.cream, fontSize: 11, fontWeight: '900', letterSpacing: 1, flex: 1 }, heroNote: { color: C.cream, fontSize: 12, lineHeight: 17, marginTop: 4 },
  titleBlock: { paddingTop: 24, paddingBottom: 22 }, title: { color: C.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 }, overlap: { color: C.muted, marginTop: 9, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  columns: { flexDirection: 'row', borderTopWidth: 2, borderColor: C.ink, paddingVertical: 13 }, columnLabel: { width: '50%', color: C.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, row: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, minHeight: 55 }, cell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 6 }, number: { color: C.accent, fontSize: 11, fontWeight: '900' }, item: { flex: 1, color: C.ink, fontSize: 11, fontWeight: '800' },
  disagreement: { backgroundColor: C.soft, padding: 18, marginTop: 27 }, disagreeTitle: { color: C.ink, fontSize: 24, fontWeight: '900', marginTop: 10 }, disagreeDetail: { color: C.muted, marginTop: 7, fontSize: 13 },
  share: { minHeight: 52, backgroundColor: C.accent, marginTop: 25, paddingHorizontal: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, shareText: { color: C.white, fontSize: 14, fontWeight: '900' },
});

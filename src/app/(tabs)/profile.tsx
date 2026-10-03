import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Action, Eyebrow, Page, RankingPreview } from '../../ui/components';
import { C } from '../../ui/theme';

export default function ProfileScreen() {
  const { rankings, draft, archivedDrafts, openDraft } = useApp();
  return <Page>
    <View style={styles.cover}><Text style={styles.coverWord}>M</Text><View style={styles.coverBottom}><Eyebrow light>YOUR RECORD SHELF</Eyebrow><Text style={styles.name}>You, in music.</Text></View></View>
    <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>Y</Text></View><View><Text style={styles.handle}>@you</Text><Text style={styles.note}>Your taste is taking shape.</Text></View></View>
    <View style={styles.divider}><Text style={styles.section}>YOUR RANKINGS</Text><Text style={styles.count}>{String(rankings.length).padStart(2, '0')}</Text></View>
    {rankings.length ? rankings.map((ranking) => <RankingPreview ranking={ranking} key={ranking.id} />) : <View style={styles.empty}><MaterialCommunityIcons name="format-list-numbered" size={31} color={C.accent} /><Text style={styles.emptyTitle}>Your shelf starts here.</Text><Text style={styles.emptyText}>Rank five songs you love. Even a private ranking belongs to you.</Text><Action label="Create your first ranking" onPress={() => router.push('/builder')} /></View>}
    {(draft.items.length > 0 || !!draft.title.trim()) && <Pressable accessibilityRole="button" style={styles.draft} onPress={() => router.push('/builder')}><Text style={styles.draftText}>DRAFT · {draft.title || 'Untitled ranking'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color={C.accent} /></Pressable>}
    {archivedDrafts.map((entry) => <Pressable accessibilityRole="button" key={entry.id} style={styles.draft} onPress={() => { openDraft(entry.id); router.push('/builder'); }}><Text style={[styles.draftText, { flex: 1 }]} numberOfLines={2}>DRAFT · {entry.draft.title || 'Untitled ranking'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color={C.accent} /></Pressable>)}
    <Text style={styles.localNote}>PROTOTYPE · Your rankings are stored on this device.</Text>
  </Page>;
}

const styles = StyleSheet.create({
  cover: { height: 210, backgroundColor: C.night, marginHorizontal: -20, paddingHorizontal: 22, overflow: 'hidden', justifyContent: 'flex-end' }, coverWord: { position: 'absolute', right: -12, top: -90, color: '#3E4544', fontSize: 310, fontWeight: '900', letterSpacing: -25 }, coverBottom: { paddingBottom: 23 }, name: { color: C.white, fontSize: 35, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4, marginTop: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 20 }, avatar: { width: 56, height: 56, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderRadius: 28 }, avatarText: { color: C.white, fontSize: 25, fontWeight: '900' }, handle: { color: C.ink, fontSize: 17, fontWeight: '900' }, note: { color: C.muted, fontSize: 12, marginTop: 4 },
  divider: { borderTopWidth: 2, borderColor: C.ink, paddingTop: 15, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 18 }, section: { color: C.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 }, count: { color: C.accent, fontWeight: '900' },
  empty: { backgroundColor: C.soft, padding: 22, gap: 13 }, emptyTitle: { color: C.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.5 }, emptyText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  draft: { paddingVertical: 19, borderTopWidth: 1, borderColor: C.line, flexDirection: 'row', justifyContent: 'space-between' }, draftText: { color: C.ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  localNote: { color: C.muted, fontSize: 10, letterSpacing: 0.7, fontWeight: '700', marginTop: 30, marginBottom: 16 },
});

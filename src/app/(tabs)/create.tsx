import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Eyebrow, Page } from '../../ui/components';
import { C } from '../../ui/theme';

export default function CreateScreen() {
  const { draft, moodDraft, startDraft } = useApp();
  return <Page>
    <View style={styles.header}><Eyebrow>MAKE SOMETHING</Eyebrow><Text style={styles.title}>Put it <Text style={{ color: C.accent }}>out there.</Text></Text><Text style={styles.sub}>Start with the music. The order is your point of view.</Text></View>
    <Pressable accessibilityRole="button" style={styles.option} onPress={() => { startDraft(); router.push('/builder'); }}><Text style={styles.number}>01</Text><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Ranking</Text><Text style={styles.optionSub}>Put songs or albums in your order.</Text></View><MaterialCommunityIcons name="arrow-top-right" size={27} color={C.accent} /></Pressable>
    <Pressable accessibilityRole="button" style={styles.option} onPress={() => { startDraft(); router.push({ pathname: '/builder', params: { mode: 'battle' } }); }}><Text style={styles.number}>02</Text><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Battle Mode</Text><Text style={styles.optionSub}>Choose music, then pick your winners.</Text></View><MaterialCommunityIcons name="arrow-top-right" size={27} color={C.accent} /></Pressable>
    {(draft.items.length > 0 || !!draft.title.trim()) && <Pressable accessibilityRole="button" style={styles.continue} onPress={() => router.push('/builder')}><View><Text style={styles.continueTitle}>Keep working on your draft</Text><Text style={styles.continueSub}>{draft.items.length} picks saved</Text></View><MaterialCommunityIcons name="arrow-right" size={22} color={C.white} /></Pressable>}
    <Pressable accessibilityRole="button" style={styles.option} onPress={() => router.push('/moodboard')}><Text style={styles.number}>03</Text><View style={{ flex: 1 }}><Text style={styles.optionTitle}>Mood board</Text><Text style={styles.optionSub}>Bring together songs, photos, and notes.</Text></View><MaterialCommunityIcons name="arrow-top-right" size={27} color={C.accent} /></Pressable>
    {!!(moodDraft.title || moodDraft.tiles.length || moodDraft.items.length) && <Pressable accessibilityRole="button" style={styles.continue} onPress={() => router.push('/moodboard')}><View style={{ flex: 1 }}><Text style={styles.continueTitle}>Continue your mood board</Text><Text style={styles.continueSub} numberOfLines={1}>{moodDraft.title || 'Untitled mood board'}</Text></View><MaterialCommunityIcons name="arrow-right" size={22} color={C.white} /></Pressable>}
  </Page>;
}

const styles = StyleSheet.create({
  header: { paddingTop: 38, paddingBottom: 28 }, title: { color: C.ink, fontWeight: '900', fontSize: 42, lineHeight: 44, letterSpacing: -1.8, marginTop: 10 }, sub: { color: C.muted, fontSize: 15, lineHeight: 21, marginTop: 15 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 15, minHeight: 106, borderTopWidth: 2, borderColor: C.ink }, number: { color: C.accent, fontSize: 13, fontWeight: '900', alignSelf: 'flex-start', marginTop: 27 },
  optionTitle: { color: C.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.7 }, optionSub: { color: C.muted, fontSize: 12, marginTop: 5 },
  continue: { marginTop: 24, minHeight: 70, backgroundColor: C.night, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, continueTitle: { color: C.white, fontSize: 15, fontWeight: '800' }, continueSub: { color: C.cream, marginTop: 3, fontSize: 11 },
  later: { marginTop: 47, borderTopWidth: 1, borderColor: C.line, paddingTop: 17 }, laterText: { color: C.muted, fontSize: 15, marginTop: 8 },
});

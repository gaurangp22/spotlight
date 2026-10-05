import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Action, Eyebrow, Page, RankingPreview } from '../../ui/components';
import { C } from '../../ui/theme';

export default function FollowingScreen() {
  const { allRankings, draft, following, user, refresh, refreshing } = useApp();
  const feed = allRankings.filter((ranking) => !user || ranking.userId === user.id || following.includes(ranking.handle));
  return <Page>
    <View style={styles.masthead}><Text style={styles.logo}>MARGIN<Text style={{ color: C.accent }}>.</Text></Text><Text style={styles.edition}>MUSIC, IN YOUR OWN ORDER</Text></View>
    <View style={styles.intro}><Eyebrow>YOUR CORNER OF MUSIC</Eyebrow><Text style={styles.headline}>Good taste is a <Text style={{ color: C.accent }}>conversation.</Text></Text><Text style={styles.introText}>See what friends love. Put it in your own order.</Text><View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}><Action label={user ? 'Activity' : 'Join MARGIN'} onPress={() => router.push(user ? '/notifications' : '/auth')} icon={user ? 'bell-outline' : 'account-plus-outline'} /><Action label={refreshing ? 'Refreshing…' : 'Refresh'} secondary disabled={refreshing} onPress={() => void refresh()} /></View></View>
    {(draft.items.length > 0 || !!draft.title.trim()) && <Pressable accessibilityRole="button" style={styles.draft} onPress={() => router.push('/builder')}><MaterialCommunityIcons name="content-save-outline" color={C.accent} size={22} /><View style={{ flex: 1 }}><Text style={styles.draftTitle}>Your ranking is waiting</Text><Text style={styles.draftSub}>{draft.items.length} picks saved on this device</Text></View><MaterialCommunityIcons name="arrow-right" size={22} color={C.ink} /></Pressable>}
    <View style={styles.section}><Text style={styles.sectionTitle}>In rotation</Text><Text style={styles.sectionCount}>{String(feed.length).padStart(2, '0')} STORIES</Text></View>
    {feed.length ? feed.map((ranking, index) => <RankingPreview key={ranking.id} ranking={ranking} featured={index === 0} />)
      : <View style={styles.empty}><Text style={styles.emptyTitle}>Your feed is quiet.</Text><Text style={styles.emptyText}>Find people in Discover, or publish your first ranking.</Text><Action label="Find music people" onPress={() => router.push('/(tabs)/discover')} /></View>}
    <Pressable accessibilityRole="button" style={styles.prompt} onPress={() => { router.push('/builder'); }}><Eyebrow>START WITH A PROMPT</Eyebrow><Text style={styles.promptTitle}>Five songs you would play for someone who’s never met you.</Text><View style={styles.promptFoot}><Text style={styles.promptLink}>MAKE YOURS</Text><MaterialCommunityIcons name="arrow-right" size={21} color={C.accent} /></View></Pressable>
  </Page>;
}

const styles = StyleSheet.create({
  masthead: { paddingTop: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 2, borderColor: C.ink },
  logo: { color: C.ink, fontSize: 29, fontWeight: '900', letterSpacing: -1.9 }, edition: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  intro: { paddingTop: 30, paddingBottom: 27 }, headline: { color: C.ink, fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.8, marginTop: 10 },
  introText: { color: C.muted, fontSize: 14, marginTop: 12 },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: C.accent, marginBottom: 22 },
  draftTitle: { color: C.ink, fontSize: 14, fontWeight: '800' }, draftSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }, sectionTitle: { fontSize: 22, color: C.ink, fontWeight: '900', letterSpacing: -0.8 }, sectionCount: { color: C.muted, fontSize: 10, letterSpacing: 1.3, fontWeight: '800' },
  prompt: { backgroundColor: C.soft, padding: 20, marginTop: 12, marginBottom: 22 }, promptTitle: { fontSize: 25, lineHeight: 28, letterSpacing: -0.7, fontWeight: '900', color: C.ink, marginTop: 15 },
  promptFoot: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, promptLink: { color: C.accent, fontWeight: '900', letterSpacing: 1, fontSize: 11 },
  empty: { gap: 12, paddingVertical: 35 }, emptyTitle: { fontSize: 24, fontWeight: '900', color: C.ink }, emptyText: { fontSize: 14, color: C.muted, lineHeight: 20 },
});

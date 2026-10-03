import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { Eyebrow, Page, RankingPreview } from '../../ui/components';
import { C } from '../../ui/theme';

export default function DiscoverScreen() {
  const { allRankings, following, toggleFollow } = useApp();
  const [query, setQuery] = useState('');
  const rankings = useMemo(() => allRankings.filter((ranking) => `${ranking.title} ${ranking.subtitle} ${ranking.items.map((item) => item.artist).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [allRankings, query]);
  return <Page>
    <View style={styles.top}><Eyebrow>PEOPLE, NOT ALGORITHMS</Eyebrow><Text style={styles.title}>Find your next <Text style={{ color: C.accent }}>argument.</Text></Text></View>
    <View style={styles.search}><MaterialCommunityIcons name="magnify" size={24} color={C.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search rankings or artists" placeholderTextColor={C.muted} style={styles.input} returnKeyType="search" /></View>
    <Text style={styles.section}>MUSIC PEOPLE</Text>
    {[{ name: 'Mandi', handle: '@mandi', note: 'Deep cuts, strong opinions.', initial: 'M' }, { name: 'Ayush', handle: '@ayush', note: 'An album person, always.', initial: 'A' }].map((person) => <View key={person.handle} style={styles.person}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{person.initial}</Text></View><View style={{ flex: 1 }}><Text style={styles.personName}>{person.name} <Text style={styles.handle}>{person.handle}</Text></Text><Text style={styles.note}>{person.note} · Example profile</Text></View>
      <Pressable accessibilityRole="button" onPress={() => toggleFollow(person.handle)} style={[styles.follow, following.includes(person.handle) && styles.following]}><Text style={[styles.followText, following.includes(person.handle) && { color: C.ink }]}>{following.includes(person.handle) ? 'Following' : 'Follow'}</Text></Pressable>
    </View>)}
    <View style={styles.row}><Text style={styles.section}>RANKINGS TO REMIX</Text><Text style={styles.count}>{rankings.length} FOUND</Text></View>
    {rankings.length ? rankings.map((ranking) => <RankingPreview key={ranking.id} ranking={ranking} />) : <Text style={styles.noResults}>No rankings match yet. Try another artist, or make one yourself.</Text>}
    <Pressable accessibilityRole="button" style={styles.createPrompt} onPress={() => router.push('/builder')}><Text style={styles.createText}>Have a take nobody’s posted?</Text><MaterialCommunityIcons name="arrow-right" size={24} color={C.accent} /></Pressable>
  </Page>;
}

const styles = StyleSheet.create({
  top: { paddingTop: 27 }, title: { color: C.ink, fontSize: 38, lineHeight: 40, letterSpacing: -1.7, fontWeight: '900', marginTop: 10, marginBottom: 25 },
  search: { height: 52, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 }, input: { flex: 1, fontSize: 15, color: C.ink },
  section: { color: C.ink, fontWeight: '900', fontSize: 12, letterSpacing: 1.1, marginTop: 30, marginBottom: 13 },
  person: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderColor: C.line }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.white, fontSize: 19, fontWeight: '900' },
  personName: { color: C.ink, fontSize: 14, fontWeight: '900' }, handle: { color: C.muted, fontSize: 11, fontWeight: '500' }, note: { color: C.muted, fontSize: 11, marginTop: 3 },
  follow: { minWidth: 72, minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: C.ink, paddingHorizontal: 8 }, following: { borderWidth: 1, backgroundColor: 'transparent', borderColor: C.line }, followText: { color: C.white, fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, count: { fontSize: 10, color: C.muted, fontWeight: '800', letterSpacing: 1 }, noResults: { color: C.muted, paddingVertical: 20 },
  createPrompt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 22, borderTopWidth: 1, borderColor: C.ink }, createText: { color: C.ink, fontSize: 17, fontWeight: '800' },
});

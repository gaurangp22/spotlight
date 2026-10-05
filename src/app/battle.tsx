import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Artwork, Eyebrow, Header, Page } from '../ui/components';
import { C } from '../ui/theme';

export default function BattleScreen() {
  const { draft, setDraft } = useApp();
  const [items] = useState(() => [...draft.items]);
  const pairs = items.flatMap((_, i) => items.slice(i + 1).map((__, offset) => [i, i + offset + 1] as const));
  const [round, setRound] = useState(0);
  const [wins, setWins] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  if (items.length < 2) return <Page><Header title="Battle Mode" back /><Text style={styles.noItems}>Add at least two picks to start a battle.</Text></Page>;

  const finish = (scores: Record<string, number>) => {
    const sorted = [...items].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || items.indexOf(a) - items.indexOf(b));
    setDraft((current) => ({ ...current, items: sorted }));
    setDone(true);
  };

  const pick = (winner: MusicItem) => {
    const next = { ...wins, [winner.id]: (wins[winner.id] ?? 0) + 1 };
    setWins(next);
    if (round + 1 >= pairs.length) finish(next);
    else setRound(round + 1);
  };

  const pair = pairs[round] ?? pairs[pairs.length - 1];
  return <Page>
    <Header title="Battle Mode" back />
    {done ? <View style={styles.complete}><MaterialCommunityIcons name="check-circle-outline" size={42} color={C.accent} /><Eyebrow>THE RESULTS ARE IN</Eyebrow><Text style={styles.completeTitle}>Your order is ready.</Text><Text style={styles.completeText}>Your choices shaped this order. Picks with equal wins kept their previous order. Fine tune the result before publishing.</Text><Pressable accessibilityRole="button" accessibilityLabel="See my ranking" style={styles.finish} onPress={() => router.replace('/builder')}><Text style={styles.finishText}>See my ranking</Text><MaterialCommunityIcons name="arrow-right" size={21} color={C.white} /></Pressable></View>
      : <><View style={styles.intro}><Eyebrow>GO WITH YOUR GUT</Eyebrow><Text style={styles.title}>Which one wins?</Text><Text style={styles.subtitle}>Tap the music you would keep.</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((round / pairs.length) * 100)}%` }]} /></View><Text style={styles.progressText}>{round + 1} OF {pairs.length} MATCHUPS</Text></View>
        <View style={styles.choices}>{pair.map((index, slot) => { const item = items[index]; return <Pressable accessibilityRole="button" key={item.id} onPress={() => pick(item)} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.78 }]}><View style={styles.choiceTop}><Text style={styles.choiceLabel}>PICK {slot === 0 ? 'A' : 'B'}</Text><MaterialCommunityIcons name="arrow-top-right" size={24} color={C.cream} /></View><Artwork item={item} size={106} /><Text style={styles.songTitle}>{item.title}</Text><Text style={styles.artist}>{item.artist}</Text></Pressable>; })}</View>
        {round > 0 && <Pressable accessibilityRole="button" onPress={() => finish(wins)} style={styles.stop}><Text style={styles.stopText}>Use my choices so far</Text><MaterialCommunityIcons name="arrow-right" size={20} color={C.ink} /></Pressable>}
        <Text style={styles.tip}>You can stop anytime and refine the order manually.</Text></>}
  </Page>;
}

const styles = StyleSheet.create({
  noItems: { color: C.muted, fontSize: 15, marginTop: 30 }, intro: { paddingTop: 30 }, title: { color: C.ink, fontSize: 37, fontWeight: '900', letterSpacing: -1.3, marginTop: 8 }, subtitle: { color: C.muted, fontSize: 14, marginTop: 8 }, progressTrack: { marginTop: 28, height: 3, backgroundColor: C.line }, progressFill: { height: 3, backgroundColor: C.accent }, progressText: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  choices: { marginTop: 34, gap: 13 }, choice: { backgroundColor: C.night, minHeight: 211, padding: 18 }, choiceTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }, choiceLabel: { color: C.cream, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, songTitle: { color: C.white, fontWeight: '900', fontSize: 21, letterSpacing: -0.5, marginTop: 10 }, artist: { color: C.cream, fontSize: 12, marginTop: 3 }, tip: { color: C.muted, textAlign: 'center', fontSize: 12, marginTop: 28 },
  complete: { paddingTop: 65, gap: 14 }, completeTitle: { fontSize: 38, fontWeight: '900', color: C.ink, letterSpacing: -1.3 }, completeText: { color: C.muted, fontSize: 15, lineHeight: 22 }, finish: { marginTop: 20, backgroundColor: C.accent, minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, finishText: { color: C.white, fontSize: 14, fontWeight: '900' },
  stop: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.ink, paddingHorizontal: 14, marginTop: 20 }, stopText: { color: C.ink, fontWeight: '800', fontSize: 13 },
});

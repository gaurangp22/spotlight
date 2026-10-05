import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useApp } from '../../store/AppContext';
import { Action, Artwork, Eyebrow, Header, Page } from '../../ui/components';
import { C } from '../../ui/theme';
import { MoodGrid } from '../../ui/mood';
import { postLink } from '../../lib/links';
import { errorMessage } from '../../lib/api';

const width = Math.min(Dimensions.get('window').width - 40, 340);

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings, loadPost, setNotice } = useApp();
  const ranking = allRankings.find((entry) => entry.id === id);
  const [template, setTemplate] = useState<'paper' | 'night'>('night');
  const [sharing, setSharing] = useState(false);
  const card = useRef<any>(null);
  useEffect(() => { loadPost(id).catch((e) => setNotice(errorMessage(e))); }, [id, loadPost, setNotice]);
  if (!ranking) return <Page><Header title="Share card" back /><Text>Ranking unavailable.</Text></Page>;
  const dark = template === 'night';
  const bg = dark ? C.night : C.white;
  const fg = dark ? C.white : C.ink;
  const secondary = dark ? C.cream : C.muted;

  const share = async () => {
    if (!card.current?.capture) return;
    setSharing(true);
    try {
      const uri = await card.current.capture();
      if (Platform.OS === 'web') {
        const link = document.createElement('a'); link.href = uri; link.download = `margin-${ranking.id}.png`; link.click(); return;
      }
      const available = await Sharing.isAvailableAsync();
      if (!available) throw new Error('Sharing is unavailable on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your music ranking' });
    } catch (e) { setNotice(errorMessage(e)); }
    finally { setSharing(false); }
  };

  return <Page>
    <Header title="Share card" back />
    <View style={styles.intro}><Eyebrow>MADE TO LEAVE THE APP</Eyebrow><Text style={styles.title}>Your take, <Text style={{ color: C.accent }}>out loud.</Text></Text><Text style={styles.note}>Choose a look and share a designed card to another app.</Text></View>
    <View style={styles.templates}><Pressable accessibilityRole="button" onPress={() => setTemplate('night')} style={[styles.template, template === 'night' && styles.selected]}><View style={[styles.swatch, { backgroundColor: C.night }]} /><Text style={styles.templateText}>Night</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setTemplate('paper')} style={[styles.template, template === 'paper' && styles.selected]}><View style={[styles.swatch, { backgroundColor: C.white, borderWidth: 1, borderColor: C.line }]} /><Text style={styles.templateText}>Paper</Text></Pressable></View>
    <View style={styles.cardWrap}><ViewShot ref={card} options={{ format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' }} style={{ width }}><View collapsable={false} style={[styles.card, { backgroundColor: bg, width, minHeight: width * 1.55 }]}>
      <View style={styles.cardHeader}><Text style={[styles.brand, { color: fg }]}>MARGIN<Text style={{ color: C.accent }}>.</Text></Text><Text style={[styles.issue, { color: secondary }]}>A MUSIC OPINION BY {ranking.handle.toUpperCase()}</Text></View>
      <View><Text style={[styles.cardKicker, { color: C.accent }]}>{ranking.kind === 'moodboard' ? 'THE MOOD BOARD' : 'THE RANKING'}</Text><Text style={[styles.cardTitle, { color: fg }]} numberOfLines={3}>{ranking.title}</Text></View>
      {ranking.kind === 'moodboard' ? <MoodGrid post={ranking} compact /> : <View style={styles.cardList}>{ranking.items.slice(0, 5).map((item, index) => <View key={item.id} style={[styles.cardRow, { borderTopColor: dark ? '#FFFFFF55' : C.line }]}><Text style={[styles.cardNumber, { color: C.accent }]}>{String(index + 1).padStart(2, '0')}</Text><Artwork item={item} size={width * 0.13} /><View style={{ flex: 1 }}><Text style={[styles.cardSong, { color: fg }]} numberOfLines={1}>{item.title}</Text><Text style={[styles.cardArtist, { color: secondary }]} numberOfLines={1}>{item.artist}</Text></View></View>)}</View>}
      <View style={styles.cardFooter}><Text style={[styles.cardFootText, { color: secondary }]}>{ranking.items.length > 5 ? `+ ${ranking.items.length - 5} MORE PICKS` : 'YOUR TASTE HAS A POINT OF VIEW'}</Text><MaterialCommunityIcons name="arrow-top-right" size={25} color={fg} /></View>
    </View></ViewShot></View>
    <Pressable accessibilityRole="button" accessibilityLabel={Platform.OS === 'web' ? 'Download image' : 'Share image'} disabled={sharing} onPress={share} style={[styles.shareButton, sharing && { opacity: 0.5 }]}>{sharing ? <ActivityIndicator color={C.white} /> : <><Text style={styles.shareText}>{Platform.OS === 'web' ? 'Download image' : 'Share image'}</Text><MaterialCommunityIcons name="share-variant-outline" color={C.white} size={21} /></>}</Pressable>
    {!ranking.isSample && <View style={{ marginTop: 12 }}><Action label="Share post link" secondary onPress={() => Share.share({ message: `${ranking.title}\n${postLink(ranking.id)}` }).catch((e) => setNotice(errorMessage(e)))} /></View>}
    <Text style={styles.warning}>{ranking.visibility !== 'public' ? 'Sharing an image reveals the content to anyone who receives it. The post link still respects your visibility setting.' : 'Share the image or send a link so people can open your post.'}</Text>
  </Page>;
}

const styles = StyleSheet.create({
  intro: { paddingTop: 25 }, title: { color: C.ink, fontSize: 33, lineHeight: 36, letterSpacing: -1.3, fontWeight: '900', marginTop: 9 }, note: { color: C.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  templates: { flexDirection: 'row', gap: 8, marginTop: 21, marginBottom: 20 }, template: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11 }, selected: { borderColor: C.accent, borderWidth: 2 }, swatch: { width: 20, height: 20 }, templateText: { color: C.ink, fontSize: 12, fontWeight: '800' },
  cardWrap: { alignItems: 'center' }, card: { padding: 20, justifyContent: 'space-between' }, cardHeader: { gap: 7 }, brand: { fontSize: 21, letterSpacing: -1.2, fontWeight: '900' }, issue: { fontSize: 8, letterSpacing: 0.7, fontWeight: '900' }, cardKicker: { fontSize: 9, letterSpacing: 1.7, fontWeight: '900', marginTop: 30 }, cardTitle: { fontSize: 29, lineHeight: 31, letterSpacing: -1.2, fontWeight: '900', marginTop: 7 }, cardList: { marginTop: 23 }, cardRow: { minHeight: 58, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardNumber: { fontSize: 15, fontWeight: '900', width: 25 }, cardSong: { fontSize: 12, fontWeight: '900' }, cardArtist: { fontSize: 10, marginTop: 2 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }, cardFootText: { fontWeight: '900', fontSize: 8, letterSpacing: 0.7 },
  shareButton: { backgroundColor: C.accent, minHeight: 54, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 }, shareText: { color: C.white, fontSize: 14, fontWeight: '900' }, warning: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 16, marginBottom: 20 },
});

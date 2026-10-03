import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useApp } from '../../store/AppContext';
import { Artwork, Eyebrow, Header, Page } from '../../ui/components';
import { C } from '../../ui/theme';

const width = Math.min(Dimensions.get('window').width - 40, 340);

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allRankings } = useApp();
  const ranking = allRankings.find((entry) => entry.id === id);
  const [template, setTemplate] = useState<'paper' | 'night'>('night');
  const [sharing, setSharing] = useState(false);
  const card = useRef<any>(null);
  if (!ranking) return <Page><Header title="Share card" back /><Text>Ranking unavailable.</Text></Page>;
  const dark = template === 'night';
  const bg = dark ? C.night : C.white;
  const fg = dark ? C.white : C.ink;
  const secondary = dark ? C.cream : C.muted;

  const share = async () => {
    if (!card.current?.capture) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) { Alert.alert('Sharing unavailable', 'This device cannot open a share sheet right now.'); return; }
      const uri = await card.current.capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your music ranking' });
    } catch { Alert.alert('Could not share card', 'Please try again.'); }
    finally { setSharing(false); }
  };

  return <Page>
    <Header title="Share card" back />
    <View style={styles.intro}><Eyebrow>MADE TO LEAVE THE APP</Eyebrow><Text style={styles.title}>Your take, <Text style={{ color: C.accent }}>out loud.</Text></Text><Text style={styles.note}>Choose a look and share a designed card to another app.</Text></View>
    <View style={styles.templates}><Pressable accessibilityRole="button" onPress={() => setTemplate('night')} style={[styles.template, template === 'night' && styles.selected]}><View style={[styles.swatch, { backgroundColor: C.night }]} /><Text style={styles.templateText}>Night</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setTemplate('paper')} style={[styles.template, template === 'paper' && styles.selected]}><View style={[styles.swatch, { backgroundColor: C.white, borderWidth: 1, borderColor: C.line }]} /><Text style={styles.templateText}>Paper</Text></Pressable></View>
    <View style={styles.cardWrap}><ViewShot ref={card} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={{ width }}><View collapsable={false} style={[styles.card, { backgroundColor: bg, width, minHeight: width * 1.55 }]}>
      <View style={styles.cardHeader}><Text style={[styles.brand, { color: fg }]}>MARGIN<Text style={{ color: C.accent }}>.</Text></Text><Text style={[styles.issue, { color: secondary }]}>A MUSIC OPINION BY {ranking.handle.toUpperCase()}</Text></View>
      <View><Text style={[styles.cardKicker, { color: C.accent }]}>THE RANKING</Text><Text style={[styles.cardTitle, { color: fg }]} numberOfLines={3}>{ranking.title}</Text></View>
      <View style={styles.cardList}>{ranking.items.slice(0, 5).map((item, index) => <View key={item.id} style={[styles.cardRow, { borderTopColor: dark ? '#FFFFFF55' : C.line }]}><Text style={[styles.cardNumber, { color: C.accent }]}>{String(index + 1).padStart(2, '0')}</Text><Artwork item={item} size={width * 0.13} /><View style={{ flex: 1 }}><Text style={[styles.cardSong, { color: fg }]} numberOfLines={1}>{item.title}</Text><Text style={[styles.cardArtist, { color: secondary }]} numberOfLines={1}>{item.artist}</Text></View></View>)}</View>
      <View style={styles.cardFooter}><Text style={[styles.cardFootText, { color: secondary }]}>{ranking.items.length > 5 ? `+ ${ranking.items.length - 5} MORE PICKS` : 'YOUR TASTE HAS A POINT OF VIEW'}</Text><MaterialCommunityIcons name="arrow-top-right" size={25} color={fg} /></View>
    </View></ViewShot></View>
    <Pressable accessibilityRole="button" disabled={sharing} onPress={share} style={[styles.shareButton, sharing && { opacity: 0.5 }]}>{sharing ? <ActivityIndicator color={C.white} /> : <><Text style={styles.shareText}>Share image</Text><MaterialCommunityIcons name="share-variant-outline" color={C.white} size={21} /></>}</Pressable>
    <Text style={styles.warning}>Sample rankings are examples. Sharing creates an image; it does not publish your private data to a server.</Text>
  </Page>;
}

const styles = StyleSheet.create({
  intro: { paddingTop: 25 }, title: { color: C.ink, fontSize: 33, lineHeight: 36, letterSpacing: -1.3, fontWeight: '900', marginTop: 9 }, note: { color: C.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  templates: { flexDirection: 'row', gap: 8, marginTop: 21, marginBottom: 20 }, template: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, paddingHorizontal: 11 }, selected: { borderColor: C.accent, borderWidth: 2 }, swatch: { width: 20, height: 20 }, templateText: { color: C.ink, fontSize: 12, fontWeight: '800' },
  cardWrap: { alignItems: 'center' }, card: { padding: 20, justifyContent: 'space-between' }, cardHeader: { gap: 7 }, brand: { fontSize: 21, letterSpacing: -1.2, fontWeight: '900' }, issue: { fontSize: 8, letterSpacing: 0.7, fontWeight: '900' }, cardKicker: { fontSize: 9, letterSpacing: 1.7, fontWeight: '900', marginTop: 30 }, cardTitle: { fontSize: 29, lineHeight: 31, letterSpacing: -1.2, fontWeight: '900', marginTop: 7 }, cardList: { marginTop: 23 }, cardRow: { minHeight: 58, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardNumber: { fontSize: 15, fontWeight: '900', width: 25 }, cardSong: { fontSize: 12, fontWeight: '900' }, cardArtist: { fontSize: 10, marginTop: 2 }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }, cardFootText: { fontWeight: '900', fontSize: 8, letterSpacing: 0.7 },
  shareButton: { backgroundColor: C.accent, minHeight: 54, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 }, shareText: { color: C.white, fontSize: 14, fontWeight: '900' }, warning: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 16, marginBottom: 20 },
});

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MusicItem, Ranking } from '../lib/types';
import { sampleMusic } from '../lib/sample';
import { C } from './theme';
import { useApp } from '../store/AppContext';
import { MoodGrid } from './mood';
import { displayDate } from '../lib/dates';

export function Page({ children, scroll = true, padded = true }: { children: React.ReactNode; scroll?: boolean; padded?: boolean }) {
  const { notice, setNotice, refresh, refreshing } = useApp();
  const banner = notice ? <View accessibilityLiveRegion="polite" style={styles.banner}><Text style={styles.bannerText}>{notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setNotice('')} style={styles.dismiss}><MaterialCommunityIcons name="close" size={22} color={C.white} /></Pressable></View> : null;
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {banner}
      {scroll ? <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.accent} colors={[C.accent]} />} contentContainerStyle={[styles.scroll, padded && styles.pad]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        : <View style={[styles.fill, styles.measure, padded && styles.pad]}>{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function Header({ title, back = false, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  return <View style={styles.header}>
    {back && <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.iconButton} accessibilityLabel="Go back"><MaterialCommunityIcons name="arrow-left" size={24} color={C.ink} /></Pressable>}
    <Text numberOfLines={2} style={[styles.headerTitle, back && { marginLeft: 8 }]}>{title}</Text>
    <View style={{ marginLeft: 'auto' }}>{right}</View>
  </View>;
}

export function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <Text style={[styles.eyebrow, light && { color: C.cream }]}>{children}</Text>;
}

export function Artwork({ item, size = 54 }: { item: MusicItem; size?: number }) {
  const [failed, setFailed] = useState(false);
  const artwork = item.artwork ?? sampleMusic.find((sample) => sample.id === item.id)?.artwork;
  return <View style={[styles.artwork, { width: size, height: size, backgroundColor: item.color ?? C.night }]}>
    {artwork && !failed ? <Image source={{ uri: artwork }} onError={() => setFailed(true)} style={{ width: size, height: size }} />
      : <Text style={[styles.artworkText, { fontSize: Math.max(11, size * 0.16) }]} numberOfLines={2}>{item.album ?? item.title}</Text>}
  </View>;
}

export function Action({ label, onPress, secondary = false, icon, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.action, secondary ? styles.actionSecondary : styles.actionPrimary, disabled && { opacity: 0.4 }, pressed && { opacity: 0.75 }]}>
    {icon && <MaterialCommunityIcons name={icon} size={19} color={secondary ? C.ink : C.white} />}
    <Text style={[styles.actionText, secondary && { color: C.ink }]}>{label}</Text>
  </Pressable>;
}

export function MusicRow({ item, index, trailing, onPress }: { item: MusicItem; index?: number; trailing?: React.ReactNode; onPress?: () => void }) {
  const content = <>
    {index !== undefined && <Text style={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</Text>}
    <Artwork item={item} />
    <View style={styles.musicText}>
      <Text style={styles.musicTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.musicArtist} numberOfLines={1}>{item.artist}{item.album && item.kind === 'song' ? ` · ${item.album}` : ''}</Text>
    </View>
    {trailing}
  </>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.musicRow}>{content}</Pressable>
    : <View style={styles.musicRow}>{content}</View>;
}

export function RankingPreview({ ranking, featured = false }: { ranking: Ranking; featured?: boolean }) {
  const visible = ranking.items.slice(0, featured ? 3 : 2);
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/ranking/${ranking.id}`)} style={[styles.preview, featured && styles.featured]}>
    <View style={styles.previewTop}>
      <Text style={[styles.previewAuthor, featured && { color: C.cream }]}>{ranking.handle} · {displayDate(ranking.createdAt)}</Text>
      {ranking.isSample && <Text style={[styles.sample, featured && { color: C.cream }]}>EXAMPLE</Text>}
    </View>
    <Text style={[styles.previewTitle, featured && styles.featuredTitle]}>{ranking.title}</Text>
    {!!ranking.subtitle && <Text style={[styles.previewSubtitle, featured && { color: C.cream }]}>{ranking.subtitle}</Text>}
    {ranking.kind === 'moodboard' ? <MoodGrid post={ranking} compact /> : <View style={styles.previewList}>
      {visible.map((item, index) => <View key={item.id} style={[styles.previewItem, featured && { borderColor: '#FFFFFF55' }]}>
        <Text style={[styles.previewNumber, featured && { color: C.cream }]}>{String(index + 1).padStart(2, '0')}</Text>
        <Artwork item={item} size={42} />
        <View style={{ flex: 1 }}><Text style={[styles.previewItemTitle, featured && { color: C.white }]} numberOfLines={1}>{item.title}</Text><Text style={[styles.previewItemArtist, featured && { color: C.cream }]}>{item.artist}</Text></View>
      </View>)}
    </View>}
    <View style={styles.previewFoot}>
      <Text style={[styles.previewFootText, featured && { color: C.cream }]}>{ranking.kind === 'moodboard' ? 'MOOD BOARD' : `${ranking.items.length} PICKS`}  ·  {ranking.reactionCount} REACTIONS</Text>
      <MaterialCommunityIcons name="arrow-top-right" size={24} color={featured ? C.white : C.ink} />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper }, fill: { flex: 1 }, scroll: { paddingBottom: 32, width: '100%', maxWidth: 680, alignSelf: 'center' }, measure: { width: '100%', maxWidth: 680, alignSelf: 'center' }, pad: { paddingHorizontal: 20 },
  banner: { backgroundColor: C.night, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, width: '100%', maxWidth: 680, alignSelf: 'center' }, bannerText: { flex: 1, color: C.white, fontSize: 13, lineHeight: 19, paddingVertical: 14 }, dismiss: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line },
  headerTitle: { flexShrink: 1, fontSize: 22, fontWeight: '900', color: C.ink, letterSpacing: -0.7, paddingVertical: 10 },
  iconButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', marginLeft: -12 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, color: C.muted },
  artwork: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  artworkText: { color: C.white, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', padding: 4, letterSpacing: -0.5 },
  action: { minHeight: 50, paddingHorizontal: 18, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: C.accent }, actionSecondary: { borderWidth: 1, borderColor: C.ink },
  actionText: { color: C.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  musicRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  rowIndex: { width: 28, color: C.accent, fontSize: 18, fontWeight: '900' },
  musicText: { flex: 1, gap: 3 }, musicTitle: { color: C.ink, fontSize: 15, fontWeight: '800' }, musicArtist: { color: C.muted, fontSize: 12 },
  preview: { padding: 18, backgroundColor: C.white, borderTopWidth: 2, borderTopColor: C.ink, marginBottom: 16 },
  featured: { backgroundColor: C.night, borderTopColor: C.accent, padding: 20 },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewAuthor: { color: C.muted, fontWeight: '700', fontSize: 12 }, sample: { color: C.muted, fontWeight: '900', fontSize: 9, letterSpacing: 1.2 },
  previewTitle: { color: C.ink, fontWeight: '900', fontSize: 23, letterSpacing: -0.8, lineHeight: 26, marginTop: 16 },
  featuredTitle: { color: C.white, fontSize: 31, lineHeight: 34 },
  previewSubtitle: { color: C.muted, marginTop: 7, fontSize: 13 }, previewList: { marginTop: 22 },
  previewItem: { minHeight: 54, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewNumber: { color: C.accent, width: 27, fontWeight: '900', fontSize: 16 },
  previewItemTitle: { color: C.ink, fontSize: 13, fontWeight: '800' }, previewItemArtist: { color: C.muted, fontSize: 11 },
  previewFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  previewFootText: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});

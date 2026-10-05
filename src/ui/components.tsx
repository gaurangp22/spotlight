import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Extrapolation, FadeInUp, FadeOutUp, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { displayDate } from '../lib/dates';
import { MusicItem, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MoodGrid } from './mood';
import { Artwork, Avatar, Badge, Card, IconButton, IconName, Ionicons, T } from './primitives';
import { curve, gutter, makeStyles, maxContent, radius, space, useTheme } from './theme';

export const visibilityIcon: Record<Ranking['visibility'], IconName> = { public: 'globe-outline', followers: 'people-outline', private: 'lock-closed-outline' };
export const visibilityLabel: Record<Ranking['visibility'], string> = { public: 'Public', followers: 'Followers', private: 'Only you' };

export function goBack() { if (router.canGoBack()) router.back(); else router.replace('/'); }

type ScreenProps = {
  children: React.ReactNode;
  /** Navigation title. With `large`, it also renders as a large title that collapses into the bar on scroll. */
  title?: string; large?: boolean; eyebrow?: string; subtitle?: string;
  /** Fade the bar title in only after scrolling past a custom header (e.g. a profile). */
  fadeTitle?: boolean;
  back?: boolean; right?: React.ReactNode; left?: React.ReactNode;
  scroll?: boolean; padded?: boolean; tab?: boolean;
  onRefresh?: () => void; refreshing?: boolean;
  /** Pinned below the scroll area (composer, primary action). */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, title, large = false, fadeTitle = false, eyebrow, subtitle, back = false, right, left, scroll = true, padded = true, tab = false, onRefresh, refreshing = false, footer, contentStyle }: ScreenProps) {
  const s = useScreenStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const titleStyle = useAnimatedStyle(() => ({ opacity: large ? interpolate(y.value, [26, 46], [0, 1], Extrapolation.CLAMP) : fadeTitle ? interpolate(y.value, [130, 170], [0, 1], Extrapolation.CLAMP) : 1 }));
  const hairline = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 12], [0, 1], Extrapolation.CLAMP) }));
  const bottomPad = footer ? space.xl : tab ? space.xxl : insets.bottom + space.xxxl;

  const bar = <View style={[s.bar, { paddingTop: insets.top }]}>
    <View style={s.barRow}>
      <View style={s.barSide}>{back ? <IconButton icon="chevron-back" label="Go back" onPress={goBack} size={38} /> : left}</View>
      <Animated.View style={[s.barTitle, titleStyle]} pointerEvents="none">{!!title && <T v="headline" numberOfLines={1} center>{title}</T>}</Animated.View>
      <View style={[s.barSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
    <Animated.View style={[s.hairline, hairline]} />
  </View>;

  const heading = large && title ? <View style={s.largeHeader}>
    {!!eyebrow && <T v="overline" tone="accent" style={{ marginBottom: 4 }}>{eyebrow}</T>}
    <T v="largeTitle" accessibilityRole="header">{title}</T>
    {!!subtitle && <T v="subhead" tone="secondary" style={{ marginTop: 6 }}>{subtitle}</T>}
  </View> : null;

  const content = <View style={[s.measure, padded && s.padded, contentStyle]}>{heading}{children}</View>;
  return <View style={s.page}>
    {bar}
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.secondary} colors={[c.accent]} progressBackgroundColor={c.surface} /> : undefined}>
        {content}
      </Animated.ScrollView> : <View style={[s.fill, { paddingBottom: bottomPad }]}>{content}</View>}
      {footer && <View style={[s.footer, { paddingBottom: tab ? space.md : Math.max(insets.bottom, space.md) }]}><View style={[s.measure, s.padded]}>{footer}</View></View>}
    </KeyboardAvoidingView>
  </View>;
}
const useScreenStyles = makeStyles((c) => ({
  page: { flex: 1, backgroundColor: c.bg }, fill: { flex: 1 },
  bar: { backgroundColor: c.bg, zIndex: 2 },
  barRow: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  barSide: { width: 96, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barTitle: { flex: 1, alignItems: 'center' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
  largeHeader: { paddingTop: space.xs, paddingBottom: space.lg },
  measure: { width: '100%', maxWidth: maxContent, alignSelf: 'center', flexGrow: 1 },
  padded: { paddingHorizontal: gutter },
  footer: { backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, paddingTop: space.md },
}));

/** App-wide notice, presented as a dismissible toast beneath the status bar. */
export function Toast() {
  const { notice, setNotice } = useApp();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  if (!notice) return null;
  return <Animated.View entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(180)} pointerEvents="box-none"
    style={{ position: 'absolute', top: insets.top + 6, left: space.md, right: space.md, alignItems: 'center', zIndex: 100 }}>
    <Pressable accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={`${notice}. Tap to dismiss.`} onPress={() => setNotice('')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.inverse, borderRadius: radius.lg, paddingVertical: 13, paddingHorizontal: space.lg, maxWidth: 520, width: '100%', ...curve, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
      <Ionicons name="information-circle" size={20} color={c.onInverse} />
      <T v="subhead" weight="medium" style={{ flex: 1, color: c.onInverse }}>{notice}</T>
      <Ionicons name="close" size={18} color={c.onInverse} style={{ opacity: 0.6 }} />
    </Pressable>
  </Animated.View>;
}

export function Loading({ label }: { label: string }) {
  const { c } = useTheme();
  return <View style={{ paddingVertical: space.xxxl * 1.5, alignItems: 'center', gap: space.md }}><ActivityIndicator color={c.secondary} /><T v="footnote" tone="secondary">{label}</T></View>;
}

export function MusicRow({ item, index, trailing, onPress, separator = true, size = 48 }: { item: MusicItem; index?: number; trailing?: React.ReactNode; onPress?: () => void; separator?: boolean; size?: number }) {
  const { c } = useTheme();
  const content = <>
    {index !== undefined && <T v="headline" tabular tone={index < 3 ? 'primary' : 'secondary'} center style={{ width: 26 }}>{index + 1}</T>}
    <Artwork item={item} size={size} />
    <View style={{ flex: 1, gap: 2, alignSelf: 'stretch', justifyContent: 'center', borderBottomWidth: separator ? StyleSheet.hairlineWidth : 0, borderColor: c.hairline, paddingVertical: 14 }}>
      <T v="headline" weight="medium" numberOfLines={1}>{item.title}</T>
      <T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}{item.album && item.kind === 'song' ? ` · ${item.album}` : ''}</T>
    </View>
    {trailing}
  </>;
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size + 20 };
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} by ${item.artist}`} onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}>{content}</Pressable>
    : <View style={style}>{content}</View>;
}

/** The feed unit: author, headline, and a podium of the top three picks. */
export function RankingCard({ ranking }: { ranking: Ranking }) {
  const s = useCardStyles();
  const { c } = useTheme();
  const top = ranking.items.slice(0, 3);
  const isMood = ranking.kind === 'moodboard';
  return <Card onPress={() => router.push(`/ranking/${ranking.id}`)} style={{ marginBottom: space.lg }}>
    <View style={s.author}>
      <Avatar name={ranking.author} seed={ranking.handle} size={34} />
      <View style={{ flex: 1 }}>
        <T v="callout" weight="semibold" numberOfLines={1}>{ranking.author}</T>
        <T v="caption" tone="secondary" numberOfLines={1}>{ranking.handle} · {displayDate(ranking.createdAt)}</T>
      </View>
      {ranking.isSample ? <Badge label="Example" /> : ranking.visibility !== 'public' ? <Badge label={visibilityLabel[ranking.visibility]} icon={visibilityIcon[ranking.visibility]} /> : null}
    </View>
    <T v="title3" style={{ marginTop: space.md }} numberOfLines={2}>{ranking.title}</T>
    {!!ranking.subtitle && <T v="subhead" tone="secondary" style={{ marginTop: 3 }} numberOfLines={2}>{ranking.subtitle}</T>}
    {isMood ? <MoodGrid post={ranking} compact /> : <View style={s.podium}>
      {top.map((item, index) => <View key={item.id} style={{ flex: 1, gap: 6 }}>
        <View>
          <Artwork item={item} fill rounded={12} />
          <View style={s.rank}><T v="caption" weight="bold" tabular style={{ color: '#FFFFFF' }}>{index + 1}</T></View>
        </View>
        <T v="caption" weight="semibold" numberOfLines={1}>{item.title}</T>
      </View>)}
      {top.length < 3 && Array.from({ length: 3 - top.length }, (_, i) => <View key={i} style={{ flex: 1 }} />)}
    </View>}
    <View style={s.foot}>
      <T v="footnote" tone="secondary" style={{ flex: 1 }}>{isMood ? 'Mood board' : `${ranking.items.length} picks`}{ranking.originId ? ' · Remix' : ''}</T>
      <View style={s.stat}><Ionicons name={ranking.reacted ? 'heart' : 'heart-outline'} size={16} color={ranking.reacted ? c.accent : c.secondary} /><T v="footnote" tone="secondary" tabular>{ranking.reactionCount}</T></View>
      <View style={s.stat}><Ionicons name="chatbubble-outline" size={15} color={c.secondary} /><T v="footnote" tone="secondary" tabular>{ranking.comments.length}</T></View>
    </View>
  </Card>;
}
const useCardStyles = makeStyles(() => ({
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  podium: { flexDirection: 'row', gap: 10, marginTop: space.lg },
  rank: { position: 'absolute', left: 6, bottom: 6, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
}));

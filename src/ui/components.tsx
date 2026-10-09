import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Extrapolation, FadeInUp, FadeOutUp, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { categories, formatScore, scoreColor, scoreInk } from '../lib/categories';
import { displayDate } from '../lib/dates';
import { MusicItem, Rating, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MoodGrid } from './mood';
import { PostActions, TakeCard } from './equals';
import { MINI_PLAYER_HEIGHT, usePreview } from './preview';
import { useTabBarSpace } from './tabbar';
import { Artwork, Avatar, Badge, BotBadge, Card, IconButton, Ionicons, T } from './primitives';
import { curve, font, gutter, makeStyles, maxContent, radius, space, useTheme } from './theme';
import { visibilityIcon, visibilityLabel } from './visibility';

export { visibilityIcon, visibilityLabel } from './visibility';

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
  onEndReached?: () => void;
  scrollRef?: React.RefObject<ScrollView | null>;
  onScrollPosition?: (offset: number, contentHeight: number, viewportHeight: number) => void;
  onContentHeight?: (height: number) => void;
  /** Pinned below the scroll area (composer, primary action). */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, title, large = false, fadeTitle = false, eyebrow, subtitle, back = false, right, left, scroll = true, padded = true, tab = false, onRefresh, refreshing = false, onEndReached, scrollRef, onScrollPosition, onContentHeight, footer, contentStyle }: ScreenProps) {
  const s = useScreenStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const preview = usePreview();
  const tabSpace = useTabBarSpace();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; if (onScrollPosition) scheduleOnRN(onScrollPosition, e.contentOffset.y, e.contentSize.height, e.layoutMeasurement.height); if (onEndReached && e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 400) scheduleOnRN(onEndReached); });
  const titleStyle = useAnimatedStyle(() => ({ opacity: large ? interpolate(y.value, [26, 46], [0, 1], Extrapolation.CLAMP) : fadeTitle ? interpolate(y.value, [130, 170], [0, 1], Extrapolation.CLAMP) : 1 }));
  const hairline = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 12], [0, 1], Extrapolation.CLAMP) }));
  // Tab screens scroll under the floating tab bar, so they reserve its height.
  const bottomPad = (footer ? space.xl : tab ? tabSpace + space.xl : insets.bottom + space.xxxl) + (tab && preview.item ? MINI_PLAYER_HEIGHT + space.lg : 0);

  const bar = <View style={[s.bar, { paddingTop: insets.top }]}>
    <View style={s.barRow}>
      <View style={s.barSide}>{back ? <IconButton icon="chevron-back" label="Go back" onPress={goBack} size={38} /> : left}</View>
      <Animated.View style={[s.barTitle, titleStyle]} pointerEvents="none">{!!title && <T v="headline" numberOfLines={1} center>{title}</T>}</Animated.View>
      <View style={[s.barSide, { justifyContent: 'flex-end' }]}>{right}</View>
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
      {scroll ? <Animated.ScrollView ref={scrollRef} onContentSizeChange={(_width, height) => onContentHeight?.(height)} onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.secondary} colors={[c.accent]} progressBackgroundColor={c.surface} /> : undefined}>
        {content}
      </Animated.ScrollView> : <View style={[s.fill, { paddingBottom: bottomPad }]}>{content}</View>}
      {footer && <View style={[s.footer, { paddingBottom: tab ? tabSpace + space.sm : Math.max(insets.bottom, space.md) }]}><View style={[s.measure, s.padded]}>{footer}</View></View>}
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

/** A score on a tier-coloured rounded square: green for loved, orange for fine, red for nope. */
export function ScoreBadge({ score, size = 44, ring = false }: { score: number; size?: number; ring?: boolean }) {
  const { c } = useTheme();
  return <View accessible accessibilityLabel={`Score ${formatScore(score)} out of 10`} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: scoreColor(score), alignItems: 'center', justifyContent: 'center', ...curve, ...(ring ? { borderWidth: 2.5, borderColor: c.surface } : {}) }}>
    <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.bold, color: scoreInk, fontSize: size * 0.4, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>{formatScore(score)}</Text>
  </View>;
}

const article = (word: string) => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

function Author({ ranking, label }: { ranking: Ranking; label?: string }) {
  const s = useCardStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${ranking.author}'s profile`} disabled={ranking.isSample} onPress={() => router.push(`/person/${ranking.handle.slice(1)}`)} style={s.author}>
    <Avatar name={ranking.author} seed={ranking.handle} uri={ranking.avatar} size={36} />
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><T v="callout" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{ranking.author}{label ? <T v="callout" tone="secondary"> {label}</T> : null}</T>{ranking.authorBot && <BotBadge />}</View>
      <T v="mono" tone="secondary" numberOfLines={1}>{ranking.handle} · {displayDate(ranking.updatedAt || ranking.createdAt)}</T>
    </View>
    {ranking.isSample ? <Badge label="Example" /> : ranking.visibility !== 'public' ? <Badge label={visibilityLabel[ranking.visibility]} icon={visibilityIcon[ranking.visibility]} /> : null}
  </Pressable>;
}

/** A rating with its review: the cover leads, the score sits on its corner, the words follow. */
export function ReviewCard({ ranking }: { ranking: Ranking }) {
  const item = ranking.items[0];
  if (!item) return null;
  const category = categories[item.kind];
  return <Card style={{ marginBottom: space.lg }}>
    <Author ranking={ranking} label={`rated ${article(category.label.toLowerCase())}`} />
    <Pressable accessibilityRole="button" accessibilityLabel={`${ranking.author} rated ${item.title} ${ranking.score ?? ''}`} onPress={() => router.push(`/ranking/${ranking.id}`)} style={{ flexDirection: 'row', gap: space.lg, marginTop: space.lg, alignItems: 'center' }}>
      <View>
        <Artwork item={item} size={112} rounded={radius.md} />
        {ranking.score !== undefined && <View style={{ position: 'absolute', right: -10, bottom: -10 }}><ScoreBadge score={ranking.score} size={50} ring /></View>}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T v="overline" tone="secondary">{category.label}</T>
        <T v="title3" weight="bold" numberOfLines={3}>{item.title}</T>
        <T v="subhead" tone="secondary" numberOfLines={1}>{item.artist}</T>
      </View>
    </Pressable>
    {!!ranking.subtitle && <Pressable accessibilityRole="button" accessibilityLabel="Open review" onPress={() => router.push(`/ranking/${ranking.id}`)} style={{ marginTop: space.lg }}>
      <T v="body" numberOfLines={5}>{ranking.subtitle}</T>
    </Pressable>}
    <PostActions ranking={ranking} />
  </Card>;
}

/** A pod: a grid of covers, title, and whether others can add to it. */
export function PodCard({ ranking }: { ranking: Ranking }) {
  const s = useCardStyles();
  const { c } = useTheme();
  const covers = ranking.items.slice(0, 4);
  const contributors = new Set(ranking.items.map((i) => i.addedBy).filter(Boolean)).size;
  return <Card style={{ marginBottom: space.lg }}>
    <Author ranking={ranking} label={ranking.clubId ? 'picked this week’s album' : 'made a pod'} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${ranking.title}`} onPress={() => router.push(`/ranking/${ranking.id}`)} style={{ flexDirection: 'row', gap: space.lg, marginTop: space.lg, alignItems: 'center' }}>
      <View style={s.mosaic}>
        {Array.from({ length: 4 }, (_, i) => covers[i] ? <Artwork key={covers[i].id} item={covers[i]} size={55} rounded={0} /> : <View key={i} style={s.mosaicEmpty} />)}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T v="overline" tone="secondary">{ranking.clubId ? 'Album of the week' : `Pod · ${ranking.items.length} ${ranking.items.length === 1 ? 'pick' : 'picks'}`}</T>
        <T v="title3" weight="bold" numberOfLines={2}>{ranking.title}</T>
        {!!ranking.subtitle && <T v="footnote" tone="secondary" numberOfLines={2}>{ranking.subtitle}</T>}
        {(ranking.open || contributors > 0) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Ionicons name="people" size={14} color={c.accent} />
          <T v="caption" weight="semibold" tone="accent">{ranking.open ? 'Open — add yours' : `${contributors + 1} contributors`}</T>
        </View>}
      </View>
    </Pressable>
    <PostActions ranking={ranking} />
  </Card>;
}

/** Horizontal shelf of someone's five highest-rated items in one category. */
export function TopFive({ kind, ratings, onShare }: { kind: MusicItem['kind']; ratings: Rating[]; onShare?: () => void }) {
  const top = topFive(ratings, kind);
  if (!top.length) return null;
  return <View style={{ marginTop: space.xxl }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <T v="title2">Top 5</T><T v="title2" style={{ color: categories[kind].tint }}>{categories[kind].plural.toLowerCase()}</T>
      </View>
      {onShare && <IconButton icon="share-outline" label={`Share top ${categories[kind].plural.toLowerCase()}`} size={36} tone="secondary" onPress={onShare} />}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.lg }}>
      {top.map((r, index) => <Pressable key={r.item.id} accessibilityRole="button" accessibilityLabel={`Number ${index + 1}, ${r.item.title}, score ${formatScore(r.score)}`} onPress={() => router.push(`/item/${encodeURIComponent(r.item.id)}`)} style={{ width: 120 }}>
        <View>
          <Artwork item={r.item} size={120} rounded={radius.md} />
          <Text style={{ position: 'absolute', left: 8, bottom: 4, fontFamily: font.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.5, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }}>{index + 1}</Text>
          <View style={{ position: 'absolute', right: -6, top: -6 }}><ScoreBadge score={r.score} size={34} ring /></View>
        </View>
        <T v="callout" weight="semibold" numberOfLines={1} style={{ marginTop: 10 }}>{r.item.title}</T>
        <T v="caption" tone="secondary" numberOfLines={1}>{r.item.artist}</T>
      </Pressable>)}
    </ScrollView>
  </View>;
}
export const topFive = (ratings: Rating[], kind: MusicItem['kind']) => ratings.filter((r) => r.category === kind).sort((a, b) => b.score - a.score || a.position - b.position).slice(0, 5);

/** The feed unit: a review, a pod, or a list with a podium of its top three picks. */
export function RankingCard({ ranking }: { ranking: Ranking }) {
  if (ranking.kind === 'take') return <TakeCard ranking={ranking} />;
  if (ranking.kind === 'review') return <ReviewCard ranking={ranking} />;
  if (ranking.kind === 'pod') return <PodCard ranking={ranking} />;
  return <ListCard ranking={ranking} />;
}
function ListCard({ ranking }: { ranking: Ranking }) {
  const s = useCardStyles();
  const { c } = useTheme();
  const top = ranking.items.slice(0, 3);
  const isMood = ranking.kind === 'moodboard';
  return <Card style={{ marginBottom: space.lg }}>
    <Author ranking={ranking} label={isMood ? 'made a mood board' : ranking.originId ? 'remixed a ranking' : 'ranked'} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${ranking.title}`} onPress={() => router.push(`/ranking/${ranking.id}`)}>
      <T v="title2" style={{ marginTop: space.md }} numberOfLines={2}>{ranking.title}</T>
      {!!ranking.subtitle && <T v="subhead" tone="secondary" style={{ marginTop: 3 }} numberOfLines={2}>{ranking.subtitle}</T>}
      {isMood ? <MoodGrid post={ranking} compact /> : <View style={s.podium}>
        {top.map((item, index) => <View key={item.id} style={{ flex: 1, gap: 6 }}>
          <View>
            <Artwork item={item} fill rounded={radius.sm} />
            <View style={[s.rank, index === 0 && { backgroundColor: c.accentFill }]}><Text style={{ fontFamily: font.bold, fontSize: 14, color: '#FFFFFF' }}>{index + 1}</Text></View>
          </View>
          <T v="caption" weight="semibold" numberOfLines={1}>{item.title}</T>
        </View>)}
        {top.length < 3 && Array.from({ length: 3 - top.length }, (_, i) => <View key={i} style={{ flex: 1 }} />)}
      </View>}
      {!isMood && ranking.items.length > 3 && <T v="mono" tone="secondary" style={{ marginTop: space.sm }}>+ {ranking.items.length - 3} more in the list</T>}
    </Pressable>
    <PostActions ranking={ranking} />
  </Card>;
}
const useCardStyles = makeStyles((c) => ({
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  podium: { flexDirection: 'row', gap: 10, marginTop: space.lg },
  rank: { position: 'absolute', left: 6, bottom: 6, minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  mosaic: { width: 112, height: 112, borderRadius: radius.md, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', gap: 2, backgroundColor: c.fill, ...curve },
  mosaicEmpty: { width: 55, height: 55, backgroundColor: c.fillStrong },
}));

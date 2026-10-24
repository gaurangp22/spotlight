import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { MusicItem } from '../lib/types';
import { ScoreBadge } from './components';
import { haptic } from './haptics';
import { Artwork, T } from './primitives';
import { radius, space } from './theme';

/** Places counted down before #1, so a 40-track album still reveals in a few seconds. */
const COUNTDOWN = 4;
const INTRO_MS = 900, STEP_MS = 700, HOLD_MS = 1500;

/**
 * A short countdown that plays over a ranking before it appears: a few places from the bottom of the
 * top five, then #1 lands. Tap anywhere to skip; people who reduce motion go straight to the list.
 */
export function RankingReveal({ visible, title, items, cover, onDone }: {
  visible: boolean; title: string; items: MusicItem[]; cover?: MusicItem; onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const places = Math.min(items.length, COUNTDOWN + 1);
  // 0 is the intro; step n shows place `places - n` (0-based), so the last step is #1.
  const [step, setStep] = useState(0);
  // Rewind while rendering, not in an effect, so a replay never flashes the last run's #1 first.
  const [shown, setShown] = useState(visible);
  if (shown !== visible) { setShown(visible); if (visible) setStep(0); }
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (!visible) return;
    if (reduced || !places) { done.current(); return; }
    if (step > 0) (step === places ? haptic.success : haptic.tap)();
    const timer = setTimeout(() => step < places ? setStep(step + 1) : done.current(), step === 0 ? INTRO_MS : step === places ? HOLD_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [visible, step, places, reduced]);

  const index = places - step, item = step > 0 ? items[index] : undefined, first = index === 0;
  const background = cover?.artwork ?? items[0]?.artwork;
  return <Modal visible={visible && !reduced} transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
    <Pressable accessibilityRole="button" accessibilityLabel="Skip the reveal and show the ranking" onPress={onDone} style={s.root}>
      {background && <Image source={{ uri: background }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={Platform.OS === 'android' ? 25 : 60} />}
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.78)', 'rgba(0,0,0,0.94)']} style={StyleSheet.absoluteFill} />
      <Animated.View entering={FadeIn.duration(300)} style={s.heading}>
        <T v="overline" style={{ color: '#FFFFFFB3' }}>{step === 0 ? 'Your ranking' : first ? 'Number one' : 'Counting down'}</T>
        <T v="title2" center numberOfLines={2} style={{ color: '#FFFFFF' }}>{title}</T>
      </Animated.View>
      <View style={s.stage}>
        {item ? <Animated.View key={step} entering={first ? ZoomIn.springify().damping(12) : FadeInDown.springify().damping(16)} exiting={FadeOut.duration(140)} style={s.card}>
          <T v="largeTitle" tabular style={[s.place, first && s.placeFirst]}>#{index + 1}</T>
          <View>
            <Artwork item={item} size={first ? 220 : 168} rounded={radius.lg} />
            {item.score !== undefined && <View style={{ position: 'absolute', right: -14, bottom: -14 }}><ScoreBadge score={item.score} size={first ? 68 : 56} ring /></View>}
          </View>
          <T v={first ? 'title1' : 'title2'} center numberOfLines={2} style={{ color: '#FFFFFF', marginTop: space.xl }}>{item.title}</T>
          <T v="subhead" center numberOfLines={1} style={{ color: '#FFFFFFB3' }}>{item.artist}</T>
        </Animated.View>
          : <Animated.View key="intro" entering={ZoomIn.duration(350)} exiting={FadeOut.duration(140)} style={s.card}>
            {cover ? <Artwork item={cover} size={168} rounded={radius.lg} /> : null}
            <T v="headline" center style={{ color: '#FFFFFFCC', marginTop: space.lg }}>{items.length} {items.length === 1 ? 'pick' : 'picks'}. Here’s how they landed.</T>
          </Animated.View>}
      </View>
      <View style={s.dots}>
        {Array.from({ length: places }, (_, i) => <View key={i} style={[s.dot, step >= i + 1 && s.dotOn]} />)}
      </View>
      <T v="caption" center style={{ color: '#FFFFFF80', marginBottom: space.xxl }}>Tap to skip</T>
    </Pressable>
  </Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: space.xl, justifyContent: 'space-between' },
  heading: { alignItems: 'center', gap: space.xs, marginTop: space.xxxl * 1.5 },
  stage: { flex: 1 },
  // Cards share one spot, so the outgoing place fades out underneath the incoming one.
  card: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  place: { color: '#FFFFFFCC', marginBottom: space.lg },
  placeFirst: { color: '#FFD60A', fontSize: 44, lineHeight: 50 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF40' },
  dotOn: { backgroundColor: '#FFFFFF' },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, PanResponderGestureState, StyleSheet, Text, View } from 'react-native';
import { haptic } from './haptics';
import { IconButton } from './primitives';
import { font, radius, space } from './theme';

/**
 * Where the card sits on a video, as fractions of the frame, so the small preview, the camera stage, and the
 * 1080×1920 export all agree. `x`/`y` move the card from its default spot; `scale` grows or shrinks it.
 */
export type CardLayout = { x: number; y: number; scale: number };
export const DEFAULT_LAYOUT: CardLayout = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.6, MAX_SCALE = 1.6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const tidy = (l: CardLayout): CardLayout => ({ x: clamp(l.x, -0.45, 0.45), y: clamp(l.y, -0.3, 0.75), scale: clamp(l.scale, MIN_SCALE, MAX_SCALE) });

/** The transform that places a card, given the stage it's drawn on. */
export const cardTransform = (l: CardLayout | undefined, width: number, height: number) =>
  l ? [{ translateX: l.x * width }, { translateY: l.y * height }, { scale: l.scale }] : [];

/** A card layout remembered per video type, so your usual spot is there next time. */
export function useCardLayout(kind: 'review' | 'countdown') {
  const key = `riffs-video-layout-v1:${kind}`;
  const [layout, setLayout] = useState<CardLayout>(DEFAULT_LAYOUT);
  useEffect(() => {
    AsyncStorage.getItem(key).then((raw) => { if (raw) setLayout(tidy({ ...DEFAULT_LAYOUT, ...JSON.parse(raw) })); }).catch(() => {});
  }, [key]);
  const update = (next: CardLayout) => { const value = tidy(next); setLayout(value); AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {}); };
  return [layout, update] as const;
}

const distance = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
};

/**
 * A clear layer over the video stage: drag with one finger to move the card, pinch with two to resize it.
 * It sits outside the captured overlay, so nothing of it ends up in the video.
 */
export function LayoutGestures({ layout, onChange, width, height, enabled }: { layout: CardLayout; onChange: (l: CardLayout) => void; width: number; height: number; enabled: boolean }) {
  // The responder is built once; these refs hand it the latest values without rebuilding it mid-gesture.
  const live = useRef(layout), change = useRef(onChange), size = useRef({ width, height });
  useEffect(() => { live.current = layout; change.current = onChange; size.current = { width, height }; });
  const start = useRef({ layout, pinch: 0, dx: 0, dy: 0, fingers: 0 });
  const responder = useMemo(() => {
    // Drags use the gesture's own movement (works for fingers and a mouse); pinches use the two touch points.
    const begin = (e: GestureResponderEvent, g: PanResponderGestureState) => {
      start.current = { layout: live.current, pinch: distance(e), dx: g.dx, dy: g.dy, fingers: e.nativeEvent.touches.length };
    };
    // The handlers only read refs when a touch happens, not during render.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, g) => { begin(e, g); haptic.select(); },
      onPanResponderMove: (e, g) => {
        const fingers = e.nativeEvent.touches.length;
        // Adding or lifting a finger starts a fresh gesture from where the card is now.
        if (fingers !== start.current.fingers) { begin(e, g); return; }
        const s = start.current, { width: w, height: h } = size.current;
        if (fingers >= 2 && s.pinch > 0) change.current({ ...s.layout, scale: s.layout.scale * distance(e) / s.pinch });
        else change.current({ ...s.layout, x: s.layout.x + (g.dx - s.dx) / w, y: s.layout.y + (g.dy - s.dy) / h });
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);
  if (!enabled) return null;
  return <View {...responder.panHandlers} style={StyleSheet.absoluteFill} accessibilityLabel="Drag to move the card, pinch to resize it" />;
}

/** Buttons for the same thing, for one-handed use and screen readers. */
export function LayoutControls({ layout, onChange }: { layout: CardLayout; onChange: (l: CardLayout) => void }) {
  const step = (by: number) => { haptic.select(); onChange({ ...layout, scale: layout.scale + by }); };
  const moved = layout.x !== 0 || layout.y !== 0 || layout.scale !== 1;
  return <View style={styles.row}>
    <IconButton icon="remove" label="Make the card smaller" size={36} tone="white" filled={false} disabled={layout.scale <= MIN_SCALE} onPress={() => step(-0.1)} />
    <Text style={styles.text}>{Math.round(layout.scale * 100)}%</Text>
    <IconButton icon="add" label="Make the card bigger" size={36} tone="white" filled={false} disabled={layout.scale >= MAX_SCALE} onPress={() => step(0.1)} />
    <View style={styles.divider} />
    <IconButton icon="refresh" label="Put the card back" size={36} tone="white" filled={false} disabled={!moved} onPress={() => { haptic.select(); onChange(DEFAULT_LAYOUT); }} />
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: space.xs, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  text: { fontFamily: font.semibold, fontSize: 13, color: '#FFFFFF', minWidth: 42, textAlign: 'center', fontVariant: ['tabular-nums'] },
  divider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2 },
});

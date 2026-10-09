import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { MusicItem } from '../lib/types';
import { haptic } from './haptics';
import { Artwork, Ionicons } from './primitives';
import { curve, font, radius, shadow, space, useTheme } from './theme';

/** Apple's catalog supplies a 30-second preview for most songs. */
/** Opt in only after reviewing the provider's promotional-content requirements. */
export const PREVIEWS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PREVIEWS === '1';
export const canPreview = (item?: MusicItem | null): item is MusicItem & { previewUrl: string } => PREVIEWS_ENABLED && !!item?.previewUrl;
/** Height the floating player takes up, so scrolling content can leave room for it. */
export const MINI_PLAYER_HEIGHT = 64;

type PreviewState = {
  item: MusicItem | null; playing: boolean; progress: number;
  /** Plays the item's preview, or pauses/resumes it if it's already the current one. */
  toggle: (item: MusicItem) => void;
  stop: () => void;
};
const Context = createContext<PreviewState>({ item: null, playing: false, progress: 0, toggle: () => {}, stop: () => {} });

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  return PREVIEWS_ENABLED ? <ActivePreviewProvider>{children}</ActivePreviewProvider> : <>{children}</>;
}

function ActivePreviewProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [item, setItem] = useState<MusicItem | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'duckOthers' }).catch(() => {});
  }, []);
  // Previews are a taste, not a music player: they stop when you leave the app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => sub.remove();
  }, [player]);
  useEffect(() => {
    if (status.didJustFinish) { player.pause(); player.seekTo(0).catch(() => {}); }
  }, [status.didJustFinish, player]);

  const toggle = useCallback((next: MusicItem) => {
    if (!canPreview(next)) return;
    haptic.tap();
    if (item?.id === next.id) { if (status.playing) player.pause(); else player.play(); return; }
    player.replace({ uri: next.previewUrl });
    player.play();
    setItem(next);
  }, [item?.id, player, status.playing]);
  const stop = useCallback(() => { player.pause(); setItem(null); }, [player]);

  const value = useMemo<PreviewState>(() => ({
    item, playing: !!item && status.playing, progress: status.duration ? Math.min(1, status.currentTime / status.duration) : 0, toggle, stop,
  }), [item, status.playing, status.currentTime, status.duration, toggle, stop]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePreview() { return useContext(Context); }

/** The floating "now previewing" pill that sits above the tab bar. */
export function MiniPlayer({ bottom }: { bottom: number }) {
  const { c } = useTheme();
  const { item, playing, progress, toggle, stop } = usePreview();
  if (!item) return null;
  return <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(160)} pointerEvents="box-none"
    style={[styles.wrap, { bottom }]}>
    <View style={[styles.player, { backgroundColor: c.elevated }, shadow(c, 3)]}>
      <View style={[styles.progress, { width: `${progress * 100}%`, backgroundColor: c.accent }]} />
      <Artwork item={item} size={44} rounded={10} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: font.semibold, fontSize: 15, color: c.text }}>{item.title}</Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 11, color: c.secondary }}>{item.artist} · Preview from Apple Music</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause preview' : 'Play preview'} hitSlop={8} onPress={() => toggle(item)} style={[styles.button, { backgroundColor: c.inverse }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={c.onInverse} style={!playing && { marginLeft: 2 }} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Close preview" hitSlop={8} onPress={stop} style={styles.close}>
        <Ionicons name="close" size={20} color={c.secondary} />
      </Pressable>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.sm, right: space.sm, alignItems: 'center' },
  player: { width: '100%', maxWidth: 560, height: MINI_PLAYER_HEIGHT, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 10, paddingRight: 6, overflow: 'hidden', ...curve },
  progress: { position: 'absolute', left: 0, bottom: 0, height: 2 },
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  close: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
});

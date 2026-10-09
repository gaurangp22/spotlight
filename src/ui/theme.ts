import { useMemo } from 'react';
import { ImageStyle, Platform, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';

// Riffs follows Apple's Human Interface Guidelines: system grouped backgrounds, quiet chrome, one accent,
// and album art supplying the colour. Light and dark follow the device setting.
// Contrast (WCAG AA): body text ≥ 15:1, secondary ≥ 5:1 on every surface it sits on; accent text ≥ 4.6:1;
// white on accent fills ≥ 4.6:1.
const light = {
  bg: '#F2F2F7', surface: '#FFFFFF', elevated: '#FFFFFF', fill: '#EEEEF2', fillStrong: '#E1E1E6',
  text: '#000000', secondary: '#6C6C70', tertiary: '#AEAEB2',
  separator: 'rgba(60,60,67,0.18)', hairline: 'rgba(60,60,67,0.22)', border: 'rgba(60,60,67,0.08)',
  accent: '#D9124B', accentFill: '#E8174A', accentSoft: 'rgba(232,23,74,0.10)', onAccent: '#FFFFFF',
  violet: '#7A38C4', violetSoft: 'rgba(175,82,222,0.12)',
  heart: '#E8174A', heartSoft: 'rgba(232,23,74,0.10)',
  danger: '#D70015', success: '#248A3D', scrim: 'rgba(0,0,0,0.4)', inverse: '#000000', onInverse: '#FFFFFF',
  tabBar: 'rgba(249,249,251,0.78)', shadow: '#000000', material: 'light' as 'light' | 'dark',
  /** Brand gradient for rare celebratory moments: rose into purple. */
  glowA: '#FF2D55', glowB: '#AF52DE',
};
const dark: typeof light = {
  bg: '#000000', surface: '#1C1C1E', elevated: '#2C2C2E', fill: '#2C2C2E', fillStrong: '#3A3A3C',
  text: '#FFFFFF', secondary: '#98989F', tertiary: '#636366',
  separator: 'rgba(84,84,88,0.55)', hairline: 'rgba(84,84,88,0.65)', border: 'rgba(255,255,255,0.06)',
  accent: '#FF4D74', accentFill: '#E8174A', accentSoft: 'rgba(255,55,95,0.16)', onAccent: '#FFFFFF',
  violet: '#D08CFF', violetSoft: 'rgba(191,90,242,0.18)',
  heart: '#FF4D74', heartSoft: 'rgba(255,55,95,0.16)',
  danger: '#FF453A', success: '#30D158', scrim: 'rgba(0,0,0,0.6)', inverse: '#FFFFFF', onInverse: '#000000',
  tabBar: 'rgba(30,30,32,0.72)', shadow: '#000000', material: 'dark',
  glowA: '#FF375F', glowB: '#BF5AF2',
};
export type Palette = typeof light;
export const palettes = { light, dark };

/** Apple system colours for icon tiles and category markers; white glyphs sit on them, as in Settings. */
export const tints = {
  violet: '#AF52DE', pink: '#FF2D55', teal: '#0FA3B1', amber: '#FF9500', sky: '#007AFF', coral: '#FF3B30', volt: '#34C759', grey: '#8E8E93', spotify: '#1DB954', indigo: '#5856D6',
} as const;

/** `#RRGGBB` → `rgba(...)` at the given opacity, for soft tinted backgrounds. */
export function alpha(hex: string, opacity: number) {
  const value = hex.replace('#', '');
  const n = parseInt(value.length === 3 ? value.split('').map((ch) => ch + ch).join('') : value.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
}

// Inter is the closest open typeface to SF Pro, and renders the same on iOS, Android, and the web.
export const font = {
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold', display: 'Inter_700Bold', displayBold: 'Inter_700Bold',
  mono: 'Inter_500Medium', monoBold: 'Inter_600SemiBold',
} as const;
export type Weight = keyof typeof font;

// The iOS Dynamic Type scale (Large) in Inter, with Inter's wider default tracking pulled in.
export const type = {
  display: { fontFamily: font.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
  largeTitle: { fontFamily: font.bold, fontSize: 34, lineHeight: 41, letterSpacing: -1 },
  title1: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  title2: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
  title3: { fontFamily: font.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  headline: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, letterSpacing: -0.35 },
  callout: { fontFamily: font.regular, fontSize: 16, lineHeight: 21, letterSpacing: -0.3 },
  subhead: { fontFamily: font.regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  footnote: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  /** Grouped-list headers and small eyebrows. */
  overline: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.3, textTransform: 'uppercase' },
  /** Button labels. */
  label: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  /** Counts and timestamps: tabular figures so numbers don't jitter. */
  mono: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, letterSpacing: -0.08, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;
export type TypeVariant = keyof typeof type;

export const space = { xxs: 4, xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const gutter = 20;
/** Removes the browser focus ring from text inputs; the field border shows focus instead. */
export const noOutline: TextStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : {};
export const maxContent = 680;

/** iOS continuous corners (squircles) where supported; harmless elsewhere. */
export const curve = Platform.OS === 'ios' ? ({ borderCurve: 'continuous' } as const) : {};

export function shadow(c: Palette, level: 1 | 2 | 3 = 1): ViewStyle {
  // Light mode: cards float on soft, wide shadows. Dark mode: elevation comes from lighter surfaces instead.
  const isDark = c.material === 'dark';
  if (isDark && level === 1) return {};
  const spec = { 1: [2, 10, 0.05, 1], 2: [8, 24, isDark ? 0.5 : 0.1, 6], 3: [16, 40, isDark ? 0.6 : 0.16, 12] }[level];
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${spec[0]}px ${spec[1]}px rgba(0,0,0,${spec[2]})` } as ViewStyle,
    default: { shadowColor: c.shadow, shadowOffset: { width: 0, height: spec[0] }, shadowRadius: spec[1] / 2, shadowOpacity: spec[2], elevation: spec[3] },
  })!;
}

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { c: palettes[scheme], dark: scheme === 'dark', scheme } as const;
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;
/** Theme-aware StyleSheet: styles are created once per colour scheme and reused. */
export function makeStyles<T extends NamedStyles>(factory: (c: Palette, dark: boolean) => T) {
  const cache: Partial<Record<'light' | 'dark', T>> = {};
  return function useStyles(): T {
    const { scheme } = useTheme();
    return useMemo(() => (cache[scheme] ??= StyleSheet.create(factory(palettes[scheme], scheme === 'dark')) as T), [scheme]);
  };
}

function hashOf(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
/** Avatar fills in Apple's contact-card style; white initials stay ≥ 4.5:1 on every one. */
const avatarHues = ['#5856D6', '#C2185B', '#0B7A75', '#B35A00', '#0060DF', '#8E3BBF', '#2E7D32', '#B3261E'];
/** Soft fills for artist chips; black text on them is ≥ 11:1. */
const chipHues = ['#E9DDFB', '#FFD9E2', '#D4F1EE', '#FFE8CC', '#D6E8FF', '#DFF5D8', '#FFDAD6', '#E7E3FF'];
export function chipColor(seed: string) { return chipHues[hashOf(seed) % chipHues.length]; }
export function avatarColor(seed: string) { return avatarHues[hashOf(seed) % avatarHues.length]; }

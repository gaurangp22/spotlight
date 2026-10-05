import { useMemo } from 'react';
import { ImageStyle, Platform, StyleSheet, TextStyle, useColorScheme, ViewStyle } from 'react-native';

// Contrast-checked against WCAG AA: body text ≥ 4.5:1 on every surface it sits on.
const light = {
  bg: '#F7F5F1', surface: '#FFFFFF', elevated: '#FFFFFF', fill: '#EFECE6', fillStrong: '#E4E0D8',
  text: '#121211', secondary: '#6B6862', tertiary: '#A3A09A', separator: 'rgba(18,18,17,0.09)', hairline: 'rgba(18,18,17,0.14)',
  accent: '#C63A22', accentFill: '#C63A22', accentSoft: 'rgba(198,58,34,0.10)', onAccent: '#FFFFFF',
  danger: '#C4281C', success: '#2F7D4F', scrim: 'rgba(10,10,10,0.42)', inverse: '#121211', onInverse: '#FFFFFF',
  tabBar: 'rgba(250,249,246,0.97)', shadow: '#1A140C',
};
const dark: typeof light = {
  bg: '#0E0E0F', surface: '#1A1A1C', elevated: '#232326', fill: '#262628', fillStrong: '#323235',
  text: '#F5F3EE', secondary: '#A09D97', tertiary: '#6C6A66', separator: 'rgba(255,255,255,0.08)', hairline: 'rgba(255,255,255,0.14)',
  accent: '#FF6B4A', accentFill: '#D44129', accentSoft: 'rgba(255,107,74,0.14)', onAccent: '#FFFFFF',
  danger: '#FF5B4F', success: '#4CC27E', scrim: 'rgba(0,0,0,0.6)', inverse: '#F5F3EE', onInverse: '#121211',
  tabBar: 'rgba(20,20,21,0.97)', shadow: '#000000',
};
export type Palette = typeof light;
export const palettes = { light, dark };

export const font = {
  regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold', heavy: 'Inter_800ExtraBold',
} as const;
export type Weight = keyof typeof font;

// A single type scale modelled on platform text styles, tuned for Inter's wider default tracking.
export const type = {
  display: { fontFamily: font.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  largeTitle: { fontFamily: font.bold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title1: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  title2: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
  title3: { fontFamily: font.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  headline: { fontFamily: font.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23, letterSpacing: -0.15 },
  callout: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, letterSpacing: -0.15 },
  subhead: { fontFamily: font.regular, fontSize: 14, lineHeight: 19, letterSpacing: -0.08 },
  footnote: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, letterSpacing: -0.04 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  overline: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;
export type TypeVariant = keyof typeof type;

export const space = { xxs: 4, xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const gutter = 20;
/** Removes the browser focus ring from text inputs; the field border shows focus instead. */
export const noOutline: TextStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : {};
export const maxContent = 680;

/** iOS-style continuous corners where supported; harmless elsewhere. */
export const curve = Platform.OS === 'ios' ? ({ borderCurve: 'continuous' } as const) : {};

export function shadow(c: Palette, level: 1 | 2 | 3 = 1): ViewStyle {
  const spec = { 1: [2, 8, 0.06, 1], 2: [8, 20, 0.1, 4], 3: [18, 40, 0.18, 10] }[level];
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0px ${spec[0]}px ${spec[1]}px rgba(26,20,12,${spec[2]})` } as ViewStyle,
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

/** Deterministic, pleasant avatar colours derived from a handle. */
const avatarHues = ['#C63A22', '#2F6F8F', '#6A4C93', '#2F7D4F', '#B5651D', '#8C2F5A', '#3D5A80', '#2E7A72'];
export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return avatarHues[Math.abs(hash) % avatarHues.length];
}

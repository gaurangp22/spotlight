import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps,
  TextProps, TextStyle, View, ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MusicItem } from '../lib/types';
import { sampleMusic } from '../lib/sample';
import { haptic } from './haptics';
import { avatarColor, curve, font, makeStyles, noOutline, Palette, radius, shadow, space, type, TypeVariant, useTheme, Weight } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'success' | 'white';
const toneColor = (c: Palette, tone: Tone) => ({ primary: c.text, secondary: c.secondary, tertiary: c.tertiary, accent: c.accent, onAccent: c.onAccent, danger: c.danger, success: c.success, white: '#FFFFFF' }[tone]);

/** Themed text bound to the type scale. */
export function T({ v = 'body', tone = 'primary', weight, center, tabular, style, ...props }: TextProps & {
  v?: TypeVariant; tone?: Tone; weight?: Weight; center?: boolean; tabular?: boolean; style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return <Text maxFontSizeMultiplier={1.6} {...props} style={[type[v], { color: toneColor(c, tone) }, weight && { fontFamily: font[weight] }, center && { textAlign: 'center' }, tabular && { fontVariant: ['tabular-nums'] }, style]} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Pressable with a soft spring-scale response and optional haptic tick. */
export function Tap({ scaleTo = 0.97, feedback = 'tap', style, onPress, disabled, children, ...props }: Omit<PressableProps, 'style'> & {
  scaleTo?: number; feedback?: keyof typeof haptic | false; style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <AnimatedPressable accessibilityRole="button" disabled={disabled} {...props}
    onPressIn={(e) => { scale.set(withTiming(scaleTo, { duration: 90 })); props.onPressIn?.(e); }}
    onPressOut={(e) => { scale.set(withSpring(1, { damping: 14, stiffness: 260 })); props.onPressOut?.(e); }}
    onPress={(e) => { if (feedback) haptic[feedback](); onPress?.(e); }}
    style={[style, animated, disabled && { opacity: 0.4 }]}>{children}</AnimatedPressable>;
}

type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'plain' | 'destructive' | 'danger' | 'inverse';
export function Button({ label, onPress, variant = 'primary', size = 'lg', icon, iconRight, loading = false, disabled = false, inline = false, style }: {
  label: string; onPress: () => void; variant?: ButtonVariant; size?: 'lg' | 'md' | 'sm'; icon?: IconName; iconRight?: IconName;
  loading?: boolean; disabled?: boolean; inline?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const s = useButtonStyles();
  const { c } = useTheme();
  const fg = { primary: c.onAccent, secondary: c.text, tinted: c.accent, plain: c.accent, destructive: c.danger, danger: c.onAccent, inverse: c.onInverse }[variant];
  const iconSize = size === 'sm' ? 15 : 18;
  return <Tap onPress={onPress} disabled={disabled || loading} feedback={variant === 'primary' ? 'press' : 'tap'} accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading }}
    style={[s.base, s[size], s[variant], inline && { alignSelf: 'flex-start' }, style]}>
    {loading ? <ActivityIndicator color={fg} /> : <>
      {icon && <Ionicons name={icon} size={iconSize} color={fg} />}
      <T v="label" style={[{ color: fg }, size === 'sm' && { fontSize: 15, letterSpacing: -0.2 }, size === 'md' && { fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</T>
      {iconRight && <Ionicons name={iconRight} size={iconSize} color={fg} />}
    </>}
  </Tap>;
}
const useButtonStyles = makeStyles((c) => ({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...curve },
  lg: { minHeight: 52, paddingHorizontal: 22, borderRadius: radius.md },
  md: { minHeight: 46, paddingHorizontal: 18, borderRadius: radius.sm + 2 },
  sm: { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, gap: 5 },
  primary: { backgroundColor: c.accentFill }, secondary: { backgroundColor: c.fill }, tinted: { backgroundColor: c.accentSoft },
  plain: { backgroundColor: 'transparent' }, destructive: { backgroundColor: c.fill }, danger: { backgroundColor: c.danger }, inverse: { backgroundColor: c.inverse },
}));

export function IconButton({ icon, onPress, label, tone = 'primary', filled = true, size = 40, badge = false, disabled }: {
  icon: IconName; onPress: () => void; label: string; tone?: Tone; filled?: boolean; size?: number; badge?: boolean; disabled?: boolean;
}) {
  const { c } = useTheme();
  // Keep a 44pt hit target even when the visual is smaller.
  const slop = Math.max(0, (44 - size) / 2);
  return <Tap onPress={onPress} disabled={disabled} accessibilityLabel={label} hitSlop={slop} scaleTo={0.9}
    style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? c.fill : 'transparent' }}>
    <Ionicons name={icon} size={Math.round(size * 0.5)} color={toneColor(c, tone)} />
    {badge && <View style={{ position: 'absolute', top: size * 0.16, right: size * 0.18, width: 10, height: 10, borderRadius: 5, backgroundColor: c.heart, borderWidth: 2, borderColor: filled ? c.fill : c.bg }} />}
  </Tap>;
}

export function Card({ children, style, onPress, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: radius.lg, ...curve, ...shadow(c, 1), ...(padded ? { padding: space.lg } : {}) };
  return onPress ? <Tap onPress={onPress} scaleTo={0.985} style={[base, style]}>{children}</Tap> : <View style={[base, style]}>{children}</View>;
}

export function Avatar({ name, seed, size = 40, uri }: { name: string; seed?: string; size?: number; uri?: string }) {
  const [failedUri, setFailedUri] = useState('');
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '·';
  return <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(seed || name), alignItems: 'center', justifyContent: 'center' }}>
    {uri && uri !== failedUri ? <Image source={{ uri }} onError={() => setFailedUri(uri)} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" /> : <Text style={{ fontFamily: font.displayBold, color: '#FFFFFF', fontSize: size * 0.4, letterSpacing: -0.5 }} maxFontSizeMultiplier={1}>{initials}</Text>}
  </View>;
}

/** Album artwork with a typographic fallback tile when no image is available. */
export function Artwork({ item, size, fill = false, rounded, style }: { item: MusicItem; size?: number; fill?: boolean; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = item.artwork ?? sampleMusic.find((sample) => sample.id === item.id)?.artwork;
  const dim = size ?? 52;
  const r = rounded ?? Math.max(4, Math.min(14, Math.round(dim * 0.12)));
  const box: ViewStyle = fill ? { width: '100%', aspectRatio: 1 } : { width: dim, height: dim };
  return <View style={[box, { borderRadius: r, overflow: 'hidden', backgroundColor: item.color ?? c.fillStrong, ...curve }, style]}>
    {uri && !failed ? <Image source={{ uri }} onError={() => setFailed(true)} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={item.id} accessibilityIgnoresInvertColors />
      : <View style={[StyleSheet.absoluteFill, { padding: 6, justifyContent: 'flex-end' }]}>
        <Text numberOfLines={3} maxFontSizeMultiplier={1} style={{ fontFamily: font.bold, color: '#FFFFFFE6', fontSize: Math.max(9, Math.min(15, dim * 0.15)), lineHeight: Math.max(11, Math.min(17, dim * 0.18)), letterSpacing: -0.2 }}>{item.album ?? item.title}</Text>
      </View>}
  </View>;
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'accent' | 'inverse'; icon?: IconName }) {
  const { c } = useTheme();
  const bg = { neutral: c.fill, accent: c.accentSoft, inverse: 'rgba(255,255,255,0.16)' }[tone];
  const fg = { neutral: c.secondary, accent: c.accent, inverse: '#FFFFFF' }[tone];
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
    {icon && <Ionicons name={icon} size={11} color={fg} />}
    <Text style={[type.caption, { color: fg, fontFamily: font.semibold, fontSize: 11 }]} maxFontSizeMultiplier={1.3}>{label}</Text>
  </View>;
}

/** iOS-style segmented control with a sliding thumb. */
export function Segmented<V extends string>({ options, value, onChange, style }: { options: { value: V; label: string; icon?: IconName }[]; value: V; onChange: (value: V) => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width ? (width - 6) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => { x.set(withSpring(index * segment, { damping: 20, stiffness: 240 })); }, [index, segment, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[{ flexDirection: 'row', backgroundColor: c.fill, borderRadius: 10, padding: 2, minHeight: 40, overflow: 'hidden', ...curve }, style]}>
    {!!segment && <Animated.View style={[{ position: 'absolute', top: 2, bottom: 2, left: 2, width: segment, borderRadius: 8, backgroundColor: c.material === 'dark' ? c.fillStrong : c.surface, ...curve }, shadow(c, 2), thumb]} />}
    {options.map((option) => {
      const active = option.value === value;
      return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={option.label}
        onPress={() => { if (!active) { haptic.select(); onChange(option.value); } }}
        style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, minHeight: 48 }}>
        {option.icon && <Ionicons name={option.icon} size={14} color={c.text} />}
        <Text maxFontSizeMultiplier={1.3} style={[type.footnote, { fontFamily: active ? font.semibold : font.medium, color: c.text, fontSize: 14 }]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function SearchField({ value, onChangeText, placeholder, autoFocus, style }: { value: string; onChangeText: (value: string) => void; placeholder: string; autoFocus?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.fill, borderRadius: radius.sm + 1, paddingHorizontal: 12, minHeight: 42, ...curve }, style]}>
    <Ionicons name="search" size={17} color={c.secondary} />
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.secondary} selectionColor={c.accent} autoFocus={autoFocus}
      accessibilityLabel={placeholder} returnKeyType="search" autoCorrect={false} autoCapitalize="none" maxFontSizeMultiplier={1.4}
      style={[type.body, { flex: 1, color: c.text, paddingVertical: 10 }, noOutline]} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText('')}><Ionicons name="close-circle" size={18} color={c.tertiary} /></Pressable>}
  </View>;
}

export function TextField({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 7, marginBottom: space.lg }}>
    <T v="footnote" weight="semibold" tone="secondary">{label}</T>
    <TextInput accessibilityLabel={label} placeholderTextColor={c.secondary} selectionColor={c.accent} maxFontSizeMultiplier={1.4} {...props}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      style={[type.body, { minHeight: 52, borderRadius: radius.md, backgroundColor: c.surface, color: c.text, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: error ? c.danger : focused ? c.accent : c.border, ...curve },
        props.multiline && { minHeight: 96, textAlignVertical: 'top' }, noOutline, style]} />
    {!!(error || hint) && <T v="footnote" tone={error ? 'danger' : 'secondary'}>{error || hint}</T>}
  </View>;
}

/** Inset grouped list, as used throughout system settings. */
export function ListGroup({ header, footer, children, style }: { header?: string; footer?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return <View style={[{ marginTop: space.xxl }, style]}>
    {header && <T v="overline" tone="secondary" style={{ marginLeft: space.lg, marginBottom: space.sm }}>{header}</T>}
    <View style={{ backgroundColor: c.surface, borderRadius: radius.md, overflow: 'hidden', ...curve }}>
      {rows.map((row, i) => <View key={i}>{row}{i < rows.length - 1 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: space.lg }} />}</View>)}
    </View>
    {footer && <T v="footnote" tone="secondary" style={{ marginHorizontal: space.lg, marginTop: space.sm }}>{footer}</T>}
  </View>;
}

export function ListRow({ title, subtitle, value, icon, iconColor, onPress, destructive, chevron = !!onPress, trailing, disabled, selection, accessibilityLabel }: {
  title: string; subtitle?: string; value?: string; icon?: IconName; iconColor?: string; onPress?: () => void; destructive?: boolean; chevron?: boolean; trailing?: React.ReactNode; disabled?: boolean; selection?: boolean; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const body = <>
    {icon && <View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: iconColor ?? c.accentFill, alignItems: 'center', justifyContent: 'center', ...curve }}><Ionicons name={icon} size={17} color="#FFFFFF" /></View>}
    <View style={{ flex: 1, gap: 2 }}>
      <T v="body" tone={destructive ? 'danger' : 'primary'} weight={destructive ? 'medium' : undefined} numberOfLines={1}>{title}</T>
      {subtitle && <T v="footnote" tone="secondary" numberOfLines={2}>{subtitle}</T>}
    </View>
    {value && <T v="body" tone="secondary" numberOfLines={1} style={{ maxWidth: '45%' }}>{value}</T>}
    {trailing}
    {chevron && <Ionicons name="chevron-forward" size={17} color={c.tertiary} />}
  </>;
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, paddingVertical: 10 };
  return onPress ? <Pressable accessibilityRole={selection === undefined ? 'button' : 'checkbox'} aria-checked={selection} accessibilityState={{ disabled: !!disabled, ...(selection === undefined ? {} : { checked: selection }) }} accessibilityLabel={accessibilityLabel || (selection === undefined ? title : `${title}, ${selection ? 'selected' : 'not selected'}`)} disabled={disabled} onPress={() => { haptic.tap(); onPress(); }} style={({ pressed }) => [style, pressed && { backgroundColor: c.fill }, disabled && { opacity: 0.4 }]}>{body}</Pressable> : <View style={style}>{body}</View>;
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm }}>
    <Ionicons name={icon} size={46} color={c.tertiary} style={{ marginBottom: space.xs }} />
    <T v="title3" center>{title}</T>
    <T v="subhead" tone="secondary" center style={{ maxWidth: 320 }}>{text}</T>
    {action && <View style={{ marginTop: space.md, alignSelf: 'stretch', alignItems: 'center' }}>{action}</View>}
  </View>;
}

export function SectionHeader({ title, detail, action, style }: { title: string; detail?: string; action?: { label: string; onPress: () => void }; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xxl, marginBottom: space.md }, style]}>
    <T v="title2" weight="heavy" accessibilityRole="header">{title}</T>
    {action ? <Pressable accessibilityRole="button" hitSlop={10} onPress={action.onPress}><T v="callout" tone="accent">{action.label}</T></Pressable>
      : detail ? <T v="footnote" tone="secondary" tabular>{detail}</T> : null}
  </View>;
}

/** Bottom sheet: a page sheet on iOS, a full-height sliding panel elsewhere. */
export function Sheet({ visible, onClose, title, children, action }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const { c } = useTheme();
  return <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <SafeAreaProvider>
      <SafeAreaView edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
        {Platform.OS === 'ios' && <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.fillStrong, marginTop: 6 }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 54 }}>
          <View style={{ width: 70 }} />
          <T v="headline" center style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>{title}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Done" hitSlop={10} onPress={onClose} style={{ width: 70, alignItems: 'flex-end' }}><T v="headline" tone="accent">Done</T></Pressable>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
        {action && <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>{action}</View>}
      </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

/** Centered alert-style dialog with a primary and a cancel action. */
export function Dialog({ visible, title, description, confirmLabel = 'Confirm', destructive = false, busy = false, onCancel, onConfirm, children }: {
  visible: boolean; title: string; description: string; confirmLabel?: string; destructive?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void; children?: React.ReactNode;
}) {
  const { c } = useTheme();
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <View style={{ flex: 1, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
      <View accessibilityViewIsModal style={[{ backgroundColor: c.elevated, borderRadius: radius.xl, padding: space.xl, width: '100%', maxWidth: 380, gap: space.md, ...curve }, shadow(c, 3)]}>
        <T v="title3" accessibilityRole="header">{title}</T>
        <T v="subhead" tone="secondary">{description}</T>
        {children}
        <View style={{ gap: space.sm, marginTop: space.xs }}>
          <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} loading={busy} onPress={onConfirm} />
          <Button label="Cancel" variant="plain" disabled={busy} onPress={onCancel} />
        </View>
      </View>
    </View>
  </Modal>;
}

/** Horizontally scrolling filter pills, for choices with too many options for a segmented control. */
export function Chips<V extends string>({ options, value, onChange, style }: { options: { value: V; label: string; icon?: IconName }[]; value: V; onChange: (value: V) => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={[{ flexGrow: 0 }, style]} contentContainerStyle={{ gap: space.sm, paddingHorizontal: 2 }}>
    {options.map((option) => {
      const active = option.value === value;
      return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={option.label}
        onPress={() => { if (!active) { haptic.select(); onChange(option.value); } }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: active ? c.inverse : c.fill }}>
        {option.icon && <Ionicons name={option.icon} size={14} color={active ? c.onInverse : c.text} />}
        <Text maxFontSizeMultiplier={1.3} style={[type.subhead, { fontFamily: font.semibold, color: active ? c.onInverse : c.text }]}>{option.label}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

/** Marks a Riffs house bot next to its name, everywhere it appears. */
export function BotBadge() {
  const { c } = useTheme();
  return <View accessible accessibilityLabel="Bot account" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.fill, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6, alignSelf: 'center' }}>
    <Ionicons name="hardware-chip-outline" size={10} color={c.secondary} />
    <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.semibold, fontSize: 10.5, color: c.secondary, letterSpacing: 0.2 }}>BOT</Text>
  </View>;
}

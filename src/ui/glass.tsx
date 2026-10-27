import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MusicItem } from '../lib/types';
import { curve, radius } from './theme';

/**
 * The music sets the colour: its cover, blurred, behind a dark frosted pane. Content on it is white in
 * both themes, like the item page hero.
 */
export function GlassTile({ item, children, style }: { item: MusicItem; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const uri = item.artwork;
  return <View style={[{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#1A1A1E', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', ...curve }, style]}>
    {!!uri && <Image source={{ uri }} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.4 }] }]} contentFit="cover" blurRadius={Platform.OS === 'android' ? 25 : 45} />}
    <LinearGradient colors={['rgba(0,0,0,0.30)', 'rgba(0,0,0,0.62)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    {/* A faint top highlight is what makes it read as glass rather than a dark box. */}
    <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']} style={[StyleSheet.absoluteFill, { bottom: '55%' }]} />
    {children}
  </View>;
}

import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { categories, formatScore, scoreColor } from '../lib/categories';
import { MusicItem } from '../lib/types';
import { Artwork, Avatar } from './primitives';
import { font } from './theme';
import { CardLayout, cardTransform } from './videoLayout';

// The cards burned into Riffs videos. They are drawn on a 360-wide grid and scaled by `k`, so the
// on-screen preview and the 1080×1920 export match exactly. Frosted light glass over the camera,
// dark ink, and a score ring — readable over any face or room.
const GLASS = 'rgba(246,246,248,0.9)', INK = '#111113', MUTED = '#6E6E73', GOLD = '#C99700';
const shadowText = (k: number) => ({ textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 * k, textShadowOffset: { width: 0, height: 1 } });
const mark = require('../../assets/brand/riffs-mark-black.png');

/** A coloured ring with the score inside — the score treatment shared by every Riffs video. */
export function ScoreRing({ score, size, k = 1 }: { score: number; size: number; k?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size * 0.075), borderColor: scoreColor(score), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)' }}>
    <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.heavy, fontSize: size * 0.32, letterSpacing: -0.5 * k, color: INK, fontVariant: ['tabular-nums'] }}>{formatScore(score)}</Text>
  </View>;
}

function Byline({ name, handle, avatar, k, size = 26 }: { name: string; handle: string; avatar?: string; k: number; size?: number }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 * k }}>
    <Avatar size={size * k} name={name} uri={avatar} seed={handle} />
    <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.semibold, fontSize: size * 0.48 * k, color: INK }}>{handle}</Text>
    <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.medium, fontSize: size * 0.44 * k, color: MUTED }}>now</Text>
  </View>;
}

/** One rating, as a frosted card in the upper third of the frame. The take sits inside the card as a quote. */
export function ReviewCard({ item, score, take, name, handle, avatar, width, layout }: { item: MusicItem; score: number; take: string; name: string; handle: string; avatar?: string; width: number; layout?: CardLayout }) {
  const k = width / 360;
  const sub = item.kind === 'song' && item.album ? `${item.artist} · ${item.album}` : `${item.artist} · ${categories[item.kind].label}`;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingHorizontal: 18 * k, paddingTop: 150 * k }]}>
    <View style={{ backgroundColor: GLASS, borderRadius: 18 * k, padding: 14 * k, gap: 12 * k, transform: cardTransform(layout, width, width * 16 / 9) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Byline name={name} handle={handle} avatar={avatar} k={k} />
        <Image source={mark} style={{ width: 24 * k, height: 24 * k }} contentFit="contain" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
        <Artwork item={item} size={86 * k} rounded={8 * k} />
        <View style={{ flex: 1, gap: 3 * k }}>
          <Text maxFontSizeMultiplier={1} numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 18 * k, lineHeight: 22 * k, letterSpacing: -0.3 * k, color: INK }}>{item.title}</Text>
          <Text maxFontSizeMultiplier={1} numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 12.5 * k, lineHeight: 16 * k, color: MUTED }}>{sub}</Text>
        </View>
        <ScoreRing score={score} size={62 * k} k={k} />
      </View>
      {!!take.trim() && <Text maxFontSizeMultiplier={1} numberOfLines={3} style={{ fontFamily: font.medium, fontStyle: 'italic', fontSize: 15 * k, lineHeight: 20 * k, color: INK }}>“{take.trim()}”</Text>}
    </View>
  </View>;
}

/**
 * The ranking countdown: a frosted list that fills from last place up. `revealed` counts picks shown from the
 * bottom; the newest reveal is expanded with a bigger cover, its score, and the one-liner said about it.
 */
export function CountdownCard({ items, scores, notes, title, name, handle, avatar, revealed, width, layout }: {
  items: MusicItem[]; scores: (number | undefined)[]; notes: string[]; title: string; name: string; handle: string; avatar?: string; revealed: number; width: number; layout?: CardLayout;
}) {
  const k = width / 360, n = items.length, latest = revealed > 0 ? n - revealed : -1;
  // Ten picks plus the expanded reveal must fit a 9:16 frame under the title.
  const row = Math.min(38, 330 / Math.max(n, 1)) * k;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { paddingHorizontal: 16 * k, paddingTop: 54 * k }]}>
    <View style={{ transform: cardTransform(layout, width, width * 16 / 9) }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
      <Avatar size={30 * k} name={name} uri={avatar} seed={handle} />
      <Text maxFontSizeMultiplier={1} style={[{ fontFamily: font.semibold, fontSize: 13 * k, color: '#FFFFFF' }, shadowText(k)]}>{handle}</Text>
    </View>
    <Text maxFontSizeMultiplier={1} numberOfLines={2} style={[{ fontFamily: font.heavy, fontSize: 25 * k, lineHeight: 29 * k, letterSpacing: -0.7 * k, color: '#FFFFFF', marginTop: 8 * k }, shadowText(k)]}>{title || 'My ranking'}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * k, marginTop: 2 * k, marginBottom: 12 * k }}>
      <Text maxFontSizeMultiplier={1} style={[{ fontFamily: font.semibold, fontSize: 12 * k, color: '#FFFFFFE6' }, shadowText(k)]}>on Riffs</Text>
      <Image source={require('../../assets/brand/riffs-mark-white.png')} style={{ width: 14 * k, height: 14 * k }} contentFit="contain" />
    </View>
    <View style={{ backgroundColor: GLASS, borderRadius: 18 * k, paddingVertical: 6 * k, paddingHorizontal: 8 * k }}>
      {items.map((item, index) => {
        const shown = index >= n - revealed, hot = index === latest, score = scores[index], note = notes[index]?.trim();
        const number = <Text maxFontSizeMultiplier={1} style={{ width: 26 * k, fontFamily: font.heavy, fontSize: (hot ? 22 : 17) * k, color: index === 0 ? GOLD : INK, textAlign: 'center' }}>{index + 1}</Text>;
        if (hot) return <View key={item.id} style={{ backgroundColor: '#FFFFFF', borderRadius: 14 * k, padding: 8 * k, marginVertical: 4 * k, gap: 6 * k, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 * k, shadowOffset: { width: 0, height: 2 * k } }}>
          <View style={{ marginLeft: 34 * k }}><Byline name={name} handle={handle} avatar={avatar} k={k} size={18} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
            {number}
            <Artwork item={item} size={52 * k} rounded={6 * k} />
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1} numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15 * k, color: INK }}>{item.title}</Text>
              <Text maxFontSizeMultiplier={1} numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 11.5 * k, color: MUTED }}>{item.artist}</Text>
            </View>
            {score !== undefined && <ScoreRing score={score} size={44 * k} k={k} />}
          </View>
          {!!note && <Text maxFontSizeMultiplier={1} numberOfLines={2} style={{ marginLeft: 34 * k, fontFamily: font.medium, fontStyle: 'italic', fontSize: 12.5 * k, color: INK }}>“{note}”</Text>}
        </View>;
        return <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k, minHeight: row, borderRadius: 10 * k, paddingRight: 2 * k, backgroundColor: index === 0 ? 'rgba(255,204,0,0.22)' : 'transparent' }}>
          {number}
          {shown && <>
            <Artwork item={item} size={30 * k} rounded={4 * k} />
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1} numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 12.5 * k, color: INK }}>{item.title}</Text>
              <Text maxFontSizeMultiplier={1} numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 10 * k, color: MUTED }}>{item.artist}</Text>
            </View>
            {score !== undefined && <ScoreRing score={score} size={28 * k} k={k} />}
          </>}
        </View>;
      })}
    </View>
    </View>
  </View>;
}

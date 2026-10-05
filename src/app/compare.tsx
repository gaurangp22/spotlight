import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { errorMessage } from '../lib/api';
import { compareRankings } from '../lib/compare';
import { useApp } from '../store/AppContext';
import { Loading, Screen } from '../ui/components';
import { Artwork, Avatar, Button, Card, SectionHeader, T } from '../ui/primitives';
import { curve, makeStyles, radius, space, useTheme } from '../ui/theme';

function verdict(score: number, common: number) {
  if (common < 2) return 'Not enough overlap to compare yet.';
  if (score >= 85) return 'Practically the same brain.';
  if (score >= 60) return 'Mostly in sync, with a few fights.';
  if (score >= 35) return 'Plenty to argue about.';
  return 'Opposite ends of the room.';
}

export default function CompareScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { left, right } = useLocalSearchParams<{ left: string; right: string }>();
  const { allRankings, loadPost } = useApp();
  const [error, setError] = useState('');
  const meter = useSharedValue(0);
  useEffect(() => { let active = true; Promise.all([loadPost(left), loadPost(right)]).catch((e) => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, [left, right, loadPost]);
  const mine = allRankings.find((entry) => entry.id === left);
  const theirs = allRankings.find((entry) => entry.id === right);
  const comparison = mine && theirs ? compareRankings(mine.items, theirs.items) : null;
  const agreement = comparison?.agreement;
  useEffect(() => { if (agreement !== undefined) meter.set(withDelay(200, withTiming(agreement / 100, { duration: 700 }))); }, [agreement, meter]);
  const fill = useAnimatedStyle(() => ({ width: `${meter.value * 100}%` }));

  if (!mine || !theirs || !comparison) return <Screen back title="Compare">{error ? <Card style={{ marginTop: space.xl }}><T v="subhead" tone="secondary">{error}</T></Card> : <Loading label="Lining up both rankings…" />}</Screen>;
  const shared = new Set(mine.items.filter((item) => theirs.items.some((other) => other.id === item.id)).map((item) => item.id));
  const rows = Math.max(mine.items.length, theirs.items.length);
  const biggest = comparison.biggest;

  return <Screen back title="Compare" footer={<Button label="Share my ranking" icon="share-outline" onPress={() => router.push(`/share/${mine.id}`)} />}>
    <View style={s.hero}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={mine.author} seed={mine.handle} size={40} />
        <View style={{ marginLeft: -10, borderRadius: 22, borderWidth: 2, borderColor: '#161514' }}><Avatar name={theirs.author} seed={theirs.handle} size={40} /></View>
        <T v="callout" weight="semibold" style={{ color: '#FFFFFF', marginLeft: space.md, flex: 1 }} numberOfLines={1}>{mine.author} × {theirs.author}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xl }}>
        <T v="display" tabular style={{ color: '#FFFFFF', fontSize: 76, lineHeight: 80, letterSpacing: -3 }}>{comparison.agreement}</T>
        <T v="title2" style={{ color: '#FFFFFF99', marginBottom: 12, marginLeft: 2 }}>%</T>
      </View>
      <T v="headline" style={{ color: '#FFFFFF' }}>{verdict(comparison.agreement, comparison.common)}</T>
      <View style={s.meter}><Animated.View style={[s.meterFill, fill]} /></View>
      <T v="footnote" style={{ color: '#FFFFFFA6', marginTop: space.sm }}>{comparison.common} shared {comparison.common === 1 ? 'pick' : 'picks'} · a playful measure of how closely your orders line up</T>
    </View>

    {biggest && <>
      <SectionHeader title="Biggest split" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Artwork item={biggest} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="headline" numberOfLines={2}>{biggest.title}</T>
          <T v="footnote" tone="secondary">{mine.author} #{mine.items.findIndex((item) => item.id === biggest.id) + 1} · {theirs.author} #{theirs.items.findIndex((item) => item.id === biggest.id) + 1}</T>
        </View>
      </Card>
    </>}

    <SectionHeader title="Side by side" />
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={[s.row, { backgroundColor: c.fill }]}>
        <T v="overline" tone="secondary" style={s.cell} numberOfLines={1}>{mine.author}</T>
        <T v="overline" tone="secondary" style={s.cell} numberOfLines={1}>{theirs.author}</T>
      </View>
      {Array.from({ length: rows }, (_, index) => <View key={index} style={[s.row, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }]}>
        {[mine.items[index], theirs.items[index]].map((item, side) => <View key={side} style={[s.cell, s.cellRow]}>
          {item && <>
            <T v="footnote" weight="bold" tabular tone="secondary" style={{ width: 18 }}>{index + 1}</T>
            <Artwork item={item} size={30} rounded={6} />
            <T v="footnote" weight={shared.has(item.id) ? 'semibold' : 'regular'} tone={shared.has(item.id) ? 'primary' : 'secondary'} numberOfLines={2} style={{ flex: 1 }}>{item.title}</T>
          </>}
        </View>)}
      </View>)}
    </Card>
    <T v="footnote" tone="secondary" style={{ marginTop: space.sm, marginLeft: 4 }}>Picks you both chose are shown in bold.</T>
  </Screen>;
}

const useStyles = makeStyles(() => ({
  hero: { backgroundColor: '#161514', borderRadius: radius.xl, padding: space.xl, marginTop: space.xs, ...curve },
  meter: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF26', marginTop: space.lg, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3, backgroundColor: '#FF6B4A' },
  row: { flexDirection: 'row', paddingHorizontal: space.md, minHeight: 50, alignItems: 'center' },
  cell: { flex: 1, paddingRight: space.sm },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
}));

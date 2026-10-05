import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { goBack, MusicRow, Screen } from '../ui/components';
import { haptic } from '../ui/haptics';
import { Artwork, Button, Card, EmptyState, IconButton, Ionicons, T, Tap } from '../ui/primitives';
import { curve, makeStyles, radius, shadow, space, useTheme } from '../ui/theme';

export default function BattleScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { draft, setDraft } = useApp();
  const [items] = useState(() => [...draft.items]);
  // Shuffle matchup order once so the same song isn't on screen for several rounds in a row.
  const [pairs] = useState(() => {
    const all = items.flatMap((_, i) => items.slice(i + 1).map((__, offset) => [i, i + offset + 1] as const));
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return all;
  });
  const [round, setRound] = useState(0);
  const [wins, setWins] = useState<Record<string, number>>({});
  const [result, setResult] = useState<MusicItem[] | null>(null);
  const progress = useSharedValue(0);
  useEffect(() => { progress.set(withTiming(pairs.length ? (result ? 1 : round / pairs.length) : 0, { duration: 260 })); }, [round, result, pairs.length, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (items.length < 2) return <Screen back title="Battle Mode"><Card><EmptyState icon="flash-outline" title="Add some contenders" text="Battle Mode needs at least two picks in your draft." action={<Button label="Back to draft" inline onPress={goBack} />} /></Card></Screen>;

  const finish = (scores: Record<string, number>) => {
    // Win count decides the order; ties keep their previous relative order.
    const sorted = [...items].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || items.indexOf(a) - items.indexOf(b));
    setDraft((current) => ({ ...current, items: sorted }));
    setResult(sorted);
    haptic.success();
  };
  const pick = (winner: MusicItem) => {
    const next = { ...wins, [winner.id]: (wins[winner.id] ?? 0) + 1 };
    setWins(next);
    if (round + 1 >= pairs.length) finish(next); else setRound(round + 1);
  };
  const pair = pairs[Math.min(round, pairs.length - 1)];
  const close = () => router.canGoBack() ? router.back() : router.replace('/builder');

  return <Screen title={result ? 'Results' : `${round + 1} of ${pairs.length}`}
    left={<IconButton icon="close" label="Close Battle Mode" onPress={close} size={36} />}
    right={!result && round > 0 ? <Button label="Finish" variant="plain" size="sm" inline onPress={() => finish(wins)} /> : undefined}
    footer={result ? <Button label="Review my ranking" iconRight="arrow-forward" onPress={() => router.replace('/builder')} /> : undefined}>
    <View style={s.track}><Animated.View style={[s.fill, bar]} /></View>

    {result ? <Animated.View entering={FadeInDown.duration(380)}>
      <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={s.done}><Ionicons name="checkmark" size={34} color={c.onAccent} /></Animated.View>
        <T v="title1" center style={{ marginTop: space.md }}>Your order is ready.</T>
        <T v="subhead" tone="secondary" center style={{ maxWidth: 320 }}>Picks with equal wins kept their earlier order. Fine-tune anything before you publish.</T>
      </View>
      <Card padded={false} style={{ paddingHorizontal: space.lg }}>
        {result.map((item, index) => <MusicRow key={item.id} item={item} index={index} size={44} separator={index < result.length - 1}
          trailing={<T v="footnote" tone="secondary" tabular>{wins[item.id] ?? 0} {(wins[item.id] ?? 0) === 1 ? 'win' : 'wins'}</T>} />)}
      </Card>
    </Animated.View> : <>
      <T v="title1" center style={{ marginTop: space.xxl }}>Which one wins?</T>
      <T v="subhead" tone="secondary" center style={{ marginTop: space.xs }}>Go with your gut. Tap the one you’d keep.</T>
      <Animated.View key={round} entering={FadeIn.duration(220)} style={s.arena}>
        {pair.map((index) => {
          const item = items[index];
          return <Tap key={item.id} onPress={() => pick(item)} feedback="press" scaleTo={0.95} accessibilityLabel={`Choose ${item.title} by ${item.artist}`} style={s.choice}>
            <Artwork item={item} fill rounded={radius.md} />
            <T v="headline" numberOfLines={2} style={{ marginTop: space.md }}>{item.title}</T>
            <T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}</T>
          </Tap>;
        })}
        <View style={s.vs} pointerEvents="none"><T v="caption" weight="heavy" style={{ color: c.onInverse, letterSpacing: 0.5 }}>VS</T></View>
      </Animated.View>
      <T v="footnote" tone="tertiary" center style={{ marginTop: space.xl }}>You can finish early and fine-tune the order by hand.</T>
    </>}
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  track: { height: 4, borderRadius: 2, backgroundColor: c.fill, overflow: 'hidden', marginTop: space.xs },
  fill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
  arena: { flexDirection: 'row', gap: space.md, marginTop: space.xxl, alignItems: 'stretch' },
  choice: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, ...curve, ...shadow(c, 2) },
  vs: { position: 'absolute', left: '50%', top: '34%', marginLeft: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg },
  done: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentFill, alignItems: 'center', justifyContent: 'center' },
}));

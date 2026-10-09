import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { activeKinds, categories, formatScore, tiers } from '../lib/categories';
import { answer, comparisonsLeft, Insertion, isSettled, pivot, startInsertion, tierScores } from '../lib/scoring';
import { MusicItem, MusicKind, Ranking, Tier } from '../lib/types';
import { useApp } from '../store/AppContext';
import { goBack, Screen, ScoreBadge } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker, useAvailableKinds } from '../ui/MusicPicker';
import { Artwork, Badge, Button, Card, IconButton, Ionicons, SectionHeader, T, Tap, TextField } from '../ui/primitives';
import { SpotifyLinkImport } from '../ui/SpotifyLinkImport';
import { curve, makeStyles, radius, shadow, space, useTheme } from '../ui/theme';

type Step = 'pick' | 'tier' | 'compare' | 'review';

export default function RateScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ itemId?: string; kind?: MusicKind }>();
  const { itemFor, ratingFor, ratings, rate, user, spotifyConnected, config } = useApp();
  const { busy, run } = useTask();
  const kinds = useAvailableKinds(activeKinds);
  const [item, setItem] = useState<MusicItem | undefined>(() => (params.itemId ? itemFor(params.itemId) : undefined));
  const previous = item ? ratingFor(item.id) : undefined;
  const [step, setStep] = useState<Step>(item ? 'tier' : 'pick');
  const [picking, setPicking] = useState<MusicKind | null>(null);
  const [tier, setTier] = useState<Tier>(2);
  const [search, setSearch] = useState<Insertion>(startInsertion(0));
  const [review, setReview] = useState(previous?.review ?? '');
  const [visibility, setVisibility] = useState<Ranking['visibility']>(previous?.visibility ?? 'public');

  // Your other ratings in this category and tier, best first: the opponents for the comparison game.
  const opponents = useMemo(() => item ? ratings.filter((r) => r.category === item.kind && r.tier === tier && r.item.id !== item.id).sort((a, b) => a.position - b.position) : [], [ratings, item, tier]);
  const position = search.lo;
  const preview = tierScores(tier, opponents.length + 1)[Math.min(position, opponents.length)];

  const choose = (picked: MusicItem) => {
    setPicking(null); setItem(picked);
    const existing = ratingFor(picked.id);
    setReview(existing?.review ?? ''); setVisibility(existing?.visibility ?? 'public');
    setStep('tier');
  };
  const pickTier = (value: Tier) => {
    haptic.press(); setTier(value);
    const count = item ? ratings.filter((r) => r.category === item.kind && r.tier === value && r.item.id !== item.id).length : 0;
    setSearch(startInsertion(count));
    setStep(count ? 'compare' : 'review');
  };
  const respond = (choice: 'better' | 'worse' | 'tie') => {
    const next = answer(search, choice);
    setSearch(next);
    if (isSettled(next)) { haptic.success(); setStep('review'); }
  };
  const save = async () => {
    if (!item) return;
    if (!user) { router.push('/auth'); return; }
    const post = await rate({ item, tier, position, review: review.trim(), visibility });
    haptic.success();
    router.replace(`/ranking/${post.id}`);
  };
  const close = <IconButton icon="close" label="Close" onPress={goBack} size={36} />;
  const back = (to: Step) => <IconButton icon="chevron-back" label="Back" onPress={() => setStep(to)} size={36} />;

  if (step === 'pick' || !item) return <Screen left={close} title="Rate">
    <T v="largeTitle" style={{ marginTop: space.sm }}>What are you rating?</T>
    <T v="subhead" tone="secondary" style={{ marginTop: space.xs }}>Pick anything. A few quick head-to-heads turn your gut reaction into a score out of 10.</T>
    <Button label="Search everything" icon="search" style={{ marginTop: space.xl }} onPress={() => setPicking(kinds[0])} />
    <View style={s.grid}>
      {kinds.map((kind) => <Tap key={kind} onPress={() => setPicking(kind)} accessibilityLabel={`Rate ${categories[kind].plural.toLowerCase()}`} style={[s.tile, { backgroundColor: categories[kind].tint }]}>
        <Ionicons name={categories[kind].icon} size={22} color="#FFFFFF" />
        <T v="headline" style={{ color: '#FFFFFF' }}>{categories[kind].plural}</T>
      </Tap>)}
    </View>
    {config?.spotifyCatalog && <SpotifyLinkImport label="Use this" style={{ marginTop: space.xl }} onImport={(result) => choose(result.items[0])} />}
    <MusicPicker visible={!!picking} onClose={() => setPicking(null)} onPick={choose} kinds={kinds} initialKind={picking ?? undefined} title="Rate something" spotifyConnected={spotifyConnected} />
  </Screen>;

  const header = <View style={s.subject}>
    <Artwork item={item} size={64} rounded={12} />
    <View style={{ flex: 1, gap: 2 }}>
      <Badge label={categories[item.kind].label} icon={categories[item.kind].icon} />
      <T v="headline" numberOfLines={2}>{item.title}</T>
      <T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}</T>
    </View>
  </View>;

  if (step === 'tier') return <Screen left={params.itemId ? close : back('pick')} title="Rate">
    <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', marginTop: space.lg }}>
      <View style={[{ borderRadius: radius.lg, ...curve }, shadow(c, 3)]}><Artwork item={item} size={200} rounded={radius.lg} /></View>
      <T v="title1" center style={{ marginTop: space.xl }} numberOfLines={2}>{item.title}</T>
      <T v="subhead" tone="secondary" center>{item.artist}</T>
    </Animated.View>
    {previous && <T v="footnote" tone="secondary" center style={{ marginTop: space.md }}>You gave this a {formatScore(previous.score)}. Rating again re-places it.</T>}
    <T v="title3" center style={{ marginTop: space.xxl }}>How was it?</T>
    <View style={{ gap: space.sm, marginTop: space.lg }}>
      {tiers.map((t) => <Tap key={t.value} onPress={() => pickTier(t.value)} feedback={false} accessibilityLabel={t.label} style={[s.tier, { borderColor: t.color }]}>
        <View style={[s.tierIcon, { backgroundColor: t.color }]}><Ionicons name={t.icon} size={18} color="#FFFFFF" /></View>
        <T v="headline" style={{ flex: 1 }}>{t.label}</T>
        <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
      </Tap>)}
    </View>
  </Screen>;

  if (step === 'compare') {
    const rival = opponents[pivot(search)];
    const left = comparisonsLeft(search);
    return <Screen left={back('tier')} title="Which is better?">
      {header}
      <T v="title1" center style={{ marginTop: space.xl }}>Which do you prefer?</T>
      <T v="subhead" tone="secondary" center style={{ marginTop: space.xs }}>{left <= 1 ? 'Last one.' : `About ${left} more.`} Go with your gut.</T>
      <Animated.View key={`${search.lo}-${search.hi}`} entering={FadeIn.duration(200)} style={s.arena}>
        {[item, rival.item].map((entry, index) => <Tap key={entry.id} onPress={() => respond(index === 0 ? 'better' : 'worse')} feedback="press" scaleTo={0.95} accessibilityLabel={`Prefer ${entry.title}`} style={s.choice}>
          <Artwork item={entry} fill rounded={radius.md} />
          <T v="headline" numberOfLines={2} style={{ marginTop: space.md }}>{entry.title}</T>
          <T v="footnote" tone="secondary" numberOfLines={1}>{index === 0 ? 'New' : `Your ${formatScore(rival.score)}`} · {entry.artist}</T>
        </Tap>)}
        <View style={s.vs} pointerEvents="none"><T v="caption" weight="heavy" style={{ color: c.onInverse, letterSpacing: 0.5 }}>VS</T></View>
      </Animated.View>
      <Button label="Too close to call" variant="secondary" style={{ marginTop: space.xl }} onPress={() => respond('tie')} />
    </Screen>;
  }

  const tierInfo = tiers.find((t) => t.value === tier)!;
  return <Screen left={back(opponents.length ? 'compare' : 'tier')} title="Your rating"
    footer={<Button label={!user ? 'Sign in to post' : previous ? 'Update review' : 'Post review'} icon="arrow-up" loading={busy} onPress={() => void run(save)} />}>
    <Animated.View entering={FadeInDown.duration(320)} style={{ alignItems: 'center', marginTop: space.lg }}>
      <View>
        <Artwork item={item} size={168} rounded={radius.lg} />
        <Animated.View entering={ZoomIn.delay(150).springify().damping(11)} style={{ position: 'absolute', right: -16, bottom: -16 }}><ScoreBadge score={preview} size={72} ring /></Animated.View>
      </View>
      <T v="title2" center style={{ marginTop: space.xl }} numberOfLines={2}>{item.title}</T>
      <T v="subhead" tone="secondary" center>{tierInfo.label} · #{position + 1} of {opponents.length + 1} in this tier</T>
    </Animated.View>
    <Card style={{ marginTop: space.xl }}>
      <TextField label="Your review (optional)" value={review} onChangeText={setReview} multiline maxLength={1000} placeholder="Perfection. Or not. Say why." hint={`${review.length}/1000`} />
    </Card>
    <SectionHeader title="Who can see it" />
    <Visibility value={visibility} onChange={setVisibility} />
    <T v="footnote" tone="secondary" style={{ marginTop: space.lg }}>Scores are personal: as you rate more {categories[item.kind].plural.toLowerCase()}, they shift to keep your order honest.</T>
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xl },
  tile: { width: '47%', flexGrow: 1, minHeight: 92, borderRadius: radius.lg, padding: space.lg, justifyContent: 'space-between', ...curve },
  subject: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm, padding: space.md, backgroundColor: c.surface, borderRadius: radius.lg, ...curve },
  tier: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: space.lg, borderRadius: radius.lg, borderWidth: 1.5, backgroundColor: c.surface, ...curve },
  tierIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  arena: { flexDirection: 'row', gap: space.md, marginTop: space.xl, alignItems: 'stretch' },
  choice: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, ...curve, ...shadow(c, 2) },
  vs: { position: 'absolute', left: '50%', top: '34%', marginLeft: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg },
}));

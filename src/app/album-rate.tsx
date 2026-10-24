import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api, errorMessage } from '../lib/api';
import { formatScore, scoreColor } from '../lib/categories';
import { MusicItem, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { goBack, Loading, MusicRow, Screen, ScoreBadge } from '../ui/components';
import { useTask, Visibility } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { MusicPicker } from '../ui/MusicPicker';
import { RankingReveal } from '../ui/RankingReveal';
import { Artwork, Button, Card, EmptyState, IconButton, Ionicons, SectionHeader, T, Tap, TextField } from '../ui/primitives';
import { curve, makeStyles, radius, space, useTheme } from '../ui/theme';

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Only what the catalog gave us: local colours and pod credits don't belong in a post. */
const plain = ({ color: _color, addedBy: _addedBy, score: _score, ...item }: MusicItem) => item;
/** Post titles stop at 100 characters; long album names fall back to just the name. */
const defaultTitle = (album: MusicItem) => `${album.title}, track by track`.length <= 100 ? `${album.title}, track by track` : album.title.slice(0, 100);
const average = (values: number[]) => Math.round(values.reduce((sum, v) => sum + v, 0) / values.length * 10) / 10;

/** One track: tap to open the 1–10 scale; picking a score moves on to the next unscored track. */
function TrackRow({ item, number, score, open, showArtist, onOpen, onScore }: {
  item: MusicItem; number: number; score?: number; open: boolean; showArtist: boolean; onOpen: (id: string) => void; onScore: (id: string, score: number | undefined) => void;
}) {
  const s = useStyles();
  const { c } = useTheme();
  return <View style={[s.track, open && { backgroundColor: c.fill }]}>
    <Tap onPress={() => onOpen(item.id)} feedback={false} scaleTo={1} accessibilityLabel={`${item.title}${score !== undefined ? `, scored ${score}` : ', not scored'}`} accessibilityState={{ expanded: open }} style={s.trackHead}>
      <T v="subhead" tabular tone="secondary" center style={{ width: 26 }}>{number}</T>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="headline" weight="medium" numberOfLines={1}>{item.title}</T>
        {showArtist && <T v="footnote" tone="secondary" numberOfLines={1}>{item.artist}</T>}
      </View>
      {score !== undefined ? <ScoreBadge score={score} size={36} /> : <View style={[s.empty, { borderColor: c.hairline }]}><Ionicons name="add" size={16} color={c.tertiary} /></View>}
    </Tap>
    {open && <Animated.View entering={FadeInDown.duration(180)} style={s.scale}>
      {SCALE.map((value) => {
        const on = score === value;
        return <Tap key={value} onPress={() => onScore(item.id, on ? undefined : value)} feedback={false} scaleTo={0.9} accessibilityLabel={on ? `Clear score ${value}` : `Score ${value}`} accessibilityState={{ selected: on }}
          style={[s.chip, { backgroundColor: on ? scoreColor(value) : c.surface, borderColor: on ? scoreColor(value) : c.hairline }]}>
          <T v="subhead" weight="semibold" tabular style={{ color: on ? '#FFFFFF' : c.text }}>{value}</T>
        </Tap>;
      })}
    </Animated.View>}
  </View>;
}

export default function AlbumRateScreen() {
  const s = useStyles();
  const params = useLocalSearchParams<{ itemId?: string; editId?: string }>();
  const { itemFor, allRankings, user, spotifyConnected, saveAlbumRating, rememberItem } = useApp();
  const editing = params.editId ? allRankings.find((p) => p.id === params.editId && p.album) : undefined;
  const { busy, run } = useTask();
  const [album, setAlbum] = useState<MusicItem | undefined>(() => editing?.album ?? (params.itemId ? itemFor(params.itemId) : undefined));
  const [picking, setPicking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The tracklist (or error) for one album and attempt; a different key means it's still loading.
  const [loaded, setLoaded] = useState<{ key: string; items?: MusicItem[]; error?: string }>();
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries((editing?.items ?? []).flatMap((i) => i.score !== undefined ? [[i.id, i.score]] : [])));
  const [open, setOpen] = useState<string | undefined>();
  const [step, setStep] = useState<'score' | 'result'>('score');
  const [revealing, setRevealing] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [visibility, setVisibility] = useState<Ranking['visibility']>(editing?.visibility ?? 'public');

  const albumId = album?.id, key = `${albumId}:${attempt}`;
  const current = loaded?.key === key ? loaded : undefined;
  const tracks = current?.items ?? null, error = current?.error ?? '';
  useEffect(() => {
    if (!albumId) return;
    let active = true;
    api<{ album: MusicItem; items: MusicItem[] }>(`/catalog/album-tracks?${new URLSearchParams({ id: albumId })}`)
      .then((data) => { if (!active) return; setLoaded({ key, items: data.items }); setOpen((open) => open ?? data.items[0]?.id); })
      .catch((e) => { if (active) setLoaded({ key, error: errorMessage(e) }); });
    return () => { active = false; };
  }, [albumId, key]);

  const choose = (picked: MusicItem) => {
    setPicking(false);
    if (picked.id === album?.id) return;
    rememberItem(picked); setAlbum(picked); setScores({}); setOpen(undefined); setTitle(''); setStep('score');
  };
  const onOpen = (id: string) => { haptic.tap(); setOpen((current) => current === id ? undefined : id); };
  const onScore = (id: string, value: number | undefined) => {
    haptic.select();
    const next = { ...scores };
    if (value === undefined) delete next[id]; else next[id] = value;
    setScores(next);
    // Move on to the next track still waiting for a score, so a long album is just tap, tap, tap.
    if (value !== undefined && tracks) {
      const from = tracks.findIndex((t) => t.id === id);
      setOpen([...tracks.slice(from + 1), ...tracks.slice(0, from)].find((t) => next[t.id] === undefined)?.id);
    }
  };

  // Best first; ties keep the album's own order.
  const ranked = useMemo(() => (tracks ?? []).map((t, i) => ({ t, i })).filter(({ t }) => scores[t.id] !== undefined)
    .sort((a, b) => scores[b.t.id] - scores[a.t.id] || a.i - b.i).map(({ t }) => ({ ...plain(t), score: scores[t.id] })), [tracks, scores]);
  const mean = ranked.length ? average(ranked.map((t) => t.score)) : undefined;
  const total = tracks?.length ?? 0;

  const showResult = () => { haptic.press(); setStep('result'); setRevealing(true); if (!title.trim() && album) setTitle(defaultTitle(album)); };
  const post = async () => {
    if (!album) return;
    if (!user) { router.push('/auth'); return; }
    const saved = await saveAlbumRating({ album: plain(album), title: title.trim() || defaultTitle(album), subtitle: `Album average ${formatScore(mean!)} · ${ranked.length} of ${total} tracks scored`, items: ranked, visibility, editingId: editing?.id });
    haptic.success();
    router.replace(`/ranking/${saved.id}`);
  };

  const close = <IconButton icon="close" label="Close" onPress={goBack} size={36} />;
  const picker = <MusicPicker visible={picking} onClose={() => setPicking(false)} onPick={choose} kinds={['album']} initialKind="album" title="Rate an album" spotifyConnected={spotifyConnected} />;

  if (!album) return <Screen left={close} title="Rate an album">
    <T v="largeTitle" style={{ marginTop: space.sm }}>Every track, scored</T>
    <T v="subhead" tone="secondary" style={{ marginTop: space.xs }}>Pick an album and give each song a 1–10. Ten tracks or a hundred, you’ll get your order and the album’s average at the end.</T>
    <Button label="Choose an album" icon="disc" style={{ marginTop: space.xl }} onPress={() => setPicking(true)} />
    {picker}
  </Screen>;

  const header = <View style={s.subject}>
    <Artwork item={album} size={64} rounded={12} />
    <View style={{ flex: 1, gap: 2 }}>
      <T v="headline" numberOfLines={2}>{album.title}</T>
      <T v="footnote" tone="secondary" numberOfLines={1}>{album.artist}</T>
    </View>
    {!editing && <Button label="Change" variant="plain" size="sm" inline onPress={() => setPicking(true)} />}
  </View>;

  if (step === 'result' && album) return <Screen left={<IconButton icon="chevron-back" label="Back to scoring" onPress={() => setStep('score')} size={36} />} title="Your album rating"
    footer={<Button label={!user ? 'Sign in to post' : editing ? 'Save changes' : 'Post album rating'} icon="arrow-up" loading={busy} disabled={!title.trim()} onPress={() => void run(post)} />}>
    <View style={{ alignItems: 'center', marginTop: space.lg }}>
      <View>
        <Artwork item={album} size={160} rounded={radius.lg} />
        {mean !== undefined && <View style={{ position: 'absolute', right: -16, bottom: -16 }}><ScoreBadge score={mean} size={72} ring /></View>}
      </View>
      <T v="title2" center style={{ marginTop: space.xl }} numberOfLines={2}>{album.title}</T>
      <T v="subhead" tone="secondary" center>Album average · {ranked.length} of {total} tracks scored</T>
      <Button label="Watch the reveal again" icon="play" variant="plain" size="sm" inline style={{ marginTop: space.sm }} onPress={() => setRevealing(true)} />
    </View>
    <Card style={{ marginTop: space.xl }}>
      <TextField label="Title" value={title} onChangeText={setTitle} maxLength={100} />
    </Card>
    <SectionHeader title="Your order" detail={`${ranked.length} tracks`} />
    <Card padded={false} style={{ paddingLeft: space.md, paddingRight: space.md }}>
      {ranked.map((item, index) => <MusicRow key={item.id} item={item} index={index} size={40} separator={index < ranked.length - 1} trailing={<ScoreBadge score={item.score} size={34} />} />)}
    </Card>
    <SectionHeader title="Who can see it" />
    <Visibility value={visibility} onChange={setVisibility} />
    <RankingReveal visible={revealing} title={album.title} cover={album} items={ranked} onDone={() => setRevealing(false)} />
  </Screen>;

  const scored = ranked.length;
  return <Screen left={close} title={editing ? 'Edit album rating' : 'Rate an album'}
    footer={tracks && <View style={{ gap: space.sm }}>
      {scored > 0 && scored < total && <T v="footnote" tone="secondary" center>Tracks you skip are left out of your order.</T>}
      <Button label={scored < 2 ? 'Score at least two tracks' : `See your ranking (${scored})`} iconRight="arrow-forward" disabled={scored < 2} onPress={showResult} />
    </View>}>
    {header}
    {tracks && <View style={{ marginTop: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="footnote" weight="semibold" tabular>{scored} of {total} scored</T>
        {mean !== undefined && <T v="footnote" tone="secondary" tabular>Average so far {formatScore(mean)}</T>}
      </View>
      <View style={s.progress}><View style={[s.progressFill, { width: `${total ? (scored / total) * 100 : 0}%` }]} /></View>
    </View>}
    {error ? <Card style={{ marginTop: space.xl }}><EmptyState icon="disc-outline" title="Couldn’t load the tracks" text={error} action={<Button label="Try again" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />} /></Card>
      : !tracks ? <Loading label="Loading the tracklist…" />
      : <Card padded={false} style={{ marginTop: space.lg, overflow: 'hidden' }}>
        {tracks.map((item, index) => <View key={item.id} style={index > 0 && s.divider}>
          <TrackRow item={item} number={index + 1} score={scores[item.id]} open={open === item.id} showArtist={item.artist !== album.artist} onOpen={onOpen} onScore={onScore} />
        </View>)}
      </Card>}
    {picker}
  </Screen>;
}

const useStyles = makeStyles((c) => ({
  subject: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm, padding: space.md, backgroundColor: c.surface, borderRadius: radius.lg, ...curve },
  track: { paddingHorizontal: space.md },
  trackHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  empty: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  scale: { flexDirection: 'row', gap: 4, paddingBottom: space.md },
  chip: { flex: 1, height: 40, borderRadius: radius.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center', ...curve },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline },
  progress: { height: 6, borderRadius: 3, backgroundColor: c.fillStrong, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: c.accentFill },
}));

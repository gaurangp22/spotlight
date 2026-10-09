import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { IconName, Ionicons, ListGroup, ListRow, T, Tap } from '../../ui/primitives';
import { curve, font, radius, shadow, space, tints, useTheme } from '../../ui/theme';

/** The two things most people come here to do, as big tiles. */
function Hero({ icon, title, text, onPress, volt }: { icon: IconName; title: string; text: string; onPress: () => void; volt?: boolean }) {
  const { c } = useTheme();
  const ink = '#FFFFFF';
  const body = <>
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', ...curve }}><Ionicons name={icon} size={22} color={ink} /></View>
    <View style={{ gap: 4 }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: ink }}>{title}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 17, color: 'rgba(255,255,255,0.88)' }}>{text}</Text>
    </View>
  </>;
  const tile = { flex: 1, minHeight: 186, borderRadius: radius.lg, padding: space.lg, justifyContent: 'space-between' as const, ...curve };
  return <Tap onPress={onPress} feedback="press" accessibilityLabel={title} style={{ flex: 1 }}>
    {volt ? <View style={[tile, { backgroundColor: c.accentFill }]}>{body}</View>
      : <LinearGradient colors={[c.glowA, c.glowB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tile}>{body}</LinearGradient>}
  </Tap>;
}

function Tile({ icon, tint, title, text, onPress }: { icon: IconName; tint: string; title: string; text: string; onPress: () => void }) {
  const { c } = useTheme();
  return <Tap onPress={onPress} accessibilityLabel={title} style={[{ width: '48.5%', minHeight: 132, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, justifyContent: 'space-between', marginBottom: space.md, ...curve }, shadow(c, 1)]}>
    <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', ...curve }}><Ionicons name={icon} size={19} color="#FFFFFF" /></View>
    <View style={{ gap: 2, marginTop: space.md }}><T v="headline">{title}</T><T v="caption" tone="secondary" numberOfLines={2}>{text}</T></View>
  </Tap>;
}

export default function CreateScreen() {
  const { draft, moodDraft, takeDraft, startDraft, startTake } = useApp();
  const hasDraft = draft.items.length > 0 || !!draft.title.trim();
  const hasMood = !!(moodDraft.title || moodDraft.tiles.length || moodDraft.items.length);
  const hasTake = !!takeDraft.title || takeDraft.items.length > 0;
  return <Screen tab title="Create" large subtitle="Give people something to talk about.">
    {(hasDraft || hasMood || hasTake) && <ListGroup header="Pick up where you left off" style={{ marginTop: 0, marginBottom: space.xl }}>
      {hasTake && <ListRow icon="chatbubble-outline" title={takeDraft.title.trim() || 'Untitled take'} subtitle={takeDraft.poll ? 'Poll draft' : 'Take draft'} onPress={() => router.push('/take')} />}
      {hasDraft && <ListRow icon="list" iconColor={tints.amber} title={draft.title.trim() || 'Untitled ranking'} subtitle={`${draft.items.length} ${draft.items.length === 1 ? 'pick' : 'picks'}`} onPress={() => router.push('/builder')} />}
      {hasMood && <ListRow icon="images-outline" iconColor={tints.violet} title={moodDraft.title.trim() || 'Untitled mood board'} subtitle={`${moodDraft.items.length} songs · ${moodDraft.tiles.length} tiles`} onPress={() => router.push('/moodboard')} />}
    </ListGroup>}
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <Hero volt icon="flame" title="Hot take" text="One opinion, 280 characters." onPress={() => { startTake(undefined, false); router.push('/take'); }} />
      <Hero icon="star" title="Rate it" text="Head-to-heads give you a score." onPress={() => router.push('/rate')} />
    </View>
    <T v="overline" tone="secondary" style={{ marginTop: space.xxl, marginBottom: space.md }}>More to make</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Tile icon="stats-chart" tint={tints.violet} title="This or that" text="Two picks. Let friends settle it." onPress={() => { startTake(undefined, true); router.push('/take'); }} />
      <Tile icon="videocam" tint={tints.pink} title="Video review" text="Your face, your score, for Instagram." onPress={() => router.push('/video')} />
      <Tile icon="podium" tint={tints.amber} title="Ranking" text="Your exact order, no hedging." onPress={() => { startDraft(); router.push('/builder'); }} />
      <Tile icon="albums" tint={tints.teal} title="Pod" text="Collect music; friends add theirs." onPress={() => router.push('/pod')} />
    </View>
    <ListGroup style={{ marginTop: space.md }}>
      <ListRow icon="flash" iconColor={tints.sky} title="Battle Mode" subtitle="Rank by picking favourites head-to-head" onPress={() => { startDraft(); router.push({ pathname: '/builder', params: { mode: 'battle' } }); }} />
      <ListRow icon="download-outline" iconColor={tints.teal} title="Bring a playlist" subtitle="Import a public playlist or paste a track list" onPress={() => router.push('/import-playlist')} />
      <ListRow icon="images" iconColor={tints.violet} title="Mood board" subtitle="Songs, photos, and notes on one page" onPress={() => router.push('/moodboard')} />
    </ListGroup>
  </Screen>;
}

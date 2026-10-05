import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '../../store/AppContext';
import { RankingCard, Screen } from '../../ui/components';
import { Button, Card, EmptyState, IconButton, Ionicons, SectionHeader, T, Tap } from '../../ui/primitives';
import { curve, gutter, makeStyles, radius, space, useTheme } from '../../ui/theme';

const prompts = [
  { title: 'Five songs for someone who’s never met you', tint: '#C63A22' },
  { title: 'The albums that raised you', tint: '#2F5F7A' },
  { title: 'Songs that sound like the last day of summer', tint: '#995217' },
  { title: 'Your all-time top ten, no hedging', tint: '#4E3A78' },
];

function today() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function HomeScreen() {
  const s = useStyles();
  const { c } = useTheme();
  const { allRankings, draft, following, user, refresh, refreshing, startDraft, setDraft, unread } = useApp();
  const feed = allRankings.filter((ranking) => !user || ranking.userId === user.id || following.includes(ranking.handle));
  const hasDraft = draft.items.length > 0 || !!draft.title.trim();
  const startPrompt = (title: string) => { startDraft(); setDraft((current) => ({ ...current, title })); router.push('/builder'); };

  return <Screen tab title="Home" large eyebrow={today()} onRefresh={() => void refresh()} refreshing={refreshing}
    right={user ? <IconButton icon="notifications-outline" label={unread ? `Activity, ${unread} unread` : 'Activity'} badge={unread > 0} onPress={() => router.push('/notifications')} />
      : <Button label="Sign in" size="sm" variant="tinted" inline onPress={() => router.push('/auth')} />}>

    {!user && <Animated.View entering={FadeInDown.duration(380)}>
      <View style={s.hero}>
        <T v="overline" style={{ color: '#FFFFFFB3' }}>Music, in your own order</T>
        <T v="display" style={{ color: '#FFFFFF', marginTop: space.sm }}>Good taste is a conversation.</T>
        <T v="body" style={{ color: '#FFFFFFCC', marginTop: space.md }}>Rank the music you love. Remix your friends’ lists. See exactly where you disagree.</T>
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Button label="Create your account" onPress={() => router.push('/auth')} />
          <Button label="I already have one" variant="plain" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={{ minHeight: 44 }} />
        </View>
      </View>
    </Animated.View>}

    {hasDraft && <Card onPress={() => router.push('/builder')} style={s.draft}>
      <View style={s.draftIcon}><Ionicons name="create" size={20} color={c.accent} /></View>
      <View style={{ flex: 1 }}>
        <T v="headline" numberOfLines={1}>{draft.title.trim() || 'Untitled ranking'}</T>
        <T v="footnote" tone="secondary">Draft · {draft.items.length} {draft.items.length === 1 ? 'pick' : 'picks'} saved on this device</T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
    </Card>}

    <SectionHeader title="Start with a prompt" style={{ marginTop: hasDraft || !user ? space.xxl : space.sm }} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md }} decelerationRate="fast" snapToInterval={232 + space.md} snapToAlignment="start">
      {prompts.map((prompt) => <Tap key={prompt.title} onPress={() => startPrompt(prompt.title)} accessibilityLabel={`Start a ranking: ${prompt.title}`} style={[s.prompt, { backgroundColor: prompt.tint }]}>
        <Ionicons name="sparkles" size={18} color="#FFFFFFCC" />
        <T v="title3" style={{ color: '#FFFFFF', flex: 1, marginTop: space.md }} numberOfLines={4}>{prompt.title}</T>
        <View style={s.promptFoot}><T v="footnote" weight="semibold" style={{ color: '#FFFFFF' }}>Make yours</T><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></View>
      </Tap>)}
    </ScrollView>

    <SectionHeader title={user ? 'Following' : 'Featured'} detail={feed.length ? `${feed.length} ${feed.length === 1 ? 'post' : 'posts'}` : undefined} />
    {feed.length ? feed.map((ranking, index) => <Animated.View key={ranking.id} entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(320)}><RankingCard ranking={ranking} /></Animated.View>)
      : <Card><EmptyState icon="people-outline" title="Your feed is quiet" text="Follow people in Discover, or publish your first ranking to get the conversation going."
        action={<Button label="Find people" variant="tinted" inline onPress={() => router.push('/(tabs)/discover')} />} /></Card>}
  </Screen>;
}

const useStyles = makeStyles((c, dark) => ({
  hero: { backgroundColor: '#161514', borderRadius: radius.xl, padding: space.xl, paddingTop: space.xxl, marginBottom: space.md, overflow: 'hidden', ...curve, ...(dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline } : {}) },
  draft: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  draftIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', ...curve },
  prompt: { width: 232, height: 196, borderRadius: radius.lg, padding: space.lg, ...curve },
  promptFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF55' },
}));

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { errorMessage } from '../../lib/api';
import { activeKinds, categories } from '../../lib/categories';
import { searchCatalog } from '../../lib/music';
import { MusicItem, MusicKind, Profile, Ranking } from '../../lib/types';
import { InviteCard } from '../../ui/invite';
import { usePages } from '../../ui/pages';
import { useApp } from '../../store/AppContext';
import { MusicRow, RankingCard, Screen, ScoreBadge } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { TasteTwinsRow } from '../../ui/equals';
import { StarterPick, useAvailableKinds, useStarterPicks } from '../../ui/MusicPicker';
import { Avatar, Button, Card, Chips, EmptyState, Ionicons, SearchField, SectionHeader, T, BotBadge } from '../../ui/primitives';
import { gutter, space, useTheme } from '../../ui/theme';

type Scope = 'posts' | MusicKind;

/** Catalog results for one category, each opening that item's page. */
function CatalogResults({ kind, query }: { kind: MusicKind; query: string }) {
  const { c } = useTheme();
  const { spotifyConnected, config, rememberItem, ratingFor } = useApp();
  const term = query.trim();
  const key = `${kind}:${term}`;
  const [result, setResult] = useState<{ key: string; items: MusicItem[]; error: string }>({ key: '', items: [], error: '' });
  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(term, kind, { spotifyConnected, spotifyCatalog: !!config?.spotifyCatalog }, controller.signal)
        .then((items) => { if (active) setResult({ key, items, error: '' }); })
        .catch((e) => { if (active) setResult({ key, items: [], error: errorMessage(e) }); });
    }, 350);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [key, term, kind, spotifyConnected, config?.spotifyCatalog]);
  const picks = useStarterPicks(kind), starter = picks.items;
  // Basis names come lowercased from the taste profile ("metal", "metallica").
  const basis = picks.basis.slice(0, 2).map((name) => name.replace(/(^|[\s/-])\S/g, (m) => m.toUpperCase())).join(' · ');
  if (term.length < 2 && !starter.length) return <Card style={{ marginTop: space.lg }}><EmptyState icon={categories[kind].icon} title={`Find ${categories[kind].empty}`} text={`Search millions of ${categories[kind].empty}, then rate, review, or add them to a pod.`} /></Card>;
  if (term.length >= 2 && result.key !== key) return <ActivityIndicator color={c.secondary} style={{ marginTop: space.xxl }} />;
  if (term.length >= 2 && (result.error || !result.items.length)) return <Card style={{ marginTop: space.lg }}><T v="subhead" tone="secondary">{result.error || 'Nothing found. Try a shorter title or the creator’s name.'}</T></Card>;
  const items = term.length < 2 ? starter : result.items;
  return <>{term.length < 2 && <SectionHeader title={picks.personalized ? 'Picked for you' : 'Popular right now'} detail={picks.personalized && basis ? basis : 'Tap to rate'} />}<Card padded={false} style={{ marginTop: term.length < 2 ? 0 : space.lg, paddingLeft: space.md, paddingRight: space.md }}>
    {items.map((item, index) => {
      const mine = ratingFor(item.id);
      return <MusicRow key={item.id} item={item} note={term.length < 2 ? (item as StarterPick).reason : undefined} separator={index < items.length - 1}
        onPress={() => { rememberItem(item); router.push(`/item/${encodeURIComponent(item.id)}`); }}
        trailing={mine ? <ScoreBadge score={mine.score} size={32} /> : <Ionicons name="chevron-forward" size={17} color={c.tertiary} />} />;
    })}
  </Card></>;
}

/** A person to follow: avatar, name, handle, and a follow button. */
function PersonCard({ person, busy, onFollow }: { person: Profile; busy: boolean; onFollow: () => void }) {
  const { following } = useApp();
  const followed = following.includes(person.handle);
  return <Card style={{ width: 156, alignItems: 'center', gap: space.xs }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.name}'s profile`} onPress={() => router.push(`/person/${person.handle.slice(1)}`)} style={{ alignItems: 'center', alignSelf: 'stretch', gap: space.xs }}>
      <Avatar name={person.name} seed={person.handle} uri={person.avatar} size={60} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs, maxWidth: '100%' }}><T v="headline" numberOfLines={1} center style={{ flexShrink: 1 }}>{person.name}</T>{person.bot && <BotBadge />}</View>
      <T v="footnote" tone="secondary" numberOfLines={1}>{person.handle}</T>
    </Pressable>
    <Button label={followed ? 'Following' : 'Follow'} size="sm" variant={followed ? 'secondary' : 'primary'} icon={followed ? 'checkmark' : 'add'} disabled={busy}
      style={{ marginTop: space.sm, alignSelf: 'stretch' }} onPress={onFollow} />
  </Card>;
}

function PeopleRail({ people, busy, onFollow }: { people: Profile[]; busy: boolean; onFollow: (person: Profile) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.xs }}>
    {people.map((person) => <PersonCard key={person.id} person={person} busy={busy} onFollow={() => onFollow(person)} />)}
  </ScrollView>;
}

export default function DiscoverScreen() {
  const { allRankings, toggleFollow, user, refresh, refreshing } = useApp();
  const { busy, run } = useTask();
  const kinds = useAvailableKinds(activeKinds);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('posts');
  // People and post search waits for a pause in typing instead of firing on every keystroke.
  const [q, setQ] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQ(query.trim().toLowerCase()), 300); return () => clearTimeout(timer); }, [query]);
  const peoplePages = usePages<Profile>(`/people?q=${encodeURIComponent(q)}`, 'people', scope === 'posts');
  const postPages = usePages<Ranking>(`/feed?mode=recent&q=${encodeURIComponent(q)}`, 'posts', scope === 'posts');
  const botPages = usePages<Profile>('/people?bots=1', 'people', scope === 'posts' && !q);
  const others = peoplePages.rows.filter((p) => p.id !== user?.id && !(p.bot && !q));
  const follow = (person: Profile) => user ? void run(() => toggleFollow(person.handle)) : router.push('/auth');
  const matches = others;
  const options = [{ value: 'posts' as Scope, label: 'People & posts', icon: 'people' as const }, ...kinds.map((kind) => ({ value: kind as Scope, label: categories[kind].plural, icon: categories[kind].icon }))];

  return <Screen tab title="Discover" large onRefresh={() => { peoplePages.reload(); botPages.reload(); postPages.reload(); void refresh(); }} refreshing={refreshing} onEndReached={() => { if (scope === 'posts' && postPages.hasMore && !postPages.error) void postPages.loadMore(); }}>
    <SearchField value={query} onChangeText={setQuery} placeholder={scope === 'posts' ? 'People, posts, artists' : `Search ${categories[scope].empty}`} />
    <Chips value={scope} onChange={setScope} options={options} style={{ marginTop: space.md }} />

    {scope !== 'posts' ? <CatalogResults kind={scope} query={query} /> : <>
      {!q && <TasteTwinsRow />}
      {!q && <Button label="Explore listening clubs" icon="disc-outline" variant="secondary" onPress={() => router.push('/clubs')} style={{ marginTop: space.lg, marginBottom: space.sm }} />}
      {!q && botPages.rows.length > 0 && <>
        <SectionHeader title="Riffs bots" detail="Daily picks & polls" />
        <PeopleRail people={botPages.rows} busy={busy} onFollow={follow} />
      </>}
      <SectionHeader title="People" detail={matches.length ? `${matches.length}` : undefined} />
      {matches.length ? <PeopleRail people={matches} busy={busy} onFollow={follow} /> : others.length ? <Card><T v="subhead" tone="secondary">No people match that search.</T></Card> : <InviteCard />}

      <SectionHeader title="The conversation" detail={`${postPages.rows.length}`} />
      {peoplePages.hasMore && <Button label="More people" variant="secondary" loading={peoplePages.busy} onPress={() => void peoplePages.loadMore()} />}
      {!!peoplePages.error && <Button label="Retry people" variant="secondary" onPress={peoplePages.reload} />}
      {postPages.rows.length ? postPages.rows.map((ranking) => <RankingCard key={ranking.id} ranking={allRankings.find((p) => p.id === ranking.id) || ranking} />)
        : !postPages.loading && !postPages.error && <Card><EmptyState icon="search" title="Nothing matches" text="Try a category above to search the whole catalog, or be the first to post this take."
          action={<Button label="Rate something" variant="tinted" inline onPress={() => router.push('/rate')} />} /></Card>}
      {!!postPages.error && <Card><T>{postPages.error}</T><Button label="Retry posts" onPress={postPages.reload} /></Card>}
      {postPages.hasMore && <Button label="More posts" variant="secondary" loading={postPages.busy} onPress={() => void postPages.loadMore()} />}
    </>}
    <View style={{ height: space.md }} />
  </Screen>;
}

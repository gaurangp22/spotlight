import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { RankingCard, Screen } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { Avatar, Button, Card, EmptyState, SearchField, SectionHeader, T } from '../../ui/primitives';
import { gutter, space } from '../../ui/theme';

export default function DiscoverScreen() {
  const { allRankings, following, toggleFollow, people, user, refresh, refreshing } = useApp();
  const { busy, run } = useTask();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rankings = useMemo(() => allRankings.filter((ranking) => ranking.visibility !== 'private'
    && `${ranking.title} ${ranking.subtitle} ${ranking.author} ${ranking.items.map((item) => `${item.artist} ${item.title}`).join(' ')}`.toLowerCase().includes(q)), [allRankings, q]);
  const others = people.filter((p) => p.id !== user?.id);
  const matches = others.filter((p) => `${p.name} ${p.handle}`.toLowerCase().includes(q));

  return <Screen tab title="Discover" large onRefresh={() => void refresh()} refreshing={refreshing}>
    <SearchField value={query} onChangeText={setQuery} placeholder="People, rankings, artists" />

    <SectionHeader title="People" detail={matches.length ? `${matches.length}` : undefined} />
    {matches.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.xs }}>
      {matches.map((person) => {
        const followed = following.includes(person.handle);
        return <Card key={person.id} onPress={() => router.push(`/person/${person.handle.slice(1)}`)} style={{ width: 156, alignItems: 'center', gap: space.xs }}>
          <Avatar name={person.name} seed={person.handle} size={60} />
          <T v="headline" numberOfLines={1} center style={{ marginTop: space.xs }}>{person.name}</T>
          <T v="footnote" tone="secondary" numberOfLines={1}>{person.handle}</T>
          <Button label={followed ? 'Following' : 'Follow'} size="sm" variant={followed ? 'secondary' : 'primary'} icon={followed ? 'checkmark' : 'add'} disabled={busy}
            style={{ marginTop: space.sm, alignSelf: 'stretch' }} onPress={() => user ? void run(() => toggleFollow(person.handle)) : router.push('/auth')} />
        </Card>;
      })}
    </ScrollView> : <Card><T v="subhead" tone="secondary">{others.length ? 'No people match that search.' : 'Invite a friend to join. Their profile and public posts will appear here.'}</T></Card>}

    <SectionHeader title="Rankings to remix" detail={`${rankings.length}`} />
    {rankings.length ? rankings.map((ranking) => <RankingCard key={ranking.id} ranking={ranking} />)
      : <Card><EmptyState icon="search" title="No rankings match" text="Try another artist, or be the first to post this take."
        action={<Button label="Make a ranking" variant="tinted" inline onPress={() => router.push('/builder')} />} /></Card>}
    <View style={{ height: space.md }} />
  </Screen>;
}

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { errorMessage } from '../lib/api';
import { activeKinds, categories } from '../lib/categories';
import { searchCatalog } from '../lib/music';
import { sampleMusic } from '../lib/sample';
import { MusicItem, MusicKind } from '../lib/types';
import { useApp } from '../store/AppContext';
import { MusicRow } from './components';
import { haptic } from './haptics';
import { Badge, Button, Chips, Ionicons, SearchField, Segmented, Sheet, T } from './primitives';
import { gutter, space, useTheme } from './theme';

/** Categories shown in the app and searchable on this server (movies also need a TMDB key). */
export function useAvailableKinds(kinds: MusicKind[]) {
  const { config } = useApp();
  return kinds.filter((kind) => activeKinds.includes(kind) && (kind !== 'movie' || !!config?.catalog.movie));
}

/**
 * Full-height catalog search. Tapping a result toggles it in or out of the selection; with `single`,
 * it picks that one item and closes.
 */
export function MusicPicker({ visible, onClose, selected = [], onToggle, onPick, spotifyConnected, songsOnly = false, limit = 100, kinds: wanted = ['song', 'album'], title = 'Add music', initialKind }: {
  visible: boolean; onClose: () => void; selected?: MusicItem[]; onToggle?: (item: MusicItem) => void; onPick?: (item: MusicItem) => void;
  spotifyConnected: boolean; songsOnly?: boolean; limit?: number; kinds?: MusicKind[]; title?: string; initialKind?: MusicKind;
}) {
  const { c } = useTheme();
  const { config, rememberItem } = useApp();
  const kinds = useAvailableKinds(songsOnly ? ['song'] : wanted);
  const [query, setQuery] = useState('');
  const [chosenKind, setKind] = useState<MusicKind>(initialKind ?? kinds[0] ?? 'song');
  const kind = kinds.includes(chosenKind) ? chosenKind : kinds[0] ?? 'song';
  const term = query.trim();
  const spotifyCatalog = !!config?.spotifyCatalog;
  const key = `${spotifyConnected ? 'spotify' : spotifyCatalog ? 'server' : 'catalog'}:${kind}:${term}`;
  // The last completed search; anything that doesn't match the current key is stale.
  const [search, setSearch] = useState<{ key: string; items: MusicItem[]; error: string }>({ key: '', items: [], error: '' });

  useEffect(() => {
    if (!visible || term.length < 2) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalog(term, kind, { spotifyConnected, spotifyCatalog }, controller.signal)
        .then((items) => { if (active) setSearch({ key, items, error: '' }); })
        .catch((e) => { if (active) setSearch({ key, items: [], error: errorMessage(e) }); });
    }, 350);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [key, term, kind, visible, spotifyConnected, spotifyCatalog]);
  const fresh = search.key === key;
  const loading = term.length >= 2 && !fresh;
  const results = fresh ? search.items : [];
  const error = fresh ? search.error : '';

  const ids = new Set(selected.map((item) => item.id));
  const full = !onPick && selected.length >= limit;
  const data = term.length < 2 ? sampleMusic.filter((item) => item.kind === kind) : results;
  const source = kind === 'song' || kind === 'album' || kind === 'artist'
    ? spotifyConnected || spotifyCatalog ? 'Spotify' : kind === 'artist' ? 'Deezer' : 'Apple'
    : { movie: 'TMDB', show: 'TVmaze', podcast: 'Apple', book: 'Open Library' }[kind];
  const choose = (item: MusicItem) => {
    rememberItem(item);
    if (onPick) { haptic.select(); onPick(item); setQuery(''); return; }
    const chosen = ids.has(item.id);
    if (!chosen && full) { haptic.warn(); return; }
    haptic.select(); onToggle?.(item);
  };
  const options = kinds.map((value) => ({ value, label: categories[value].plural, icon: categories[value].icon }));

  return <Sheet visible={visible} onClose={onClose} title={title}
    action={onPick ? undefined : <Button label={selected.length ? `Done · ${selected.length} selected` : 'Done'} onPress={onClose} />}>
    <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.sm }}>
      <SearchField value={query} onChangeText={setQuery} placeholder={categories[kind].placeholder} autoFocus />
      {kinds.length > 1 && (kinds.length > 3
        ? <Chips value={kind} onChange={setKind} options={options} />
        : <Segmented value={kind} onChange={setKind} options={options} />)}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="overline" tone="secondary">{term.length < 2 ? (data.length ? 'Starter picks' : `Search ${categories[kind].empty}`) : loading ? 'Searching…' : `${results.length} results`}</T>
        <Badge label={source} icon={source === 'Spotify' ? 'musical-notes' : 'library-outline'} />
      </View>
    </View>
    <FlatList data={data} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.xxl }}
      ListEmptyComponent={loading ? <ActivityIndicator color={c.secondary} style={{ marginTop: space.xxl }} />
        : <View style={{ paddingVertical: space.xxxl, alignItems: 'center', gap: space.sm }}>
          <Ionicons name={error ? 'cloud-offline-outline' : categories[kind].icon} size={28} color={c.tertiary} />
          <T v="subhead" tone="secondary" center>{error || (term.length < 2 ? `Type at least two letters to find ${categories[kind].empty}.` : 'Nothing found. Try a shorter title or the creator’s name.')}</T>
        </View>}
      renderItem={({ item }) => {
        const chosen = ids.has(item.id);
        return <MusicRow item={item} onPress={() => choose(item)}
          trailing={<Ionicons name={onPick ? 'chevron-forward' : chosen ? 'checkmark-circle' : 'add-circle-outline'} size={onPick ? 18 : 26} color={chosen ? c.accent : full || onPick ? c.tertiary : c.secondary} accessibilityLabel={onPick ? 'Choose' : chosen ? 'Selected' : 'Add'} />} />;
      }} />
    {full && <T v="footnote" tone="secondary" center style={{ paddingBottom: space.sm }}>You’ve reached the limit of {limit} picks.</T>}
  </Sheet>;
}

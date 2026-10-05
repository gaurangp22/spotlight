import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { errorMessage } from '../lib/api';
import { searchMusic } from '../lib/music';
import { sampleMusic } from '../lib/sample';
import { MusicItem, MusicKind } from '../lib/types';
import { MusicRow } from './components';
import { haptic } from './haptics';
import { Badge, Button, Ionicons, SearchField, Segmented, Sheet, T } from './primitives';
import { gutter, space, useTheme } from './theme';

/** Full-height search sheet. Tapping a result toggles it in or out of the selection. */
export function MusicPicker({ visible, onClose, selected, onToggle, spotifyConnected, songsOnly = false, limit }: {
  visible: boolean; onClose: () => void; selected: MusicItem[]; onToggle: (item: MusicItem) => void; spotifyConnected: boolean; songsOnly?: boolean; limit: number;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MusicKind>('song');
  const term = query.trim();
  const key = `${spotifyConnected ? 'spotify' : 'catalog'}:${kind}:${term}`;
  // The last completed search; anything that doesn't match the current key is stale.
  const [search, setSearch] = useState<{ key: string; items: MusicItem[]; error: string }>({ key: '', items: [], error: '' });

  useEffect(() => {
    if (!visible || term.length < 2) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchMusic(term, kind, spotifyConnected, controller.signal)
        .then((items) => { if (active) setSearch({ key, items, error: '' }); })
        .catch((e) => { if (active) setSearch({ key, items: [], error: errorMessage(e) }); });
    }, 350);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [key, term, kind, visible, spotifyConnected]);
  const fresh = search.key === key;
  const loading = term.length >= 2 && !fresh;
  const results = fresh ? search.items : [];
  const error = fresh ? search.error : '';

  const ids = new Set(selected.map((item) => item.id));
  const full = selected.length >= limit;
  const data = term.length < 2 ? sampleMusic.filter((item) => item.kind === kind) : results;

  return <Sheet visible={visible} onClose={onClose} title="Add music"
    action={<Button label={selected.length ? `Done · ${selected.length} selected` : 'Done'} onPress={onClose} />}>
    <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.sm }}>
      <SearchField value={query} onChangeText={setQuery} placeholder={songsOnly || kind === 'song' ? 'Songs, artists' : 'Albums, artists'} autoFocus />
      {!songsOnly && <Segmented value={kind} onChange={setKind} options={[{ value: 'song', label: 'Songs' }, { value: 'album', label: 'Albums' }]} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="overline" tone="secondary">{term.length < 2 ? 'Starter picks' : loading ? 'Searching…' : `${results.length} results`}</T>
        <Badge label={spotifyConnected ? 'Spotify' : 'Catalog'} icon={spotifyConnected ? 'musical-notes' : 'library-outline'} />
      </View>
    </View>
    <FlatList data={data} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.xxl }}
      ListEmptyComponent={loading ? <ActivityIndicator color={c.secondary} style={{ marginTop: space.xxl }} />
        : <View style={{ paddingVertical: space.xxxl, alignItems: 'center', gap: space.sm }}>
          <Ionicons name={error ? 'cloud-offline-outline' : 'search'} size={28} color={c.tertiary} />
          <T v="subhead" tone="secondary" center>{error || 'Nothing found. Try the artist name or a shorter title.'}</T>
        </View>}
      renderItem={({ item }) => {
        const chosen = ids.has(item.id);
        return <MusicRow item={item} onPress={() => { if (!chosen && full) { haptic.warn(); return; } haptic.select(); onToggle(item); }}
          trailing={<Ionicons name={chosen ? 'checkmark-circle' : 'add-circle-outline'} size={26} color={chosen ? c.accent : full ? c.tertiary : c.secondary} accessibilityLabel={chosen ? 'Selected' : 'Add'} />} />;
      }} />
    {full && <T v="footnote" tone="secondary" center style={{ paddingBottom: space.sm }}>You’ve reached the limit of {limit} picks.</T>}
  </Sheet>;
}

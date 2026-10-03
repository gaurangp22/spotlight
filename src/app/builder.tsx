import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchMusic } from '../lib/music';
import { sampleMusic } from '../lib/sample';
import { MusicItem, MusicKind, Ranking } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Action, Artwork, Eyebrow, Header, MusicRow, Page } from '../ui/components';
import { C } from '../ui/theme';

export default function BuilderScreen() {
  const { draft, setDraft, addMusic, removeMusic, moveMusic, publish, allRankings } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MusicKind>('song');
  const [results, setResults] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const origin = allRankings.find((ranking) => ranking.id === draft.originId);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchMusic(query, kind).then((items) => { if (active) { setResults(items); setError(''); } })
        .catch(() => { if (active) { setResults([]); setError('Search needs an internet connection. Try again or use the starter picks.'); } })
        .finally(() => { if (active) setLoading(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [query, kind, searchOpen]);

  const onPublish = () => {
    if (!draft.title.trim()) { Alert.alert('Name this ranking', 'Give your ranking a title before publishing.'); return; }
    if (draft.items.length < 2) { Alert.alert('Add more music', 'Rank at least two songs or albums.'); return; }
    const ranking = publish();
    if (ranking) router.replace(`/ranking/${ranking.id}`);
  };

  const starter = sampleMusic.filter((item) => item.kind === kind && !draft.items.some((selected) => selected.id === item.id));
  const suggestions = query.trim().length < 2 ? starter : results;

  return <Page>
    <Header title="Make a ranking" back right={<Text style={styles.saved}>AUTO-SAVED</Text>} />
    {origin && <View style={styles.remix}><MaterialCommunityIcons name="source-branch" size={16} color={C.accent} /><Text style={styles.remixText}>Making your version of {origin.author}’s ranking</Text></View>}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Eyebrow>THE HEADLINE</Eyebrow>
        <TextInput value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} placeholder="e.g. Radiohead songs I keep returning to" placeholderTextColor="#96938A" style={styles.titleInput} multiline maxLength={100} />
        <TextInput value={draft.subtitle} onChangeText={(subtitle) => setDraft((current) => ({ ...current, subtitle }))} placeholder="Add a little context (optional)" placeholderTextColor="#96938A" style={styles.subtitleInput} maxLength={140} />
      </View>
      <View style={styles.sectionHead}><View><Eyebrow>YOUR ORDER</Eyebrow><Text style={styles.sectionTitle}>{draft.items.length} picks</Text></View><Pressable accessibilityRole="button" onPress={() => setSearchOpen((value) => !value)} style={styles.addButton}><MaterialCommunityIcons name={searchOpen ? 'close' : 'plus'} size={21} color={C.white} /><Text style={styles.addText}>{searchOpen ? 'Done' : 'Add music'}</Text></Pressable></View>
      {searchOpen && <View style={styles.searchPanel}>
        <View style={styles.kindRow}>{(['song', 'album'] as MusicKind[]).map((value) => <Pressable accessibilityRole="button" key={value} onPress={() => { setKind(value); setResults([]); setError(''); setLoading(false); }} style={[styles.kind, kind === value && styles.kindActive]}><Text style={[styles.kindText, kind === value && { color: C.white }]}>{value === 'song' ? 'Songs' : 'Albums'}</Text></Pressable>)}</View>
        <View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={22} color={C.muted} /><TextInput value={query} onChangeText={(value) => { setQuery(value); setResults([]); setError(''); setLoading(false); }} placeholder={`Search ${kind}s`} placeholderTextColor={C.muted} style={styles.searchInput} autoCorrect={false} /></View>
        {loading && <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.resultLabel}>{query.trim().length < 2 ? 'STARTER PICKS · EXAMPLES' : `${results.length} RESULTS`}</Text>
        {suggestions.slice(0, 20).map((item) => <MusicRow key={item.id} item={item} onPress={() => addMusic(item)} trailing={<MaterialCommunityIcons name={draft.items.some((chosen) => chosen.id === item.id) ? 'check' : 'plus'} size={22} color={C.accent} />} />)}
        {query.trim().length >= 2 && !loading && !error && !results.length && <Text style={styles.noResult}>Nothing found. Try the artist name or a shorter title.</Text>}
      </View>}
      {draft.items.length ? <View>{draft.items.map((item, index) => <View key={item.id} style={styles.editRow}><Text style={styles.rankNumber}>{String(index + 1).padStart(2, '0')}</Text><Artwork item={item} size={48} /><View style={{ flex: 1, gap: 3 }}><Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.itemArtist} numberOfLines={1}>{item.artist}</Text></View><View style={styles.reorder}><Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} up`} disabled={index === 0} onPress={() => moveMusic(index, -1)} style={[styles.smallButton, index === 0 && { opacity: 0.25 }]}><MaterialCommunityIcons name="chevron-up" size={22} color={C.ink} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Move ${item.title} down`} disabled={index === draft.items.length - 1} onPress={() => moveMusic(index, 1)} style={[styles.smallButton, index === draft.items.length - 1 && { opacity: 0.25 }]}><MaterialCommunityIcons name="chevron-down" size={22} color={C.ink} /></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} onPress={() => removeMusic(item.id)} style={styles.remove}><MaterialCommunityIcons name="close" size={19} color={C.muted} /></Pressable></View>)}</View>
        : <View style={styles.empty}><MaterialCommunityIcons name="format-list-numbered" size={30} color={C.accent} /><Text style={styles.emptyTitle}>Every list starts somewhere.</Text><Text style={styles.emptyText}>Add a few songs or albums, then put them in your order.</Text><Action label="Find music" onPress={() => setSearchOpen(true)} /></View>}
      {draft.items.length >= 2 && <Pressable accessibilityRole="button" style={styles.battle} onPress={() => router.push('/battle')}><MaterialCommunityIcons name="sword-cross" size={22} color={C.accent} /><View style={{ flex: 1 }}><Text style={styles.battleTitle}>Sort by Battle Mode</Text><Text style={styles.battleSub}>Pick your favourites head to head.</Text></View><MaterialCommunityIcons name="arrow-right" size={21} color={C.ink} /></Pressable>}
      <View style={styles.visibility}><Eyebrow>WHO CAN SEE IT?</Eyebrow><View style={styles.visibilityRow}>{(['public', 'followers', 'private'] as Ranking['visibility'][]).map((value) => <Pressable accessibilityRole="button" onPress={() => setDraft((current) => ({ ...current, visibility: value }))} key={value} style={[styles.visibilityOption, draft.visibility === value && styles.visibilityActive]}><Text style={[styles.visibilityText, draft.visibility === value && { color: C.white }]}>{value}</Text></Pressable>)}</View><Text style={styles.visibilityNote}>This prototype stores every ranking only on this device.</Text></View>
      <Action label="Publish ranking" onPress={onPublish} icon="arrow-right" disabled={draft.items.length < 2 || !draft.title.trim()} />
      <Text style={styles.footnote}>Your work saves automatically while you edit.</Text>
    </KeyboardAvoidingView>
  </Page>;
}

const styles = StyleSheet.create({
  saved: { color: C.muted, fontSize: 9, letterSpacing: 1, fontWeight: '900' }, remix: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }, remixText: { color: C.accent, fontSize: 12, fontWeight: '800' },
  form: { paddingTop: 27, paddingBottom: 28 }, titleInput: { fontSize: 29, lineHeight: 32, minHeight: 110, color: C.ink, fontWeight: '900', letterSpacing: -1, marginTop: 11, textAlignVertical: 'top' }, subtitleInput: { borderBottomWidth: 1, borderColor: C.line, paddingVertical: 12, fontSize: 14, color: C.ink },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 2, borderColor: C.ink, paddingTop: 17, marginBottom: 13 }, sectionTitle: { fontSize: 23, color: C.ink, fontWeight: '900', marginTop: 5 }, addButton: { minHeight: 48, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 }, addText: { color: C.white, fontSize: 12, fontWeight: '800' },
  searchPanel: { backgroundColor: C.soft, padding: 14, marginBottom: 17 }, kindRow: { flexDirection: 'row', gap: 7, marginBottom: 12 }, kind: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: C.ink }, kindActive: { backgroundColor: C.ink }, kindText: { color: C.ink, fontSize: 12, fontWeight: '800' }, searchBox: { height: 48, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }, searchInput: { flex: 1, color: C.ink, fontSize: 14 }, resultLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '900', color: C.muted, marginTop: 19, marginBottom: 5 }, error: { color: C.accentDark, fontSize: 12, marginTop: 10 }, noResult: { color: C.muted, padding: 15 },
  editRow: { minHeight: 108, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: C.line }, rankNumber: { width: 27, color: C.accent, fontSize: 17, fontWeight: '900' }, itemTitle: { color: C.ink, fontSize: 13, fontWeight: '800' }, itemArtist: { color: C.muted, fontSize: 11 }, reorder: { flexDirection: 'column', gap: 8 }, smallButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, remove: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  empty: { gap: 12, padding: 20, backgroundColor: C.soft }, emptyTitle: { fontSize: 20, color: C.ink, fontWeight: '900' }, emptyText: { color: C.muted, lineHeight: 19, fontSize: 13 },
  battle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderWidth: 1, borderColor: C.accent, marginTop: 22 }, battleTitle: { color: C.ink, fontWeight: '900', fontSize: 14 }, battleSub: { color: C.muted, fontSize: 11, marginTop: 3 },
  visibility: { paddingTop: 32, paddingBottom: 24 }, visibilityRow: { flexDirection: 'row', gap: 8, marginTop: 12 }, visibilityOption: { paddingHorizontal: 13, minHeight: 48, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }, visibilityActive: { backgroundColor: C.ink, borderColor: C.ink }, visibilityText: { textTransform: 'capitalize', color: C.ink, fontWeight: '800', fontSize: 12 }, visibilityNote: { color: C.muted, fontSize: 11, marginTop: 11 }, footnote: { textAlign: 'center', color: C.muted, fontSize: 11, marginTop: 14, marginBottom: 15 },
});

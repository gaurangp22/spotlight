import { useState } from 'react';
import { StyleProp, TextInput, View, ViewStyle } from 'react-native';
import { api } from '../lib/api';
import { MusicItem } from '../lib/types';
import { useTask } from './forms';
import { haptic } from './haptics';
import { Button, Card, Ionicons, T } from './primitives';
import { curve, noOutline, radius, space, type, useTheme } from './theme';

type Imported = { title: string; items: MusicItem[] };
const looksLikeSpotify = (value: string) => /^(https:\/\/(open\.spotify\.com|spotify\.link)\/|spotify:)/.test(value.trim());

/**
 * Paste a Spotify song, album, playlist, or artist link. The server reads it with its own app
 * token, so this works for everyone without connecting a Spotify account.
 */
export function SpotifyLinkImport({ onImport, label = 'Import', style }: { onImport: (result: Imported) => void; label?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const { busy, run } = useTask();
  const [link, setLink] = useState('');
  const [last, setLast] = useState('');
  const valid = looksLikeSpotify(link);

  const submit = () => run(async () => {
    const result = await api<Imported>(`/catalog/spotify-link?url=${encodeURIComponent(link.trim())}`);
    if (!result.items.length) throw new Error('Nothing in that link could be imported.');
    onImport(result);
    haptic.success();
    setLast(`${result.title} · ${result.items.length} ${result.items.length === 1 ? 'pick' : 'picks'}`);
    setLink('');
  });

  return <Card style={[{ gap: space.md }, style]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Ionicons name="link" size={18} color="#1DB954" />
      <T v="headline" style={{ flex: 1 }}>Paste a Spotify link</T>
    </View>
    <T v="footnote" tone="secondary">In Spotify, tap Share → Copy link on any song, album, public playlist, or artist. No Spotify login needed.</T>
    <TextInput value={link} onChangeText={setLink} placeholder="https://open.spotify.com/…" placeholderTextColor={c.tertiary} selectionColor={c.accent}
      accessibilityLabel="Spotify link" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" maxFontSizeMultiplier={1.4}
      onSubmitEditing={() => { if (valid) void submit(); }}
      style={[type.body, { minHeight: 46, borderRadius: radius.md, backgroundColor: c.fill, color: c.text, paddingHorizontal: 14, ...curve }, noOutline]} />
    {!!link && !valid && <T v="footnote" tone="danger">That doesn’t look like a Spotify link.</T>}
    <Button label={label} icon="download-outline" size="md" loading={busy} disabled={!valid} onPress={() => void submit()} />
    {!!last && <T v="footnote" tone="success" center>Imported {last}</T>}
  </Card>;
}

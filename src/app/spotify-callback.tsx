import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { useApp } from '../store/AppContext';
import { Action, Header, Page } from '../ui/components';
import { F } from '../ui/forms';

export default function SpotifyCallback() {
  const { status } = useLocalSearchParams<{ status: string }>();
  const { refresh } = useApp();
  useEffect(() => { void refresh(); }, [refresh]);
  return <Page><Header title="Spotify" /><Text style={F.title}>{status === 'connected' ? 'Your music is connected.' : 'Connection wasn’t completed.'}</Text><Text style={[F.note, { marginBottom: 25 }]}>{status === 'connected' ? 'You can now import playlists and search Spotify.' : 'Return to Settings to try again.'}</Text><Action label="Continue" onPress={() => router.replace('/settings')} /></Page>;
}

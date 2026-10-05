import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Screen } from '../ui/components';
import { Button, Card, EmptyState } from '../ui/primitives';

export default function SpotifyCallback() {
  const { status } = useLocalSearchParams<{ status: string }>();
  const { refresh } = useApp();
  useEffect(() => { void refresh(); }, [refresh]);
  const ok = status === 'connected';
  return <Screen title="Spotify">
    <Card style={{ marginTop: 24 }}>
      <EmptyState icon={ok ? 'checkmark-circle' : 'alert-circle-outline'} title={ok ? 'Spotify is connected' : 'Connection wasn’t completed'}
        text={ok ? 'You can now import playlists and search Spotify when making a ranking.' : 'Nothing was changed. You can try again from Settings.'}
        action={<Button label="Continue" inline onPress={() => router.replace('/settings')} />} />
    </Card>
  </Screen>;
}

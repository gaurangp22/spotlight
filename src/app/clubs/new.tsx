import { router } from 'expo-router';
import { useState } from 'react';
import { api } from '../../lib/api';
import { ListeningClub } from '../../lib/types';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { useTask } from '../../ui/forms';
import { Button, T, TextField } from '../../ui/primitives';
import { space } from '../../ui/theme';

export default function NewClub() {
  const { user } = useApp(), { busy, run } = useTask();
  const [name, setName] = useState(''), [description, setDescription] = useState('');
  return <Screen back title="Start a club" footer={<Button label={user ? 'Create club' : 'Sign in to create'} loading={busy} disabled={!!user && name.trim().length < 3} onPress={() => user ? void run(async () => {
    const { club } = await api<{ club: ListeningClub }>('/clubs', { method: 'POST', body: { name: name.trim(), description: description.trim() } }); router.replace(`/clubs/${club.id}`);
  }) : router.push('/auth')} />}>
    <T v="title1" style={{ marginBottom: space.md }}>Make an album a conversation.</T><T v="body" tone="secondary" style={{ marginBottom: space.xl }}>You choose one album each week. Members get an in-app update, then listen, rate, and discuss at their own pace.</T>
    <TextField label="Club name" value={name} onChangeText={setName} maxLength={60} placeholder="e.g. The Sunday album club" hint="At least 3 characters" editable={!busy} />
    <TextField label="About your club" value={description} onChangeText={setDescription} maxLength={300} multiline placeholder="What kind of music will you explore together?" editable={!busy} />
    <T v="footnote" tone="secondary">Clubs and discussions are public. A new week starts on Monday at 00:00 UTC. Once chosen, the weekly album stays fixed.</T>
  </Screen>;
}

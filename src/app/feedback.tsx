import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { goBack, Screen } from '../ui/components';
import { useTask } from '../ui/forms';
import { haptic } from '../ui/haptics';
import { Button, Card, Chips, EmptyState, T, TextField } from '../ui/primitives';
import { space } from '../ui/theme';

const topics = [
  { value: 'bug', label: 'Something broke' },
  { value: 'idea', label: 'An idea' },
  { value: 'love', label: 'Something I love' },
  { value: 'confusing', label: 'Confusing' },
] as const;
type Topic = (typeof topics)[number]['value'];

/** Beta feedback goes straight to the founders. Optional context: the screen it was sent from. */
export default function FeedbackScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { user } = useApp();
  const [topic, setTopic] = useState<Topic>('bug');
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, run } = useTask();
  const send = () => run(async () => {
    await api('/feedback', { method: 'POST', body: {
      text: `[${topics.find((t) => t.value === topic)!.label}] ${text.trim()}`,
      context: typeof from === 'string' ? from.slice(0, 200) : '',
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
      version: Constants.expoConfig?.version ?? '',
    } });
    haptic.success(); setSent(true);
  });

  if (sent) return <Screen back title="Feedback"><Card style={{ marginTop: space.xl }}><EmptyState icon="heart" title="Thank you — we read every note"
    text="Riffs is built with a small group of early listeners. What you just sent shapes what we fix and build next."
    action={<View style={{ gap: space.sm, alignSelf: 'stretch' }}><Button label="Done" onPress={goBack} /><Button label="Send another" variant="plain" onPress={() => { setText(''); setSent(false); }} /></View>} /></Card></Screen>;

  return <Screen back title="Feedback" large subtitle="Tell the people building Riffs what’s working and what isn’t."
    footer={<Button label="Send feedback" icon="paper-plane" loading={busy} disabled={text.trim().length < 3} onPress={() => void send()} />}>
    <Chips value={topic} onChange={setTopic} options={topics.map((t) => ({ value: t.value, label: t.label }))} />
    <View style={{ marginTop: space.lg }}>
      <TextField label={topic === 'bug' ? 'What happened, and what did you expect?' : topic === 'idea' ? 'What would make Riffs better for you?' : 'Tell us more'}
        value={text} onChangeText={setText} multiline maxLength={1900} placeholder="Be as blunt as you like." hint={`${text.length}/1900`} autoFocus />
    </View>
    <T v="footnote" tone="secondary">{user ? `Sent as ${user.handle}, so we can follow up in the app.` : 'You’re signed out, so this is anonymous.'} We also include your device type{from ? ', the screen you were on,' : ''} and the app version — nothing else.</T>
  </Screen>;
}

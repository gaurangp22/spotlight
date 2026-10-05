import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../store/AppContext';
import { errorMessage } from '../lib/api';
import { Ranking } from '../lib/types';
import { visibilityIcon } from './components';
import { haptic } from './haptics';
import { Segmented, T } from './primitives';
import { space } from './theme';

/** Runs one async task at a time and surfaces failures as an app notice. */
export function useTask() {
  const { setNotice } = useApp();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try { await task(); } catch (error) { haptic.warn(); setNotice(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, run };
}

const visibilityNote: Record<Ranking['visibility'], string> = {
  public: 'Anyone can view this post.',
  followers: 'Only people who follow you can view this post.',
  private: 'Only you can view this post.',
};
export function Visibility({ value, onChange }: { value: Ranking['visibility']; onChange: (value: Ranking['visibility']) => void }) {
  return <View style={{ gap: space.sm }}>
    <Segmented value={value} onChange={onChange} options={[
      { value: 'public', label: 'Public', icon: visibilityIcon.public },
      { value: 'followers', label: 'Followers', icon: visibilityIcon.followers },
      { value: 'private', label: 'Private', icon: visibilityIcon.private },
    ]} />
    <T v="footnote" tone="secondary" style={{ marginLeft: 4 }}>{visibilityNote[value]}</T>
  </View>;
}

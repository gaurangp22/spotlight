import { router } from 'expo-router';
import { MusicItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { useTask } from './forms';
import { Button, IconButton, ListRow } from './primitives';

export function SaveItemButton({ item, compact = false }: { item: MusicItem; compact?: boolean }) {
  const { user, savedItems, toggleSavedItem } = useApp(), { busy, run } = useTask();
  const saved = savedItems.some((pick) => pick.id === item.id);
  const onPress = () => user ? void run(() => toggleSavedItem(item)) : router.push('/auth');
  return compact ? <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} label={`${saved ? 'Remove' : 'Save'} ${item.title} ${saved ? 'from' : 'to'} Listen later`} size={44} disabled={busy} onPress={onPress} />
    : <Button label={saved ? 'Saved to Listen later' : 'Listen later'} icon={saved ? 'bookmark' : 'bookmark-outline'} variant="secondary" size="md" disabled={busy} onPress={onPress} />;
}
export function SavePostRow({ id }: { id: string }) {
  const { user, savedPostIds, toggleSavedPost } = useApp(), { busy, run } = useTask();
  const saved = savedPostIds.includes(id);
  return <ListRow title={saved ? 'Remove saved post' : 'Save post'} icon={saved ? 'bookmark' : 'bookmark-outline'} iconColor="#FF9500" disabled={busy} onPress={() => user ? void run(() => toggleSavedPost(id)) : router.push('/auth')} />;
}

import { router } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../../store/AppContext';
import { Screen } from '../../ui/components';
import { Card, IconName, Ionicons, ListGroup, ListRow, T } from '../../ui/primitives';
import { curve, radius, space, useTheme } from '../../ui/theme';

function Option({ icon, tint, title, text, onPress }: { icon: IconName; tint: string; title: string; text: string; onPress: () => void }) {
  const { c } = useTheme();
  return <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.md, paddingVertical: space.xl }}>
    <View style={{ width: 54, height: 54, borderRadius: radius.md, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', ...curve }}><Ionicons name={icon} size={26} color="#FFFFFF" /></View>
    <View style={{ flex: 1, gap: 3 }}><T v="title3">{title}</T><T v="subhead" tone="secondary">{text}</T></View>
    <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
  </Card>;
}

export default function CreateScreen() {
  const { draft, moodDraft, startDraft } = useApp();
  const hasDraft = draft.items.length > 0 || !!draft.title.trim();
  const hasMood = !!(moodDraft.title || moodDraft.tiles.length || moodDraft.items.length);
  return <Screen tab title="Create" large subtitle="Start with the music. The order is your point of view.">
    <Option icon="list" tint="#C63A22" title="Ranking" text="Put songs or albums in your exact order." onPress={() => { startDraft(); router.push('/builder'); }} />
    <Option icon="flash" tint="#2F5F7A" title="Battle Mode" text="Choose head-to-head and let your gut decide." onPress={() => { startDraft(); router.push({ pathname: '/builder', params: { mode: 'battle' } }); }} />
    <Option icon="images" tint="#4E3A78" title="Mood board" text="Bring together songs, photos, and notes." onPress={() => router.push('/moodboard')} />
    {(hasDraft || hasMood) && <ListGroup header="Continue where you left off" footer="Drafts are saved on this device.">
      {hasDraft && <ListRow icon="create-outline" title={draft.title.trim() || 'Untitled ranking'} subtitle={`${draft.items.length} ${draft.items.length === 1 ? 'pick' : 'picks'}`} onPress={() => router.push('/builder')} />}
      {hasMood && <ListRow icon="images-outline" iconColor="#4E3A78" title={moodDraft.title.trim() || 'Untitled mood board'} subtitle={`${moodDraft.items.length} songs · ${moodDraft.tiles.length} tiles`} onPress={() => router.push('/moodboard')} />}
    </ListGroup>}
  </Screen>;
}

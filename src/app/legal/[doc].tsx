import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import legal from '../../../server/legal.json';
import { Screen } from '../../ui/components';
import { T } from '../../ui/primitives';
import { space } from '../../ui/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = doc === 'terms' ? legal.terms : legal.privacy;
  return <Screen back title={page.title} large subtitle={`Last updated ${legal.updated}`}>
    <T v="body" style={{ marginBottom: space.md }}>{page.intro}</T>
    {page.sections.map((section) => <View key={section.heading} style={{ marginTop: space.xl, gap: space.sm }}>
      <T v="title3" accessibilityRole="header">{section.heading}</T>
      {section.body.map((paragraph, i) => <T key={i} v="body" tone="secondary">{paragraph}</T>)}
    </View>)}
  </Screen>;
}

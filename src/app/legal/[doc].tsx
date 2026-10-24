import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import legal from '../../../server/legal.json';
import { Screen } from '../../ui/components';
import { T } from '../../ui/primitives';
import { space } from '../../ui/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = doc === 'terms' ? legal.terms : legal.privacy;
  const contact = legal.contact ? `Email ${legal.contact}, or use Settings → Send feedback in the app.` : 'Use Settings → Send feedback in the app.';
  const sections = [...page.sections, { heading: 'Contact', body: [contact] }];
  return <Screen back title={page.title} large subtitle={`Last updated ${legal.updated}`}>
    <T v="body" style={{ marginBottom: space.md }}>{page.intro}</T>
    {sections.map((section) => <View key={section.heading} style={{ marginTop: space.xl, gap: space.sm }}>
      <T v="title3" accessibilityRole="header">{section.heading}</T>
      {section.body.map((paragraph, i) => <T key={i} v="body" tone="secondary">{paragraph}</T>)}
    </View>)}
  </Screen>;
}

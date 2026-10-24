import { router } from 'expo-router';
import { Screen } from '../ui/components';
import { Button, Card, EmptyState } from '../ui/primitives';

export default function NotFound() {
  return <Screen back title="Not found">
    <Card style={{ marginTop: 24 }}>
      <EmptyState icon="disc-outline" title="Nothing here" text="This link may be broken, or what it pointed to was deleted or made private."
        action={<Button label="Go home" inline onPress={() => router.replace('/')} />} />
    </Card>
  </Screen>;
}

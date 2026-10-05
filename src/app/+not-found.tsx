import { router } from 'expo-router';
import { Screen } from '../ui/components';
import { Button, Card, EmptyState } from '../ui/primitives';

export default function NotFound() {
  return <Screen back title="Not found">
    <Card style={{ marginTop: 24 }}>
      <EmptyState icon="disc-outline" title="This track doesn’t exist" text="The link may be broken, or the post may have been deleted."
        action={<Button label="Go home" inline onPress={() => router.replace('/')} />} />
    </Card>
  </Screen>;
}

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';

/** Temporary page for tabs that haven't been built yet. */
export function Placeholder({ title, step, description }: { title: string; step: number; description: string }) {
  return (
    <Screen>
      <AppText variant="title">{title}</AppText>
      <Card>
        <AppText variant="label">Coming in Step {step}</AppText>
        <AppText muted>{description}</AppText>
      </Card>
    </Screen>
  );
}

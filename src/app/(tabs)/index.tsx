/**
 * Home tab. PLACEHOLDER for Step 0 — the real Home screen (rotation, today's
 * workout, Change Workout) is built in Step 7. For now it shows the colour
 * roles so you can check light and dark mode on your phone.
 */
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function HomeScreen() {
  const { colors, isDark } = useTheme();

  const comingSoon = () => Alert.alert('Coming soon', 'This button gets wired up in a later step.');

  return (
    <Screen>
      <AppText variant="title">Hello</AppText>

      <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
        <AppText variant="small" muted>
          TODAY&apos;S WORKOUT (sample)
        </AppText>
        <AppText variant="heading">Push</AppText>
        <AppText muted>Chest · Shoulders · Triceps</AppText>
      </Card>

      <Button title="Start Workout" size="large" onPress={comingSoon} />
      <Button title="Change Workout" kind="secondary" onPress={comingSoon} />

      <Card>
        <AppText variant="label">Colour check</AppText>
        <AppText variant="small" muted>
          You are in {isDark ? 'dark' : 'light'} mode.
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Badge label="Done" fg={colors.success} bg={colors.successSoft} />
          <Badge label="Owed" fg={colors.warning} bg={colors.warningSoft} />
          <Badge label="Suggested" fg={colors.accent} bg={colors.accentSoft} />
        </View>
      </Card>
    </Screen>
  );
}

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
      }}>
      <AppText variant="small" color={fg} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

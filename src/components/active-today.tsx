/**
 * Home's activity line: today's minutes and the selected day's logged activities.
 */
import { format } from 'date-fns';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, ScrollView } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import type { QuickLog } from '@/db/quick-log';
import { ACTIVITY_PRESETS, describeLog, groupLogs } from '@/logic/activity';
import { DURATION, EASE } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, spacing } from '@/theme/typography';

/**
 * Living Home: today's minutes and the selected day's activities as one light
 * line ("20 / 30 active min · 40 min walk · 10 min yoga"; the same activity twice is
 * one combined entry), so they read as progress
 * rather than as more buttons. Scrolls sideways if there are many; new ones fade
 * in. Tap one to delete it (it asks first).
 */
/** `lead` (today's minutes) shows only for today; other days list just their activities. */
export function LogLine({ lead, logs, onDelete, emptyText }: { lead: string | null; logs: QuickLog[]; onDelete: (log: QuickLog) => void; emptyText: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, minHeight: MIN_TAP }}>
      {/* VoiceOver already hears today's minutes in the room's label. */}
      {lead && (
        <AppText variant="small" color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {lead}
        </AppText>
      )}
      {logs.length === 0 ? (
        <AppText variant="small" color={colors.textMuted}>
          {lead ? `  ·  ${emptyText}` : emptyText}
        </AppText>
      ) : (
        groupLogs(logs).map((g, i) => {
          const icon = ACTIVITY_PRESETS.find((p) => p.id === g.activity)?.icon ?? 'figure.mixed.cardio';
          const what = describeLog(g.name, g.amount, g.unit);
          const one = (l: QuickLog) => `${describeLog(l.name, l.amount, l.unit)} at ${format(l.loggedAt, 'H:mm')}`;
          const ask = () =>
            g.logs.length === 1
              ? Alert.alert('Delete this log?', one(g.logs[0]), [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(g.logs[0]) },
                ])
              : Alert.alert(`${what} today`, 'Which log do you want to delete?', [
                  ...g.logs.map((l) => ({ text: `Delete ${one(l)}`, style: 'destructive' as const, onPress: () => onDelete(l) })),
                  { text: 'Keep all', style: 'cancel' as const },
                ]);
          return (
            <Animated.View
              // A new total fades in gently (e.g. "20 min walk" becoming "40 min walk").
              key={`${g.key}-${g.amount}`}
              entering={FadeIn.duration(DURATION.transition.base).easing(EASE.out)}
              layout={LinearTransition.duration(DURATION.transition.short).easing(EASE.inOut)}
              style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(lead || i > 0) && (
                <AppText variant="small" color={colors.faint} accessible={false}>
                  {'  ·  '}
                </AppText>
              )}
              <PressableScale
                onPress={ask}
                accessibilityRole="button"
                accessibilityLabel={g.logs.length === 1 ? one(g.logs[0]) : `${what}, ${g.logs.length} logs`}
                accessibilityHint={g.logs.length === 1 ? 'Asks before deleting this log' : 'Lets you pick a log to delete'}
                style={{ minHeight: MIN_TAP, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <SymbolView name={icon as SFSymbol} size={14} tintColor={colors.accent} />
                <AppText variant="small" color={colors.textMuted}>
                  {what}
                </AppText>
              </PressableScale>
            </Animated.View>
          );
        })
      )}
    </ScrollView>
  );
}

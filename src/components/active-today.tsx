/**
 * Home pieces for Quick Log:
 * - ActiveTodayCard: ring of today's active minutes against your goal, plus the
 *   big "Quick log" button.
 * - DayLogList: the activities logged on the selected day (tap one to delete it).
 */
import { format } from 'date-fns';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressRing } from '@/components/progress-ring';
import type { QuickLog } from '@/db/quick-log';
import { ACTIVITY_PRESETS, describeLog } from '@/logic/activity';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export function ActiveTodayCard({ minutes, goal, onLog }: { minutes: number; goal: number; onLog: () => void }) {
  const { colors } = useTheme();
  const shown = Math.round(minutes);
  const reached = shown >= goal;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <View accessible accessibilityLabel={`Active today: ${shown} of ${goal} minutes`}>
        <ProgressRing size={60} stroke={5} fraction={goal > 0 ? minutes / goal : 0}>
          <AppText variant="label" maxFontSizeMultiplier={1.1}>
            {shown}
          </AppText>
        </ProgressRing>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="label">Active today</AppText>
        <AppText variant="small" muted>
          {reached ? `Goal reached · ${shown} min` : `${shown} of ${goal} min`}
        </AppText>
      </View>
      <PressableScale
        onPress={onLog}
        accessibilityRole="button"
        accessibilityLabel="Quick log an activity"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height: 44,
          paddingHorizontal: spacing.lg,
          borderRadius: 22,
          backgroundColor: colors.accent,
        }}>
        <SymbolView name="plus" size={15} tintColor={colors.onAccent} />
        <AppText variant="label" color={colors.onAccent}>
          Quick log
        </AppText>
      </PressableScale>
    </View>
  );
}

export function DayLogList({ logs, onDelete }: { logs: QuickLog[]; onDelete: (log: QuickLog) => void }) {
  const { colors } = useTheme();
  if (logs.length === 0) return null;
  return (
    <View style={{ borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {logs.map((l, i) => {
        const icon = ACTIVITY_PRESETS.find((p) => p.id === l.activity)?.icon ?? 'figure.mixed.cardio';
        const what = describeLog(l.name, l.amount, l.unit);
        return (
          <Pressable
            key={l.id}
            onPress={() =>
              Alert.alert('Delete this log?', what, [
                { text: 'Keep', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(l) },
              ])
            }
            accessibilityRole="button"
            accessibilityLabel={`${what} at ${format(l.loggedAt, 'H:mm')}. Tap to delete`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: 52,
              paddingHorizontal: spacing.lg,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
              backgroundColor: pressed ? colors.cardAlt : 'transparent',
            })}>
            <SymbolView name={icon as SFSymbol} size={20} tintColor={colors.accent} />
            <AppText variant="label" style={{ flex: 1 }} numberOfLines={1}>
              {what.charAt(0).toUpperCase() + what.slice(1)}
              {l.distanceKm ? ` · ${l.distanceKm} km` : ''}
            </AppText>
            <AppText variant="small" muted>
              {format(l.loggedAt, 'H:mm')}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Home pieces for Quick Log:
 * - ActiveTodayCard: ring of today's active minutes against your goal, plus the
 *   big "Quick log" button.
 * - DayLogList: the activities logged on the selected day (tap one to delete it).
 */
import { format } from 'date-fns';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressRing } from '@/components/progress-ring';
import type { QuickLog } from '@/db/quick-log';
import { ACTIVITY_PRESETS, describeLog } from '@/logic/activity';
import { DURATION, EASE } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { isMistTheme, MIN_TAP, radius, spacing } from '@/theme/typography';

export function ActiveTodayCard({ minutes, goal, onLog }: { minutes: number; goal: number; onLog: () => void }) {
  const { colors, name } = useTheme();
  const shown = Math.round(minutes);
  const reached = shown >= goal;
  // Mist & Mint: a Liquid Glass tile instead of a solid card.
  const mist = isMistTheme(name);
  const Box = mist ? GlassTile : View;
  return (
    <Box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        ...(mist ? null : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }),
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
    </Box>
  );
}

export function DayLogList({ logs, onDelete }: { logs: QuickLog[]; onDelete: (log: QuickLog) => void }) {
  const { colors, name } = useTheme();
  if (logs.length === 0) return null;
  const mist = isMistTheme(name);
  const Box = mist ? GlassTile : View;
  return (
    <Box
      style={{
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...(mist ? null : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }),
      }}>
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
    </Box>
  );
}

/**
 * Living Home: today's minutes and the selected day's activities as one light
 * line ("20 / 30 active min · 20 min walk · 10 min yoga"), so they read as progress
 * rather than as more buttons. Scrolls sideways if there are many; new ones fade
 * in. Tap one to delete it (it asks first).
 */
export function LogLine({ lead, logs, onDelete, emptyText }: { lead: string; logs: QuickLog[]; onDelete: (log: QuickLog) => void; emptyText: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, minHeight: MIN_TAP }}>
      <AppText variant="small" color={colors.textMuted}>
        {lead}
      </AppText>
      {logs.length === 0 ? (
        <AppText variant="small" color={colors.faint}>
          {`  ·  ${emptyText}`}
        </AppText>
      ) : (
        logs.map((l) => {
          const icon = ACTIVITY_PRESETS.find((p) => p.id === l.activity)?.icon ?? 'figure.mixed.cardio';
          const what = describeLog(l.name, l.amount, l.unit);
          return (
            <Animated.View
              key={l.id}
              entering={FadeIn.duration(DURATION.transition.base).easing(EASE.out)}
              layout={LinearTransition.duration(DURATION.transition.short).easing(EASE.inOut)}
              style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="small" color={colors.faint} accessible={false}>
                {'  ·  '}
              </AppText>
              <PressableScale
                onPress={() =>
                  Alert.alert('Delete this log?', what, [
                    { text: 'Keep', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => onDelete(l) },
                  ])
                }
                accessibilityRole="button"
                accessibilityLabel={`${what} at ${format(l.loggedAt, 'H:mm')}`}
                accessibilityHint="Asks before deleting this log"
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

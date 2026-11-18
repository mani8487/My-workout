/** "Last time" card and the green suggestion card, shown above the set table. */
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { SessionExercise } from '@/db/sessions';
import { formatKg, formatSet } from '@/logic/format';
import { suggestWeight } from '@/logic/suggestion';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function LastTimeCards({ exercise }: { exercise: SessionExercise }) {
  const { colors } = useTheme();
  const hasEdge = colors.suggestEdge !== 'transparent';
  const working = exercise.previous.filter((s) => !s.isWarmup);
  const suggestion = suggestWeight({
    previous: exercise.previous,
    targetSets: exercise.targetSets,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    incrementKg: exercise.incrementKg,
  });

  return (
    <View style={{ gap: spacing.sm }}>
      {exercise.previousDate != null && working.length > 0 && (
        <View
          style={{
            backgroundColor: colors.cardAlt,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.xs,
          }}>
          <AppText variant="small" muted>
            Last time · {shortDate(exercise.previousDate)}
          </AppText>
          <AppText variant="label">
            {working.map((s) => formatSet(s.weightKg, s.reps) + (s.rir != null ? ` (${s.rir} left)` : '')).join('  ·  ')}
          </AppText>
        </View>
      )}

      <View
        style={{
          // Suggestion card: a brass left edge in Dark/Light, a solid slate card in Frost.
          backgroundColor: colors.suggestBg,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: hasEdge ? 3 : 1,
          borderLeftColor: hasEdge ? colors.suggestEdge : colors.border,
          borderRadius: radius.lg,
          padding: spacing.lg,
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'center',
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="small" color={colors.onSuggest} style={{ opacity: 0.8 }}>
            {suggestion.reason}
          </AppText>
          {suggestion.weightKg != null && (
            <AppText variant="heading" style={{ fontSize: 20 }} color={hasEdge ? colors.accent : colors.onSuggest}>
              {suggestion.kind === 'increase' ? 'Try ' : 'Use '}
              {formatKg(suggestion.weightKg)} kg today
            </AppText>
          )}
        </View>
        <SymbolView
          name={suggestion.kind === 'increase' ? 'chart.line.uptrend.xyaxis' : 'lightbulb'}
          size={24}
          tintColor={hasEdge ? colors.accent : colors.onSuggest}
        />
      </View>
    </View>
  );
}

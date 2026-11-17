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
            backgroundColor: colors.card,
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
          backgroundColor: colors.successSoft,
          borderRadius: radius.md,
          padding: spacing.md,
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'center',
        }}>
        <SymbolView
          name={suggestion.kind === 'increase' ? 'arrow.up.circle.fill' : 'lightbulb.fill'}
          size={24}
          tintColor={colors.success}
        />
        <View style={{ flex: 1, gap: 2 }}>
          {suggestion.weightKg != null && (
            <AppText variant="label" color={colors.success}>
              {suggestion.kind === 'increase' ? 'Go up to ' : 'Use '}
              {formatKg(suggestion.weightKg)} kg
            </AppText>
          )}
          <AppText variant="small">{suggestion.reason}</AppText>
        </View>
      </View>
    </View>
  );
}

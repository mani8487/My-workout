/**
 * Choose Workout sheet. The suggested workout (first still owed) is
 * highlighted with a tick; others show "Owed" or "Done <date>".
 * Picking a different one leaves the skipped workout owed.
 */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import type { Workout } from '@/db/types';
import type { Rotation } from '@/logic/rotation';
import { chooseWorkout, getToday, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function ChooseWorkoutScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [state, setState] = useState<{ rotation: Rotation; current: Workout } | null>(null);

  useEffect(() => {
    getToday(db).then(({ rotation, workout }) => setState({ rotation, current: workout }));
  }, [db]);

  async function pick(w: Workout) {
    // Picking the suggested one clears any earlier override.
    await chooseWorkout(db, w.id === state?.rotation.next.id ? null : w.id);
    router.back();
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Choose Workout" onBack={() => router.back()} backIcon="xmark" backLabel="Close" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {state?.rotation.workouts.map((w) => {
          const suggested = w.id === state.rotation.next.id;
          const doneAt = state.rotation.done.get(w.id);
          const selected = w.id === state.current.id;
          return (
            <Pressable
              key={w.id}
              onPress={() => pick(w)}
              accessibilityLabel={`${w.name}${suggested ? ', suggested' : doneAt ? ', done' : ', owed'}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: suggested || selected ? 2 : 1,
                borderColor: suggested ? colors.accent : selected ? colors.textMuted : colors.border,
                backgroundColor: suggested ? colors.accentSoft : pressed ? colors.cardAlt : colors.card,
              })}>
              <SymbolView name={w.icon as SFSymbol} size={28} tintColor={suggested ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="heading">{w.name}</AppText>
                <AppText variant="small" muted>
                  {w.muscleLabel}
                </AppText>
              </View>
              {suggested ? (
                <SymbolView name="checkmark.circle.fill" size={26} tintColor={colors.accent} />
              ) : doneAt ? (
                <Badge text={`Done ${shortDate(doneAt)}`} fg={colors.success} bg={colors.successSoft} />
              ) : (
                <Badge text="Owed" fg={colors.warning} bg={colors.warningSoft} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
      <AppText variant="small" color={fg} style={{ fontWeight: '600' }}>
        {text}
      </AppText>
    </View>
  );
}

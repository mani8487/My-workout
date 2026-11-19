/**
 * Choose Workout sheet. The suggested workout (first still owed) is
 * highlighted with a tick; others show "Owed" or "Done <date>".
 * Picking a different one leaves the skipped workout owed.
 */
import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Backdrop } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import type { Workout } from '@/db/types';
import type { Rotation } from '@/logic/rotation';
import { parseDateKey, setDayOverride } from '@/logic/schedule';
import { chooseWorkout, getToday, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function ChooseWorkoutScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  // Set when rescheduling a future day from the Home strip ("2026-11-24").
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [state, setState] = useState<{ rotation: Rotation; current: Workout | null } | null>(null);

  useEffect(() => {
    getToday(db).then(({ rotation, workout }) => setState({ rotation, current: date ? null : workout }));
  }, [db, date]);

  async function pick(w: Workout) {
    if (date) await setDayOverride(db, date, w.id); // plan it on that day
    // Today: picking the suggested one clears any earlier pick.
    else await chooseWorkout(db, w.id === state?.rotation.next?.id ? null : w.id);
    router.back();
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <ScreenHeader title="Choose Workout" onBack={() => router.back()} backIcon="xmark" backLabel="Close" />
      {state && (
        <AppText variant="small" muted style={{ textAlign: 'center' }}>
          {date ? `For ${format(parseDateKey(date), 'EEEE d MMM')} · ` : ''}
          {state.rotation.routine.name}
        </AppText>
      )}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {state?.rotation.workouts.map((w) => {
          const suggested = w.id === state.rotation.next?.id;
          const doneAt = state.rotation.done.get(w.id);
          const selected = w.id === state.current?.id;
          return (
            <Pressable
              key={w.id}
              onPress={() => pick(w)}
              accessibilityLabel={`${w.name}${suggested ? ', suggested' : doneAt ? ', done' : ', to do'}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: suggested || selected ? 2 : 1,
                borderColor: suggested ? colors.accent : selected ? colors.textMuted : colors.border,
                backgroundColor: pressed ? colors.cardAlt : colors.card,
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
                <Badge text={`Done ${shortDate(doneAt)}`} fg={colors.sage} bg={colors.sageSoft} />
              ) : (
                <Badge text="To do" fg={colors.warning} bg={colors.warningSoft} />
              )}
            </Pressable>
          );
        })}

        {date && (
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Make It a Rest Day"
                kind="secondary"
                onPress={async () => {
                  await setDayOverride(db, date, 'rest');
                  router.back();
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Reset to Plan"
                kind="secondary"
                onPress={async () => {
                  await setDayOverride(db, date, null);
                  router.back();
                }}
              />
            </View>
          </View>
        )}
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

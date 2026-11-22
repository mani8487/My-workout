/**
 * Log a forgotten workout: pick which one and the date, then fill in the
 * sets on the next screen. It counts towards the rotation for that date.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { getWorkouts } from '@/db/plan';
import { startSession } from '@/db/sessions';
import type { Workout } from '@/db/types';
import { parseDateKey } from '@/logic/schedule';
import { getWorkoutPreview } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function LogWorkoutScreen() {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [chosen, setChosen] = useState<Workout | null>(null);
  // Opened from a day on the Home strip? Start on that day.
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(() => {
    if (params.date) return parseDateKey(params.date);
    const d = new Date();
    d.setDate(d.getDate() - 1); // most forgotten workouts were yesterday
    return d;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWorkouts(db).then(setWorkouts);
  }, [db]);

  async function create() {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      const start = new Date(date);
      start.setHours(12, 0, 0, 0); // time of day isn't known; noon keeps the date safe
      const { minutes } = await getWorkoutPreview(db, chosen.id);
      const id = await startSession(db, chosen.id, chosen.name, {
        startedAt: start.getTime(),
        finishedAt: start.getTime() + minutes * 60000,
      });
      router.replace({ pathname: '/session/[id]', params: { id: String(id) } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Log Past Workout" onBack={() => router.back()} backIcon="xmark" backLabel="Close" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <AppText variant="small" muted style={{ fontWeight: '600' }}>
          WHICH WORKOUT?
        </AppText>
        <View style={{ gap: spacing.sm }}>
          {workouts.map((w) => {
            const on = chosen?.id === w.id;
            return (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: on }}
                key={w.id}
                onPress={() => setChosen(w)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.accent : colors.border,
                  backgroundColor: on ? colors.accentSoft : colors.card,
                }}>
                <SymbolView name={w.icon as SFSymbol} size={22} tintColor={on ? colors.accent : colors.textMuted} />
                <AppText variant="label" style={{ flex: 1 }}>
                  {w.name}
                </AppText>
                {on && <SymbolView name="checkmark.circle.fill" size={22} tintColor={colors.accent} />}
              </Pressable>
            );
          })}
        </View>

        <AppText variant="small" muted style={{ fontWeight: '600' }}>
          WHEN?
        </AppText>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm }}>
          <DateTimePicker
            value={date}
            mode="date"
            display="inline"
            maximumDate={new Date()}
            accentColor={colors.accent}
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={(_, d) => d && setDate(d)}
          />
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Button title={chosen ? `Log ${chosen.name}` : 'Choose a workout'} disabled={!chosen} onPress={create} />
      </View>
    </SafeAreaView>
  );
}

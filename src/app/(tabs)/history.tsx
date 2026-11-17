/** History tab: past workouts, newest first, grouped by month, with a filter by workout. */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { listFinishedSessions, type HistoryItem } from '@/db/history';
import { getWorkouts } from '@/db/plan';
import type { Workout, WorkoutId } from '@/db/types';
import { formatDuration } from '@/logic/format';
import { getSessionRecords } from '@/logic/records';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type Row = HistoryItem & { hasRecord: boolean };

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [filter, setFilter] = useState<WorkoutId | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setWorkouts(await getWorkouts(db));
        const items = await listFinishedSessions(db, filter);
        const withRecords = await Promise.all(
          items.map(async (it) => ({ ...it, hasRecord: (await getSessionRecords(db, it.id)).length > 0 })),
        );
        setRows(withRecords);
      })();
    }, [db, filter]),
  );

  // Group into months, e.g. "November 2026".
  const groups: { month: string; items: Row[] }[] = [];
  for (const r of rows ?? []) {
    const month = new Date(r.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(r);
    else groups.push({ month, items: [r] });
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="title" style={{ flex: 1 }}>
          History
        </AppText>
        <Pressable onPress={() => router.push('/log-workout')} hitSlop={10} accessibilityLabel="Log a past workout">
          <SymbolView name="plus.circle.fill" size={28} tintColor={colors.accent} />
        </Pressable>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {[{ id: null, name: 'All' } as const, ...workouts].map((w) => {
          const on = filter === w.id;
          return (
            <Pressable
              key={w.id ?? 'all'}
              onPress={() => setFilter(w.id)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: on ? colors.accent : colors.card,
                borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
              }}>
              <AppText variant="small" color={on ? colors.onAccent : colors.text} style={{ fontWeight: '600' }}>
                {w.name}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {rows && rows.length === 0 && (
        <AppText muted style={{ textAlign: 'center', marginTop: spacing.xl }}>
          No finished workouts yet.
        </AppText>
      )}

      {groups.map((g) => (
        <View key={g.month} style={{ gap: spacing.sm }}>
          <AppText variant="small" muted style={{ fontWeight: '600' }}>
            {g.month.toUpperCase()}
          </AppText>
          {g.items.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(r.id) } })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.cardAlt : colors.card,
              })}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{r.workoutName}</AppText>
                <AppText variant="small" muted>
                  {new Date(r.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}
                  {r.workingSets} sets
                  {r.finishedAt
                    ? ` · ${formatDuration(Math.max(1, Math.round((r.finishedAt - r.startedAt) / 60000)))}`
                    : ''}
                </AppText>
              </View>
              {r.hasRecord && <SymbolView name="trophy.fill" size={18} tintColor={colors.success} />}
              <SymbolView name="chevron.right" size={14} tintColor={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

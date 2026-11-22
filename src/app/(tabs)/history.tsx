/**
 * History tab: past workouts, newest first, grouped by month, with a filter by workout.
 *
 * Uses a SectionList, so only the rows on screen are drawn, and works out the
 * PR trophies in one database read. Both keep the tab quick after years of logging.
 */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Backdrop } from '@/components/screen';
import { listFinishedSessions, type HistoryItem } from '@/db/history';
import { getWorkouts } from '@/db/plan';
import type { Workout, WorkoutId } from '@/db/types';
import { formatDuration } from '@/logic/format';
import { getSessionIdsWithRecords } from '@/logic/records';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [filter, setFilter] = useState<WorkoutId | null>(null);
  const [rows, setRows] = useState<HistoryItem[] | null>(null);
  const [withRecord, setWithRecord] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [ws, items, records] = await Promise.all([
          getWorkouts(db),
          listFinishedSessions(db, filter),
          getSessionIdsWithRecords(db),
        ]);
        setWorkouts(ws);
        setRows(items);
        setWithRecord(records);
      })();
    }, [db, filter]),
  );

  // Group into months, e.g. "November 2026".
  const sections = useMemo(() => {
    const out: { title: string; data: HistoryItem[] }[] = [];
    for (const r of rows ?? []) {
      const title = new Date(r.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const last = out[out.length - 1];
      if (last?.title === title) last.data.push(r);
      else out.push({ title, data: [r] });
    }
    return out;
  }, [rows]);

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="title" style={{ flex: 1 }} accessibilityRole="header">
          History
        </AppText>
        <Pressable
          onPress={() => router.push('/log-workout')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Log a past workout">
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
              accessibilityRole="button"
              accessibilityLabel={w.id === null ? 'Show all workouts' : `Show ${w.name}`}
              accessibilityState={{ selected: on }}
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
          No workouts yet. Let&apos;s change that.
        </AppText>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg }}
        initialNumToRender={12}
        windowSize={7}
        ItemSeparatorComponent={RowGap}
        renderSectionHeader={({ section }) => (
          <AppText
            variant="small"
            muted
            style={{ fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm }}
            accessibilityRole="header">
            {section.title.toUpperCase()}
          </AppText>
        )}
        renderItem={({ item: r }) => {
          const day = new Date(r.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
          const duration = r.finishedAt ? formatDuration(Math.max(1, Math.round((r.finishedAt - r.startedAt) / 60000))) : null;
          const pr = withRecord.has(r.id);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(r.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`${r.workoutName}, ${day}, ${r.workingSets} sets${duration ? `, ${duration}` : ''}${pr ? ', personal record' : ''}`}
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
                  {day} · {r.workingSets} sets{duration ? ` · ${duration}` : ''}
                </AppText>
              </View>
              {pr && <SymbolView name="trophy.fill" size={18} tintColor={colors.accent} />}
              <SymbolView name="chevron.right" size={14} tintColor={colors.textMuted} />
            </Pressable>
          );
        }}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} pointerEvents="none">
        <Backdrop />
      </View>
    </View>
  );
}

function RowGap() {
  return <View style={{ height: spacing.sm }} />;
}

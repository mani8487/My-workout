/**
 * Progress tab: per-exercise chart (top weight, volume or estimated 1-rep max)
 * over a chosen time range, personal records, and weekly sets per muscle.
 */
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { LineChart } from '@/components/line-chart';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import {
  getExerciseRecords,
  getExerciseSeries,
  getLastExerciseDone,
  getLoggedExercises,
  getWeeklyMuscleSets,
  type RecordRow,
  type SeriesPoint,
} from '@/db/progress';
import { getSetting } from '@/db/settings';
import { formatKg } from '@/logic/format';
import { shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type Metric = 'top' | 'volume' | 'e1rm';
type Range = '4w' | '3m' | 'all';
const RANGE_MS: Record<Range, number> = { '4w': 28 * 86_400_000, '3m': 91 * 86_400_000, all: Infinity };

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [metric, setMetric] = useState<Metric>('top');
  const [range, setRange] = useState<Range>('3m');
  const [exercise, setExercise] = useState<{ id: string; name: string } | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [records, setRecords] = useState<{ weight: RecordRow[]; reps: RecordRow[] } | null>(null);
  const [muscles, setMuscles] = useState<{ muscle: string; sets: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const logged = await getLoggedExercises(db);
        const picked = await getSetting(db, 'progress_exercise');
        const id = logged.some((e) => e.id === picked) ? picked : await getLastExerciseDone(db);
        const ex = logged.find((e) => e.id === id) ?? null;
        setExercise(ex);
        setMuscles(await getWeeklyMuscleSets(db));
        if (ex) {
          const since = range === 'all' ? 0 : Date.now() - RANGE_MS[range];
          setSeries(await getExerciseSeries(db, ex.id, since));
          setRecords(await getExerciseRecords(db, ex.id));
        }
        setLoaded(true);
      })();
    }, [db, range]),
  );

  const yOf = (p: SeriesPoint) => (metric === 'top' ? p.topWeight : metric === 'volume' ? p.volume : p.e1rm);
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets));

  return (
    <Screen>
      <AppText variant="title">Progress</AppText>

      {loaded && !exercise && (
        <Card>
          <AppText muted>Finish a workout and your charts and records will appear here.</AppText>
        </Card>
      )}

      {exercise && (
        <>
          {/* Exercise picker */}
          <Pressable
            onPress={() => router.push('/pick-exercise')}
            accessibilityLabel="Choose exercise"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="heading" style={{ flexShrink: 1 }}>
              {exercise.name}
            </AppText>
            <SymbolView name="chevron.down" size={14} tintColor={colors.accent} />
          </Pressable>

          <Card>
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'top', label: 'Top weight' },
                { value: 'volume', label: 'Volume' },
                { value: 'e1rm', label: 'Est. 1RM' },
              ]}
            />
            <View style={{ marginVertical: spacing.sm }}>
              <LineChart
                points={series.map((p) => ({ x: p.date, y: yOf(p) }))}
                formatY={(v) => `${formatKg(Math.round(v * 10) / 10)} kg`}
                formatX={shortDate}
              />
            </View>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: '4w', label: '4 weeks' },
                { value: '3m', label: '3 months' },
                { value: 'all', label: 'All time' },
              ]}
            />
          </Card>

          {records && (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <RecordList title="Weight records" rows={records.weight} />
              <RecordList title="Rep records" rows={records.reps} />
            </View>
          )}
        </>
      )}

      {/* Muscle balance */}
      {muscles.length > 0 && (
        <Card>
          <AppText variant="label">Sets per muscle · last 7 days</AppText>
          <AppText variant="small" muted>
            Main muscle counts 1 set, helper muscles half.
          </AppText>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {muscles.map((m) => (
              <View key={m.muscle} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText variant="small" style={{ width: 84 }}>
                  {m.muscle[0].toUpperCase() + m.muscle.slice(1)}
                </AppText>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                  <View style={{ width: `${(m.sets / maxMuscle) * 100}%`, height: '100%', backgroundColor: colors.accent }} />
                </View>
                <AppText variant="small" muted style={{ width: 32, textAlign: 'right' }}>
                  {m.sets}
                </AppText>
              </View>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

function RecordList({ title, rows }: { title: string; rows: RecordRow[] }) {
  return (
    <Card style={{ flex: 1 }}>
      <AppText variant="label">{title}</AppText>
      {rows.length === 0 && <AppText muted>—</AppText>}
      {rows.map((r, i) => (
        <View key={i}>
          <AppText>
            {r.weightKg ? `${formatKg(r.weightKg)} kg` : 'BW'} × {r.reps}
          </AppText>
          <AppText variant="small" muted>
            {shortDate(r.date)}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

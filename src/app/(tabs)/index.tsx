/**
 * Home: greeting, this week's strip (dots on days you trained), the big
 * "today's workout" card (first workout still owed in the active plan, or
 * your Change Workout pick), and a scroller of your plans.
 * If a workout is in progress, the card offers to resume it instead.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { quoteOfTheDay } from '@/data/quotes';
import { getActiveSessionId, getSessionDetail } from '@/db/sessions';
import { getSetting } from '@/db/settings';
import type { Workout } from '@/db/types';
import { acceptFreshStart, dismissFreshStart, freshStartOffer } from '@/logic/fresh-start';
import type { Rotation } from '@/logic/rotation';
import { getRoutineCards, getToday, getWeekStrip, getWorkoutPreview, greeting, shortDate } from '@/logic/today';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type HomeData = {
  name: string | null;
  rotation: Rotation;
  /** Null only when the active plan has no workouts yet. */
  workout: Workout | null;
  exerciseCount: number;
  minutes: number;
  active: { name: string; setsDone: number } | null;
  week: Awaited<ReturnType<typeof getWeekStrip>>;
  plans: Awaited<ReturnType<typeof getRoutineCards>>;
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [data, setData] = useState<HomeData | null>(null);
  const [weeksAway, setWeeksAway] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Reload every time Home comes into view (after a workout, after Change Workout…).
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [{ rotation, workout }, name, activeId, week, plans] = await Promise.all([
          getToday(db),
          getSetting(db, 'user_name'),
          getActiveSessionId(db),
          getWeekStrip(db),
          getRoutineCards(db),
        ]);
        const { plan, minutes } = workout ? await getWorkoutPreview(db, workout.id) : { plan: [], minutes: 0 };
        let active: HomeData['active'] = null;
        if (activeId != null) {
          const d = await getSessionDetail(db, activeId);
          if (d) {
            const setsDone = d.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt != null && !s.isWarmup).length;
            active = { name: d.workoutName, setsDone };
          }
        }
        setData({ name, rotation, workout, exerciseCount: plan.length, minutes, active, week, plans });
        setWeeksAway(activeId == null ? await freshStartOffer(db) : null);
      })();
    }, [db, reloadKey]),
  );

  if (!data) return <Screen>{null}</Screen>;

  const { rotation, workout, active } = data;
  const doneCount = rotation.done.size;
  const isOwed = workout ? !rotation.done.has(workout.id) : true;
  const statusLine = !workout
    ? ''
    : isOwed
      ? `${workout.name} is up next · ${doneCount} of ${rotation.workouts.length} done this cycle`
      : `${workout.name} was already done on ${shortDate(rotation.done.get(workout.id)!)} this cycle`;

  const openPreview = () => workout && router.push({ pathname: '/workout/preview', params: { id: workout.id } });

  return (
    <Screen>
      {/* Greeting (light lead-in, name in semibold) + settings */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 34, fontWeight: '300', letterSpacing: -0.6 }}>
            {greeting()}
            {data.name ? ',' : ''}
          </AppText>
          {data.name && (
            <AppText style={{ fontSize: 34, fontWeight: '700', letterSpacing: -0.6 }}>{data.name}</AppText>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <SymbolView name="slider.horizontal.3" size={22} tintColor={colors.text} />
        </Pressable>
      </View>

      {/* Week strip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.week.map((d) => (
          <View
            key={d.key}
            style={{
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              paddingHorizontal: 4,
              borderRadius: 999,
              backgroundColor: d.isToday ? colors.accent : 'transparent',
              minWidth: 44,
            }}>
            <AppText variant="small" color={d.isToday ? colors.onAccent : colors.textMuted}>
              {d.weekday}
            </AppText>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: d.isToday ? colors.cardAlt : colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText variant="label">
                {d.day}
              </AppText>
            </View>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: d.trained ? (d.isToday ? colors.onAccent : colors.text) : 'transparent',
              }}
            />
          </View>
        ))}
      </View>

      {weeksAway != null && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <AppText variant="label" style={{ flex: 1 }}>
              Welcome back. Want to ease in?
            </AppText>
            <Pressable
              onPress={async () => {
                await dismissFreshStart(db);
                setWeeksAway(null);
              }}
              hitSlop={12}
              accessibilityLabel="Dismiss">
              <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
            </Pressable>
          </View>
          <AppText variant="small" muted>
            It&apos;s been {weeksAway} weeks. A fresh start restarts the cycle, with weights about 10% lighter for your
            first session back on each exercise.
          </AppText>
          <Button
            title="Fresh Start"
            kind="secondary"
            onPress={async () => {
              await acceptFreshStart(db);
              setReloadKey((k) => k + 1);
            }}
          />
        </Card>
      )}

      {/* Hero card */}
      {active ? (
        <Hero>
          <AppText variant="small" color={colors.onHeroMuted}>
            IN PROGRESS
          </AppText>
          <AppText style={{ fontSize: 40, fontWeight: '700', letterSpacing: -0.8 }} color={colors.onHero}>
            {active.name}
          </AppText>
          <AppText color={colors.onHeroMuted}>
            {active.setsDone} {active.setsDone === 1 ? 'set' : 'sets'} logged so far
          </AppText>
          <HeroButton title="Resume Workout" onPress={() => router.push('/workout/active')} />
        </Hero>
      ) : workout ? (
        <View style={{ gap: spacing.sm }}>
          <Pressable onPress={openPreview} accessibilityLabel={`Preview ${workout.name}`}>
            <Hero>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText variant="small" color={colors.onHeroMuted} style={{ flex: 1, letterSpacing: 0.5 }}>
                  TODAY&apos;S WORKOUT
                </AppText>
                <HeroChip>{isOwed ? 'Up next' : 'Done'}</HeroChip>
              </View>
              <AppText style={{ fontSize: 40, fontWeight: '700', letterSpacing: -0.8 }} color={colors.onHero}>
                {workout.name}
              </AppText>
              <AppText color={colors.onHeroMuted}>{workout.muscleLabel}</AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <HeroChip icon="clock">{`${data.minutes} min`}</HeroChip>
                <HeroChip icon="list.bullet">{`${data.exerciseCount} exercises`}</HeroChip>
              </View>
              <HeroButton title="Start Workout" onPress={openPreview} />
              <Pressable
                onPress={() => router.push('/workout/change')}
                style={{
                  minHeight: 52,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.onHeroMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText variant="label" color={colors.onHero}>
                  Change Workout
                </AppText>
              </Pressable>
            </Hero>
          </Pressable>
          <AppText variant="small" muted style={{ paddingHorizontal: spacing.xs }}>
            {statusLine}
          </AppText>
        </View>
      ) : (
        <Card>
          <AppText variant="heading">{rotation.routine.name}</AppText>
          <AppText muted>This plan has no workouts yet. Add some in the Plan Editor.</AppText>
          <Button
            title="Open Plan"
            onPress={() => router.push({ pathname: '/routine/[routineId]', params: { routineId: rotation.routine.id } })}
          />
        </Card>
      )}

      {/* Your plans */}
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            Your plans
          </AppText>
          <Pressable onPress={() => router.push('/plans')} hitSlop={12}>
            <AppText variant="label" muted style={{ textDecorationLine: 'underline' }}>
              Manage
            </AppText>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }} style={{ marginHorizontal: -spacing.lg }}>
          <View style={{ width: spacing.xs }} />
          {data.plans.map((p) => (
            <Pressable
              key={p.routine.id}
              onPress={() => router.push({ pathname: '/routine/[routineId]', params: { routineId: p.routine.id } })}
              style={{
                width: 230,
                padding: spacing.lg,
                gap: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                borderWidth: p.active ? 2 : 1,
                borderColor: p.active ? colors.accent : colors.border,
              }}>
              <AppText variant="label" numberOfLines={1} style={{ fontSize: 18 }}>
                {p.routine.name}
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Chip>{`${p.days} ${p.days === 1 ? 'day' : 'days'}`}</Chip>
                {p.minutes > 0 && <Chip>{`~${p.minutes} min`}</Chip>}
                {p.active && <Chip strong>Active</Chip>}
              </View>
            </Pressable>
          ))}
          <View style={{ width: spacing.xs }} />
        </ScrollView>
      </View>

      <AppText variant="small" muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
        “{quoteOfTheDay()}”
      </AppText>
    </Screen>
  );
}

function Hero({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.heroStart, colors.heroEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
      {children}
    </LinearGradient>
  );
}

function HeroButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 56,
        marginTop: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.heroButton,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}>
      <AppText variant="heading" style={{ fontSize: 20 }} color={colors.onHeroButton}>
        {title}
      </AppText>
    </Pressable>
  );
}

function HeroChip({ children, icon }: { children: string; icon?: SFSymbol }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm - 2,
        borderRadius: 999,
        backgroundColor: colors.heroChip,
      }}>
      {icon && <SymbolView name={icon} size={14} tintColor={colors.onHero} />}
      <AppText variant="small" color={colors.onHero}>
        {children}
      </AppText>
    </View>
  );
}

function Chip({ children, strong }: { children: string; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        minHeight: 28,
        borderRadius: 999,
        backgroundColor: strong ? colors.accent : colors.accentSoft,
      }}>
      <AppText variant="small" color={strong ? colors.onAccent : colors.text}>
        {children}
      </AppText>
    </View>
  );
}
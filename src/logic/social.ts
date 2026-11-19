/**
 * Friends and competition (online, via Supabase).
 *
 * Only summaries and things you choose to send ever leave the phone:
 * your name and invite code, a weekly summary (workouts, kilos, week streak)
 * while sharing is on, plans you send, and challenges.
 */
import { addWeeks, format } from 'date-fns';
import type { SQLiteDatabase } from 'expo-sqlite';

import { addRoutine, addWorkout, getPlanForWorkout, getRoutines, getWorkouts } from '@/db/plan';
import { supabase } from '@/lib/supabase';
import { weekStartOf } from './schedule';

export type Metric = 'workouts' | 'volume' | 'streak';
export const METRIC_LABEL: Record<Metric, string> = { workouts: 'Workouts', volume: 'Kilos lifted', streak: 'Week streak' };

export type Profile = { id: string; display_name: string; invite_code: string; share_stats: boolean };
export type Friend = { id: string; name: string };
export type BoardRow = { userId: string; name: string; isMe: boolean; workouts: number; volume: number; streak: number };
export type Challenge = {
  id: string;
  fromId: string;
  toId: string;
  metric: Metric;
  weekStart: string;
  status: 'pending' | 'accepted' | 'declined';
};
export type IncomingPlan = { id: string; name: string; fromName: string; payload: PlanPayload };

type PlanPayload = {
  workouts: {
    name: string;
    muscleLabel: string;
    icon: string;
    items: {
      exerciseId: string;
      name: string;
      muscles: string[];
      equipment: string;
      incrementKg: number;
      sets: number;
      repMin: number;
      repMax: number;
      rest: number;
    }[];
  }[];
};

function client() {
  if (!supabase) throw new Error('Friends are not set up yet.');
  return supabase;
}

const thisWeekKey = () => format(weekStartOf(new Date()), 'yyyy-MM-dd');

// ---------- Profile ----------

export async function getMyProfile(): Promise<Profile | null> {
  const sb = client();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb.from('profiles').select('id, display_name, invite_code, share_stats').eq('id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateMyProfile(patch: Partial<Pick<Profile, 'display_name' | 'share_stats'>>) {
  const sb = client();
  const me = await getMyProfile();
  if (!me) return;
  const { error } = await sb.from('profiles').update(patch).eq('id', me.id);
  if (error) throw error;
  // Turning sharing off removes your summaries from the server straight away.
  if (patch.share_stats === false) await sb.from('weekly_stats').delete().eq('user_id', me.id);
}

// ---------- Friends ----------

export async function addFriendByCode(code: string): Promise<string> {
  const { data, error } = await client().rpc('add_friend_by_code', { code });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function removeFriend(friendId: string) {
  const { error } = await client().rpc('remove_friend', { friend: friendId });
  if (error) throw error;
}

export async function listFriends(): Promise<Friend[]> {
  const sb = client();
  const { data: links, error } = await sb.from('friendships').select('friend_id');
  if (error) throw error;
  const ids = (links ?? []).map((l) => l.friend_id as string);
  if (ids.length === 0) return [];
  const { data: people, error: e2 } = await sb.from('profiles').select('id, display_name').in('id', ids);
  if (e2) throw e2;
  return (people ?? [])
    .map((p) => ({ id: p.id as string, name: p.display_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Weekly stats ----------

/** Workouts and kilos this week, plus how many weeks in a row you've trained. */
export async function computeMyWeek(db: SQLiteDatabase) {
  const monday = weekStartOf(new Date());
  const row = await db.getFirstAsync<{ workouts: number; volume: number | null }>(
    `SELECT COUNT(DISTINCT s.id) AS workouts,
            SUM(CASE WHEN st.completed_at IS NOT NULL AND st.is_warmup = 0
                     THEN COALESCE(st.weight_kg, 0) * st.reps ELSE 0 END) AS volume
     FROM sessions s
     LEFT JOIN session_exercises se ON se.session_id = s.id
     LEFT JOIN sets st ON st.session_exercise_id = se.id
     WHERE s.status = 'finished' AND s.started_at >= ?`,
    monday.getTime(),
  );
  // Week streak: count back from this week (or last week, if this one hasn't started yet).
  const weeks = await db.getAllAsync<{ started_at: number }>(`SELECT started_at FROM sessions WHERE status = 'finished'`);
  const trainedWeeks = new Set(weeks.map((w) => format(weekStartOf(new Date(w.started_at)), 'yyyy-MM-dd')));
  let cursor = trainedWeeks.has(format(monday, 'yyyy-MM-dd')) ? monday : addWeeks(monday, -1);
  let streak = 0;
  while (trainedWeeks.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }
  return { workouts: row?.workouts ?? 0, volume: Math.round(row?.volume ?? 0), streak };
}

/** Upload this week's summary (only if you're signed in and sharing is on). Never throws. */
export async function syncMyWeek(db: SQLiteDatabase) {
  try {
    if (!supabase) return;
    const me = await getMyProfile();
    if (!me || !me.share_stats) return;
    const w = await computeMyWeek(db);
    await supabase.from('weekly_stats').upsert({
      user_id: me.id,
      week_start: thisWeekKey(),
      workouts: w.workouts,
      volume_kg: w.volume,
      streak_weeks: w.streak,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Offline or not signed in: try again next time.
  }
}

export async function getLeaderboard(me: Profile, friends: Friend[]): Promise<BoardRow[]> {
  const ids = [me.id, ...friends.map((f) => f.id)];
  const { data, error } = await client()
    .from('weekly_stats')
    .select('user_id, workouts, volume_kg, streak_weeks')
    .eq('week_start', thisWeekKey())
    .in('user_id', ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.user_id as string, r]));
  const names = new Map<string, string>([[me.id, me.display_name], ...friends.map((f) => [f.id, f.name] as [string, string])]);
  return ids.map((id) => {
    const r = byId.get(id);
    return {
      userId: id,
      name: names.get(id) ?? 'Friend',
      isMe: id === me.id,
      workouts: Number(r?.workouts ?? 0),
      volume: Number(r?.volume_kg ?? 0),
      streak: Number(r?.streak_weeks ?? 0),
    };
  });
}

export const metricValue = (r: BoardRow, m: Metric) => (m === 'workouts' ? r.workouts : m === 'volume' ? r.volume : r.streak);

// ---------- Challenges ----------

export async function listChallenges(): Promise<Challenge[]> {
  const { data, error } = await client()
    .from('challenges')
    .select('id, from_id, to_id, metric, week_start, status')
    .eq('week_start', thisWeekKey())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    fromId: c.from_id as string,
    toId: c.to_id as string,
    metric: c.metric as Metric,
    weekStart: c.week_start as string,
    status: c.status as Challenge['status'],
  }));
}

export async function sendChallenge(meId: string, friendId: string, metric: Metric) {
  const { error } = await client()
    .from('challenges')
    .insert({ from_id: meId, to_id: friendId, metric, week_start: thisWeekKey() });
  if (error) throw error;
}

export async function answerChallenge(id: string, status: 'accepted' | 'declined') {
  const { error } = await client().from('challenges').update({ status }).eq('id', id);
  if (error) throw error;
}

// ---------- Sharing plans ----------

/** Send one of your plans (routines) to a friend. Only the plan is sent, not your history. */
export async function sharePlan(db: SQLiteDatabase, meId: string, friendId: string, routineId: string) {
  const routine = (await getRoutines(db)).find((r) => r.id === routineId);
  if (!routine) return;
  const workouts = await getWorkouts(db, routineId);
  const payload: PlanPayload = { workouts: [] };
  for (const w of workouts) {
    const plan = await getPlanForWorkout(db, w.id);
    payload.workouts.push({
      name: w.name,
      muscleLabel: w.muscleLabel,
      icon: w.icon,
      items: plan.map((p) => ({
        exerciseId: p.exercise.id,
        name: p.exercise.name,
        muscles: p.exercise.muscles,
        equipment: p.exercise.equipment,
        incrementKg: p.exercise.incrementKg,
        sets: p.targetSets,
        repMin: p.repMin,
        repMax: p.repMax,
        rest: p.restSeconds,
      })),
    });
  }
  const { error } = await client()
    .from('shared_plans')
    .insert({ owner_id: meId, recipient_id: friendId, name: routine.name, payload });
  if (error) throw error;
}

export async function listIncomingPlans(meId: string, friends: Friend[]): Promise<IncomingPlan[]> {
  const { data, error } = await client()
    .from('shared_plans')
    .select('id, owner_id, name, payload')
    .eq('recipient_id', meId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const names = new Map(friends.map((f) => [f.id, f.name]));
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    fromName: names.get(p.owner_id as string) ?? 'A friend',
    payload: p.payload as PlanPayload,
  }));
}

/** Add a friend's plan to your own plans (as a new routine), then remove it from the inbox. */
export async function importPlan(db: SQLiteDatabase, plan: IncomingPlan) {
  const routineId = await addRoutine(db, `${plan.name} (from ${plan.fromName})`);
  for (const w of plan.payload.workouts ?? []) {
    const workoutId = await addWorkout(db, { name: w.name, muscleLabel: w.muscleLabel, icon: w.icon, routineId });
    for (let i = 0; i < w.items.length; i++) {
      const it = w.items[i];
      // Their custom exercises won't be in your library yet: add them.
      await db.runAsync(
        `INSERT OR IGNORE INTO exercises (id, name, muscles, equipment, increment_kg, is_custom) VALUES (?, ?, ?, ?, ?, 1)`,
        it.exerciseId,
        it.name,
        it.muscles.join(','),
        it.equipment,
        it.incrementKg,
      );
      await db.runAsync(
        `INSERT INTO plan_items (workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        workoutId,
        it.exerciseId,
        i + 1,
        it.sets,
        it.repMin,
        it.repMax,
        it.rest,
      );
    }
  }
  await dismissPlan(plan.id);
  return routineId;
}

export async function dismissPlan(id: string) {
  await client().from('shared_plans').delete().eq('id', id);
}

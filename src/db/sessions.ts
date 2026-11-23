/**
 * Everything to do with a workout in progress: starting one, logging sets,
 * editing, deleting, finishing and cancelling.
 *
 * Every function here writes straight to the phone's database and waits for
 * it to finish, so a set is safely stored the moment you tick it, even if
 * the app is closed a second later.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { suggestWeight } from '@/logic/suggestion';
import { easeBack, planWarmups } from '@/logic/warmup';
import { getPlanForWorkout, type PlannedExercise } from './plan';
import { getSetting } from './settings';
import type { WorkoutId } from './types';

export type SessionSet = {
  id: number;
  position: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  isWarmup: boolean;
  note: string | null;
  /** Time the set was ticked. Empty = not done yet. */
  completedAt: number | null;
};

/** A set from last time, shown in the muted "Previous" column. */
export type PreviousSet = { weightKg: number | null; reps: number | null; rir: number | null; isWarmup: boolean };

/** What you did last time on an exercise, and when. */
export type LastTime = { date: number; sets: PreviousSet[] };

export type SessionExercise = {
  id: number;
  exerciseId: string;
  name: string;
  position: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** How much the suggestion adds when you've earned an increase. */
  incrementKg: number;
  sets: SessionSet[];
  /** Completed sets from the last finished session that included this exercise. */
  previous: PreviousSet[];
  /** When that last session was, or null if never done before. */
  previousDate: number | null;
};

export type SessionDetail = {
  id: number;
  workoutId: WorkoutId;
  workoutName: string;
  startedAt: number;
  finishedAt: number | null;
  status: 'active' | 'finished';
  exercises: SessionExercise[];
};

type SetRow = {
  id: number;
  session_exercise_id: number;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  is_warmup: number;
  note: string | null;
  completed_at: number | null;
};

function toSet(r: SetRow): SessionSet {
  return {
    id: r.id,
    position: r.position,
    weightKg: r.weight_kg,
    reps: r.reps,
    rir: r.rir,
    isWarmup: r.is_warmup === 1,
    note: r.note,
    completedAt: r.completed_at,
  };
}

/** The workout currently in progress, if any (so we can resume it). */
export async function getActiveSessionId(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
  );
  return row?.id ?? null;
}

/** Completed sets from the most recent FINISHED session that included this exercise. */
export async function getLastTime(
  db: SQLiteDatabase,
  exerciseId: string,
  excludeSessionId?: number,
): Promise<LastTime | null> {
  const last = await db.getFirstAsync<{ id: number; started_at: number }>(
    `SELECT se.id, s.started_at FROM session_exercises se
     JOIN sessions s ON s.id = se.session_id
     WHERE se.exercise_id = ? AND s.status = 'finished' AND s.id != ?
     ORDER BY s.started_at DESC, se.id DESC LIMIT 1`,
    exerciseId,
    excludeSessionId ?? -1,
  );
  if (!last) return null;
  const rows = await db.getAllAsync<SetRow>(
    `SELECT * FROM sets WHERE session_exercise_id = ? AND completed_at IS NOT NULL ORDER BY position`,
    last.id,
  );
  return {
    date: last.started_at,
    sets: rows.map((r) => ({ weightKg: r.weight_kg, reps: r.reps, rir: r.rir, isWarmup: r.is_warmup === 1 })),
  };
}

/**
 * The weight to pre-fill in each working set: an earned increase applies to
 * every set; otherwise each set keeps its weight from last time.
 */
function startingWeights(
  previous: PreviousSet[],
  t: { targetSets: number; repMin: number; repMax: number; incrementKg: number },
): (number | null)[] {
  const prevWorking = previous.filter((s) => !s.isWarmup);
  const suggestion = suggestWeight({ previous, ...t });
  return Array.from({ length: t.targetSets }, (_, i) => {
    if (suggestion.kind === 'increase') return suggestion.weightKg;
    const prev = prevWorking[i] ?? prevWorking[prevWorking.length - 1];
    return prev?.weightKg ?? null;
  });
}

/**
 * Swaps an exercise for today only (e.g. machine taken). Your plan is not changed.
 *
 * - Nothing ticked yet: the exercise is simply replaced.
 * - Some sets already ticked: those stay on the original exercise (so history
 *   stays correct), and the sets still to do move to the new exercise, which is
 *   added right after it.
 *
 * Returns the id of the session exercise to show next.
 */
export async function swapExercise(db: SQLiteDatabase, sessionExerciseId: number, newExerciseId: string): Promise<number | null> {
  const se = await db.getFirstAsync<{
    session_id: number;
    exercise_id: string;
    swapped_from_id: string | null;
    position: number;
    target_sets: number;
    rep_min: number;
    rep_max: number;
    rest_seconds: number;
  }>('SELECT * FROM session_exercises WHERE id = ?', sessionExerciseId);
  const ex = await db.getFirstAsync<{ name: string; increment_kg: number }>(
    'SELECT name, increment_kg FROM exercises WHERE id = ?',
    newExerciseId,
  );
  if (!se || !ex) return null;

  if (await hasCompletedSets(db, sessionExerciseId)) {
    // Split: keep the ticked sets, move what's left to the new exercise.
    const counts = await db.getFirstAsync<{ done: number; left: number }>(
      `SELECT SUM(completed_at IS NOT NULL) AS done, SUM(completed_at IS NULL) AS left
       FROM sets WHERE session_exercise_id = ? AND is_warmup = 0`,
      sessionExerciseId,
    );
    const remaining = Math.max(counts?.left ?? 0, 1);
    const prev = (await getLastTime(db, newExerciseId, se.session_id))?.sets ?? [];
    const weights = startingWeights(prev, {
      targetSets: remaining,
      repMin: se.rep_min,
      repMax: se.rep_max,
      incrementKg: ex.increment_kg,
    });
    let newId: number | null = null;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM sets WHERE session_exercise_id = ? AND completed_at IS NULL', sessionExerciseId);
      await txn.runAsync('UPDATE session_exercises SET target_sets = ? WHERE id = ?', Math.max(counts?.done ?? 0, 1), sessionExerciseId);
      await txn.runAsync(
        'UPDATE session_exercises SET position = position + 1 WHERE session_id = ? AND position > ?',
        se.session_id,
        se.position,
      );
      const res = await txn.runAsync(
        `INSERT INTO session_exercises
           (session_id, exercise_id, exercise_name, position, target_sets, rep_min, rep_max, rest_seconds, swapped_from_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        se.session_id,
        newExerciseId,
        ex.name,
        se.position + 1,
        remaining,
        se.rep_min,
        se.rep_max,
        se.rest_seconds,
        se.swapped_from_id ?? se.exercise_id,
      );
      newId = res.lastInsertRowId;
      for (let i = 0; i < remaining; i++) {
        await txn.runAsync('INSERT INTO sets (session_exercise_id, position, weight_kg) VALUES (?, ?, ?)', newId, i + 1, weights[i] ?? null);
      }
    });
    return newId;
  }

  const previous = (await getLastTime(db, newExerciseId, se.session_id))?.sets ?? [];
  const sets = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM sets WHERE session_exercise_id = ? AND is_warmup = 0 ORDER BY position, id',
    sessionExerciseId,
  );
  const weights = startingWeights(previous, {
    targetSets: Math.max(sets.length, 1),
    repMin: se.rep_min,
    repMax: se.rep_max,
    incrementKg: ex.increment_kg,
  });

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE session_exercises SET exercise_id = ?, exercise_name = ?, swapped_from_id = ? WHERE id = ?`,
      newExerciseId,
      ex.name,
      se.swapped_from_id ?? se.exercise_id, // remember the ORIGINAL planned exercise
      sessionExerciseId,
    );
    // New exercise, new numbers: clear typed reps and pre-fill its own weights.
    for (let i = 0; i < sets.length; i++) {
      await txn.runAsync('UPDATE sets SET weight_kg = ?, reps = NULL WHERE id = ?', weights[i] ?? null, sets[i].id);
    }
    await txn.runAsync('DELETE FROM sets WHERE session_exercise_id = ? AND is_warmup = 1', sessionExerciseId);
  });
  return sessionExerciseId;
}

/** Has any set of this exercise been ticked yet today? */
export async function hasCompletedSets(db: SQLiteDatabase, sessionExerciseId: number) {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sets WHERE session_exercise_id = ? AND completed_at IS NOT NULL',
    sessionExerciseId,
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Starts a new workout: copies today's plan into the session and creates the
 * planned number of empty set rows, with the weight pre-filled from the
 * suggestion (or last time's weight if there's no suggestion).
 */
export async function startSession(
  db: SQLiteDatabase,
  workoutId: WorkoutId,
  workoutName: string,
  /** For logging a forgotten workout: when it happened and how long it took. */
  past?: { startedAt: number; finishedAt: number },
  /** A one-off plan for this session only (an accepted suggestion). The saved plan is untouched. */
  planOverride?: PlannedExercise[],
): Promise<number> {
  const plan = planOverride ?? (await getPlanForWorkout(db, workoutId));
  const lastTimes = new Map<string, LastTime | null>();
  for (const p of plan) lastTimes.set(p.exercise.id, await getLastTime(db, p.exercise.id));
  // Set by the "welcome back" fresh start: first session back on each exercise is ~10% lighter.
  const easeBackAt = Number((await getSetting(db, 'ease_back_at')) ?? '0');

  let sessionId = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const res = await txn.runAsync(
      `INSERT INTO sessions (workout_id, workout_name, started_at, finished_at, status) VALUES (?, ?, ?, ?, ?)`,
      workoutId,
      workoutName,
      past?.startedAt ?? Date.now(),
      past?.finishedAt ?? null,
      past ? 'finished' : 'active',
    );
    sessionId = res.lastInsertRowId;

    for (const p of plan) {
      const seRes = await txn.runAsync(
        `INSERT INTO session_exercises
           (session_id, exercise_id, exercise_name, position, target_sets, rep_min, rep_max, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        p.exercise.id,
        p.exercise.name,
        p.position,
        p.targetSets,
        p.repMin,
        p.repMax,
        p.restSeconds,
      );
      const last = lastTimes.get(p.exercise.id) ?? null;
      let weights = startingWeights(last?.sets ?? [], {
        targetSets: p.targetSets,
        repMin: p.repMin,
        repMax: p.repMax,
        incrementKg: p.exercise.incrementKg,
      });
      if (!past && last && easeBackAt && last.date < easeBackAt) {
        weights = weights.map((w) => easeBack(w, p.exercise.incrementKg));
      }

      // Warm-ups only for the first exercise of a live workout.
      const warmups = !past && p === plan[0] ? planWarmups(weights[0], p.exercise.equipment) : [];
      let pos = 1;
      for (const w of warmups) {
        await txn.runAsync(
          `INSERT INTO sets (session_exercise_id, position, weight_kg, reps, is_warmup) VALUES (?, ?, ?, ?, 1)`,
          seRes.lastInsertRowId,
          pos++,
          w.weightKg,
          w.reps,
        );
      }
      for (let i = 0; i < p.targetSets; i++) {
        await txn.runAsync(
          `INSERT INTO sets (session_exercise_id, position, weight_kg) VALUES (?, ?, ?)`,
          seRes.lastInsertRowId,
          pos++,
          weights[i],
        );
      }
    }
  });
  return sessionId;
}

/** Loads a whole session: its exercises, their sets, and last time's numbers. */
export async function getSessionDetail(db: SQLiteDatabase, sessionId: number): Promise<SessionDetail | null> {
  const s = await db.getFirstAsync<{
    id: number;
    workout_id: string;
    workout_name: string;
    started_at: number;
    finished_at: number | null;
    status: string;
  }>('SELECT * FROM sessions WHERE id = ?', sessionId);
  if (!s) return null;

  const exRows = await db.getAllAsync<{
    id: number;
    exercise_id: string;
    exercise_name: string;
    position: number;
    target_sets: number;
    rep_min: number;
    rep_max: number;
    rest_seconds: number;
    increment_kg: number | null;
  }>(
    `SELECT se.*, e.increment_kg FROM session_exercises se
     LEFT JOIN exercises e ON e.id = se.exercise_id
     WHERE se.session_id = ? ORDER BY se.position, se.id`,
    sessionId,
  );

  const setRows = await db.getAllAsync<SetRow>(
    `SELECT st.* FROM sets st
     JOIN session_exercises se ON se.id = st.session_exercise_id
     WHERE se.session_id = ? ORDER BY st.position, st.id`,
    sessionId,
  );

  const exercises: SessionExercise[] = [];
  for (const e of exRows) {
    const lastTime = await getLastTime(db, e.exercise_id, sessionId);
    exercises.push({
      id: e.id,
      exerciseId: e.exercise_id,
      name: e.exercise_name,
      position: e.position,
      targetSets: e.target_sets,
      repMin: e.rep_min,
      repMax: e.rep_max,
      restSeconds: e.rest_seconds,
      incrementKg: e.increment_kg ?? 2.5,
      sets: setRows.filter((r) => r.session_exercise_id === e.id).map(toSet),
      previous: lastTime?.sets ?? [],
      previousDate: lastTime?.date ?? null,
    });
  }

  return {
    id: s.id,
    workoutId: s.workout_id as WorkoutId,
    workoutName: s.workout_name,
    startedAt: s.started_at,
    finishedAt: s.finished_at,
    status: s.status as SessionDetail['status'],
    exercises,
  };
}

export type SetPatch = Partial<{
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  isWarmup: boolean;
  note: string | null;
  completedAt: number | null;
}>;

const COLUMN: Record<keyof SetPatch, string> = {
  weightKg: 'weight_kg',
  reps: 'reps',
  rir: 'rir',
  isWarmup: 'is_warmup',
  note: 'note',
  completedAt: 'completed_at',
};

/** Saves any change to a set: weight, reps, tick, reps in reserve, warm-up, note. */
export async function updateSet(db: SQLiteDatabase, setId: number, patch: SetPatch) {
  const keys = Object.keys(patch) as (keyof SetPatch)[];
  if (keys.length === 0) return;
  const assignments = keys.map((k) => `${COLUMN[k]} = ?`).join(', ');
  const values = keys.map((k) => {
    const v = patch[k];
    return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
  });
  await db.runAsync(`UPDATE sets SET ${assignments} WHERE id = ?`, ...values, setId);
}

/** Adds one more set to an exercise, copying the weight of the set above it. */
export async function addSet(db: SQLiteDatabase, sessionExerciseId: number) {
  const last = await db.getFirstAsync<{ position: number; weight_kg: number | null }>(
    `SELECT position, weight_kg FROM sets WHERE session_exercise_id = ? AND is_warmup = 0
     ORDER BY position DESC LIMIT 1`,
    sessionExerciseId,
  );
  const maxPos = await db.getFirstAsync<{ p: number | null }>(
    'SELECT MAX(position) AS p FROM sets WHERE session_exercise_id = ?',
    sessionExerciseId,
  );
  await db.runAsync(
    'INSERT INTO sets (session_exercise_id, position, weight_kg) VALUES (?, ?, ?)',
    sessionExerciseId,
    (maxPos?.p ?? 0) + 1,
    last?.weight_kg ?? null,
  );
}

export async function deleteSet(db: SQLiteDatabase, setId: number) {
  await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
}

/** Marks the workout as done. It then counts as done in the rotation. */
export async function finishSession(db: SQLiteDatabase, sessionId: number) {
  await db.runAsync(
    `UPDATE sessions SET status = 'finished', finished_at = ? WHERE id = ?`,
    Date.now(),
    sessionId,
  );
  // Any "Change Workout" pick has been used; let the rotation suggest again.
  await db.runAsync(`DELETE FROM settings WHERE key = 'selected_workout'`);
}

/** For a workout started by accident: removes it and all its sets. */
export async function cancelSession(db: SQLiteDatabase, sessionId: number) {
  await db.runAsync('DELETE FROM sessions WHERE id = ?', sessionId);
}

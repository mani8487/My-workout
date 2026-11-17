/**
 * Personal records for one session, compared with every EARLIER finished session.
 * Warm-ups never count.
 *
 *  - Weight PR: heavier than you've ever lifted on that exercise.
 *  - Rep PR:    more reps than ever before at a weight you've used before.
 *
 * A first-ever session of an exercise sets no records (nothing to beat yet).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export type PersonalRecord = {
  exerciseName: string;
  kind: 'weight' | 'reps';
  weightKg: number;
  reps: number;
  /** The old best, for "was …" text. */
  previousBest: number;
};

type Row = { exercise_id: string; exercise_name: string; weight_kg: number | null; reps: number };

export async function getSessionRecords(db: SQLiteDatabase, sessionId: number): Promise<PersonalRecord[]> {
  const session = await db.getFirstAsync<{ started_at: number }>('SELECT started_at FROM sessions WHERE id = ?', sessionId);
  if (!session) return [];

  const current = await db.getAllAsync<Row>(
    `SELECT se.exercise_id, se.exercise_name, st.weight_kg, st.reps
     FROM sets st JOIN session_exercises se ON se.id = st.session_exercise_id
     WHERE se.session_id = ? AND st.completed_at IS NOT NULL AND st.is_warmup = 0 AND st.reps > 0
     ORDER BY se.position`,
    sessionId,
  );

  const records: PersonalRecord[] = [];
  const exerciseIds = [...new Set(current.map((r) => r.exercise_id))];

  for (const exId of exerciseIds) {
    const mine = current.filter((r) => r.exercise_id === exId);
    const before = await db.getAllAsync<{ weight_kg: number | null; reps: number }>(
      `SELECT st.weight_kg, st.reps
       FROM sets st
       JOIN session_exercises se ON se.id = st.session_exercise_id
       JOIN sessions s ON s.id = se.session_id
       WHERE se.exercise_id = ? AND s.status = 'finished' AND s.id != ? AND s.started_at < ?
         AND st.completed_at IS NOT NULL AND st.is_warmup = 0 AND st.reps > 0`,
      exId,
      sessionId,
      session.started_at,
    );
    if (before.length === 0) continue;

    const w = (x: { weight_kg: number | null }) => x.weight_kg ?? 0;
    const name = mine[0].exercise_name;

    // Weight PR: best new top weight (with the most reps done at it).
    const oldTop = Math.max(...before.map(w));
    const newTop = Math.max(...mine.map(w));
    if (newTop > oldTop) {
      const reps = Math.max(...mine.filter((r) => w(r) === newTop).map((r) => r.reps));
      records.push({ exerciseName: name, kind: 'weight', weightKg: newTop, reps, previousBest: oldTop });
    }

    // Rep PR: at a weight used before, beat the most reps. Report the heaviest such weight.
    let bestRepPr: PersonalRecord | null = null;
    for (const r of mine) {
      const sameWeight = before.filter((b) => w(b) === w(r));
      if (sameWeight.length === 0) continue;
      const oldMax = Math.max(...sameWeight.map((b) => b.reps));
      if (r.reps > oldMax && (!bestRepPr || w(r) > bestRepPr.weightKg || (w(r) === bestRepPr.weightKg && r.reps > bestRepPr.reps))) {
        bestRepPr = { exerciseName: name, kind: 'reps', weightKg: w(r), reps: r.reps, previousBest: oldMax };
      }
    }
    if (bestRepPr) records.push(bestRepPr);
  }
  return records;
}

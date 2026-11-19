/**
 * Runs once every time the app starts, before any screen shows:
 *  1. Turns on SQLite's safety settings.
 *  2. Applies any table upgrades (see migrations.ts).
 *  3. Fills in the built-in library, the five workouts and the starter plan
 *     (the plan only on the very first run).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_LIBRARY, slugify } from '@/data/exercise-library';
import { DEFAULT_PLAN, WORKOUTS } from '@/data/default-plan';
import { runMigrations } from './migrations';
import { STARTER_ROUTINES } from '@/data/starter-routines';
import { addRoutine, addWorkout } from './plan';
import { getSetting, setSetting } from './settings';

export const DATABASE_NAME = 'workout-tracker.db';

export async function initDatabase(db: SQLiteDatabase) {
  // WAL = writes are safely on disk the moment they're saved, and reads stay fast.
  // foreign_keys = the database refuses to leave orphaned rows behind.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  await runMigrations(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    // Add any built-in exercises that aren't there yet. Never overwrites.
    for (const ex of EXERCISE_LIBRARY) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO exercises (id, name, muscles, equipment, increment_kg, is_custom)
         VALUES (?, ?, ?, ?, ?, 0)`,
        ex.id,
        ex.name,
        ex.muscles.join(','),
        ex.equipment,
        ex.incrementKg,
      );
    }
  });

  // The five workouts and starter plan go in only once (first run), so your
  // later edits, including deleting them, are never undone.
  if ((await getSetting(db, 'plan_seeded')) !== '1') {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const w of WORKOUTS) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO workouts (id, name, muscle_label, icon, sort_order) VALUES (?, ?, ?, ?, ?)`,
          w.id,
          w.name,
          w.muscleLabel,
          w.icon,
          w.sortOrder,
        );
      }
      for (const item of DEFAULT_PLAN) {
        await txn.runAsync(
          `INSERT INTO plan_items (workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          item.workoutId,
          item.exerciseId,
          item.position,
          item.targetSets,
          item.repMin,
          item.repMax,
          item.restSeconds,
        );
      }
      await txn.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('plan_seeded', '1')`);
    });
  }

  // Your three starter routines, added once. Your active routine doesn't change.
  if ((await getSetting(db, 'starter_routines_v1')) !== '1') {
    // All-or-nothing, so a hiccup can never leave half a routine behind.
    await db.withTransactionAsync(async () => {
    for (const r of STARTER_ROUTINES) {
      const routineId = await addRoutine(db, r.name);
      for (const w of r.workouts) {
        const workoutId = await addWorkout(db, { name: w.name, muscleLabel: w.muscleLabel, icon: w.icon, routineId });
        for (let i = 0; i < w.lines.length; i++) {
          const [name, sets, repMin, repMax] = w.lines[i];
          await db.runAsync(
            `INSERT INTO plan_items (workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds)
             VALUES (?, ?, ?, ?, ?, ?, 120)`,
            workoutId,
            slugify(name),
            i + 1,
            sets,
            repMin,
            repMax,
          );
        }
      }
    }
    await setSetting(db, 'starter_routines_v1', '1');
    });
  }
}

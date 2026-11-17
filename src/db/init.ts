/**
 * Runs once every time the app starts, before any screen shows:
 *  1. Turns on SQLite's safety settings.
 *  2. Applies any table upgrades (see migrations.ts).
 *  3. Fills in the built-in library, the five workouts and the starter plan
 *     (the plan only on the very first run).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { DEFAULT_PLAN, WORKOUTS } from '@/data/default-plan';
import { runMigrations } from './migrations';
import { getSetting } from './settings';

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
}

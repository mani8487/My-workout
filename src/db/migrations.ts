/**
 * The database's table layout, written as a list of numbered "upgrades".
 *
 * The phone remembers which upgrade it last ran (SQLite's `user_version`).
 * When the app starts, it runs any newer ones in order. That way, when we
 * add features later, your existing workouts are kept and only the new
 * tables or columns are added. NEVER edit an upgrade that has already
 * shipped; always add a new one at the end.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATIONS: string[] = [
  // ---- Upgrade 1: the first version of the database ----
  `
  -- The exercise library (built-in + your own custom ones).
  CREATE TABLE exercises (
    id            TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    muscles       TEXT NOT NULL,            -- e.g. "chest,triceps"
    equipment     TEXT NOT NULL,
    increment_kg  REAL NOT NULL DEFAULT 2.5,
    is_custom     INTEGER NOT NULL DEFAULT 0
  );

  -- The five workouts in the split.
  CREATE TABLE workouts (
    id            TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    muscle_label  TEXT NOT NULL,
    icon          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL
  );

  -- Your plan: which exercises each workout contains, in order, with targets.
  CREATE TABLE plan_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id    TEXT NOT NULL REFERENCES workouts(id),
    exercise_id   TEXT NOT NULL REFERENCES exercises(id),
    position      INTEGER NOT NULL,
    target_sets   INTEGER NOT NULL,
    rep_min       INTEGER NOT NULL,
    rep_max       INTEGER NOT NULL,
    rest_seconds  INTEGER NOT NULL DEFAULT 120
  );
  CREATE INDEX idx_plan_items_workout ON plan_items(workout_id, position);

  -- One row per gym visit. Names are COPIED in, so editing your plan
  -- later never changes what history shows.
  CREATE TABLE sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id    TEXT NOT NULL,
    workout_name  TEXT NOT NULL,
    started_at    INTEGER NOT NULL,         -- milliseconds since 1970
    finished_at   INTEGER,                  -- empty while in progress
    status        TEXT NOT NULL DEFAULT 'active'  -- active | finished
  );
  CREATE INDEX idx_sessions_started ON sessions(started_at);

  -- The exercises done in one session (a snapshot of the plan at the time,
  -- including any swaps you made that day).
  CREATE TABLE session_exercises (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id         INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id        TEXT NOT NULL,
    exercise_name      TEXT NOT NULL,
    position           INTEGER NOT NULL,
    target_sets        INTEGER NOT NULL,
    rep_min            INTEGER NOT NULL,
    rep_max            INTEGER NOT NULL,
    rest_seconds       INTEGER NOT NULL,
    swapped_from_id    TEXT                -- set if this replaced a planned exercise
  );
  CREATE INDEX idx_session_exercises_session ON session_exercises(session_id, position);
  CREATE INDEX idx_session_exercises_exercise ON session_exercises(exercise_id);

  -- Every single set. Written the instant you log it.
  CREATE TABLE sets (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    session_exercise_id  INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
    position             INTEGER NOT NULL,
    weight_kg            REAL,
    reps                 INTEGER,
    rir                  INTEGER,           -- reps in reserve, 0-3, optional
    is_warmup            INTEGER NOT NULL DEFAULT 0,
    note                 TEXT,
    completed_at         INTEGER            -- empty until ticked
  );
  CREATE INDEX idx_sets_session_exercise ON sets(session_exercise_id, position);

  -- Small settings: your name, theme choice, when the current cycle began, etc.
  CREATE TABLE settings (
    key    TEXT PRIMARY KEY NOT NULL,
    value  TEXT
  );
  `,

  // ---- Upgrade 2: routines (separate sets of workouts; one is active at a time) ----
  `
  CREATE TABLE routines (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
  );
  INSERT INTO routines (id, name, sort_order) VALUES ('main', '5-Day Split', 1);
  -- Every existing workout belongs to the original routine.
  ALTER TABLE workouts ADD COLUMN routine_id TEXT NOT NULL DEFAULT 'main';
  `,

  // ---- Upgrade 3: quick logs (any activity outside a full workout: a walk, 20 squats, yoga) ----
  `
  CREATE TABLE quick_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    activity      TEXT NOT NULL,            -- preset id ('squats') or 'custom'
    name          TEXT NOT NULL,            -- what to show, e.g. "Squats" or a custom name
    amount        REAL NOT NULL,            -- reps or minutes, see unit
    unit          TEXT NOT NULL,            -- 'reps' or 'min'
    distance_km   REAL,                     -- optional, for run / swim / cycling
    muscle_group  TEXT NOT NULL,            -- legs, upper, core, cardio, mobility
    logged_at     INTEGER NOT NULL          -- when it happened (ms since 1970)
  );
  CREATE INDEX quick_logs_logged_at ON quick_logs (logged_at);
  `,
];

export async function runMigrations(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
      await txn.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

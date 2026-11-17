/**
 * "Welcome back" after a break of about three weeks or more.
 * Fresh start = a new cycle (everything owed again, starting with Push) and
 * the first session back on each exercise pre-filled about 10% lighter.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';

const GAP_MS = 21 * 86_400_000;

/** Weeks away, or null if no banner should show. */
export async function freshStartOffer(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ last: number | null }>(
    `SELECT MAX(started_at) AS last FROM sessions WHERE status = 'finished'`,
  );
  const last = row?.last;
  if (!last || Date.now() - last < GAP_MS) return null;
  const dismissed = Number((await getSetting(db, 'fresh_start_dismissed_at')) ?? '0');
  if (dismissed > last) return null; // already answered for this break
  return Math.floor((Date.now() - last) / (7 * 86_400_000));
}

export async function acceptFreshStart(db: SQLiteDatabase) {
  const now = String(Date.now());
  await setSetting(db, 'cycle_start', now);
  await setSetting(db, 'ease_back_at', now);
  await setSetting(db, 'selected_workout', null);
  await setSetting(db, 'fresh_start_dismissed_at', now);
}

export async function dismissFreshStart(db: SQLiteDatabase) {
  await setSetting(db, 'fresh_start_dismissed_at', String(Date.now()));
}

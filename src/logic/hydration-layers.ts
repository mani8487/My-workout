/**
 * Water on Milo: how today's drinks become the fill level inside him, and
 * when he may glance at his bowl. Pure functions, no imports, so `npm test`
 * runs them with plain Node.
 *
 * Every drink adds its ml × its hydration factor (all 1.0 for now). The level
 * is that total against the daily goal: 0 = empty, 1 = full at the goal. It
 * keeps counting past the goal up to FILL_CAP, so a drink after the goal still
 * registers, but never runs away.
 *
 * The fill is one colour for every drink; the kind is kept in the log only.
 */

/** Drink kinds that can be logged. The kind is stored with each log for history; it never changes the fill colour. */
export type DrinkKind = 'water';
export const DEFAULT_DRINK: DrinkKind = 'water';

/** How much of each drink counts toward hydration (1 = all of it). */
export const HYDRATION_FACTOR: Record<DrinkKind, number> = {
  water: 1.0,
};

/** The fill stops at 120% of the goal. */
export const FILL_CAP = 1.2;

/** Settings key: "Show water on Milo" ('0' = off; anything else, or unset, = on). */
export const MILO_WATER_KEY = 'milo_water';
/** Settings key for the bowl reminders already shown today (see nudges below). */
export const WATER_NUDGE_KEY = 'water_nudges';

export type Drink = { ml: number; kind: string };

const factorOf = (kind: string) => (kind in HYDRATION_FACTOR ? HYDRATION_FACTOR[kind as DrinkKind] : 1);

/** One drink's hydration in ml: ml × factor (an unknown kind counts in full). Negative or broken amounts count as 0. */
export function hydrationOf(drink: Drink): number {
  const ml = Number.isFinite(drink.ml) ? Math.max(0, drink.ml) : 0;
  return ml * factorOf(drink.kind);
}

/** Total hydration in ml for a list of drinks. */
export function totalHydration(drinks: readonly Drink[]): number {
  return drinks.reduce((sum, d) => sum + hydrationOf(d), 0);
}

/** Fill level: hydration / goal, from 0 to FILL_CAP. A goal of 0 or less counts as met once there's anything. */
export function fillLevel(hydrationMl: number, goalMl: number): number {
  const ml = Number.isFinite(hydrationMl) ? Math.max(0, hydrationMl) : 0;
  if (!(goalMl > 0)) return ml > 0 ? 1 : 0;
  return Math.min(FILL_CAP, ml / goalMl);
}

// ---------- the bowl reminder ("behind pace") ----------

/** At most this many glances at the bowl per day... */
export const MAX_NUDGES_PER_DAY = 3;
/** ...at least this far apart... */
export const NUDGE_GAP_MS = 90 * 60 * 1000;
/** ...and never in quiet hours (before 9:00 or from 21:00). */
export const NUDGE_FIRST_HOUR = 9;
export const NUDGE_LAST_HOUR = 21;

export type NudgeLog = { day: string; count: number; lastAt: number };

export function readNudgeLog(saved: string | null, day: string): NudgeLog {
  const empty = { day, count: 0, lastAt: 0 };
  if (!saved) return empty;
  try {
    const v = JSON.parse(saved) as Partial<NudgeLog>;
    if (v.day !== day) return empty;
    const count = Number(v.count);
    const lastAt = Number(v.lastAt);
    return { day, count: Number.isFinite(count) ? count : 0, lastAt: Number.isFinite(lastAt) ? lastAt : 0 };
  } catch {
    return empty;
  }
}

export function isQuietHour(now: Date): boolean {
  const h = now.getHours();
  return h < NUDGE_FIRST_HOUR || h >= NUDGE_LAST_HOUR;
}

/** May Milo glance at his bowl now? Only when behind pace, outside quiet hours, under the daily limit and not too soon. */
export function mayNudge(behind: boolean, now: Date, log: NudgeLog): boolean {
  if (!behind || isQuietHour(now)) return false;
  if (log.count >= MAX_NUDGES_PER_DAY) return false;
  return log.lastAt === 0 || now.getTime() - log.lastAt >= NUDGE_GAP_MS;
}

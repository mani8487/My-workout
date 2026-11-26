/**
 * Local days: when "today" ends, and what Home last showed (pure, unit-tested).
 */

/** "2026-11-26" for the local calendar day. */
export function dayKeyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Milliseconds until the next local midnight. Built from calendar fields, so
 * a 23- or 25-hour daylight-saving day still ends at its real midnight.
 */
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1, next.getTime() - now.getTime());
}

/** What the Living Home scene showed last time, saved so a cold start can catch up from it. */
export type LastSeen = { day: string; stage: number; water: number };

export const LAST_SEEN_KEY = 'scene_last_seen';

export function encodeLastSeen(v: LastSeen): string {
  return JSON.stringify(v);
}

/**
 * Where the catch-up animation starts: what was last seen today, or the empty
 * morning room if it was another day (or nothing valid was saved).
 */
export function catchUpFrom(saved: string | null, todayKey: string): { stage: number; water: number } {
  const empty = { stage: 0, water: 0 };
  if (!saved) return empty;
  try {
    const v = JSON.parse(saved) as Partial<LastSeen>;
    if (v.day !== todayKey) return empty;
    const stage = Number(v.stage);
    const water = Number(v.water);
    return {
      stage: Number.isFinite(stage) ? Math.min(2, Math.max(0, stage)) : 0,
      water: Number.isFinite(water) ? Math.min(1, Math.max(0, water)) : 0,
    };
  } catch {
    return empty;
  }
}

/**
 * Days in a row with any activity, ending today if today already has some,
 * otherwise ending yesterday (an unfinished today doesn't break the streak).
 * `times` are activity timestamps (finished workouts and quick logs).
 */
export function streakDays(times: readonly number[], now: Date): number {
  const active = new Set(times.map((t) => dayKeyOf(new Date(t))));
  const day = (back: number) => dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
  let back = active.has(day(0)) ? 0 : 1;
  let count = 0;
  while (active.has(day(back))) {
    count++;
    back++;
  }
  return count;
}

/**
 * Activity cameos (pure, tested): after a Quick Log, Milo acts out the
 * activity for about two seconds, then goes back to what he was doing.
 *
 * Rapid logs queue up instead of stacking: the same cameo twice in a row
 * plays once, and at most MAX_QUEUED wait their turn.
 */

export type CameoKind = 'stretch' | 'walk' | 'run' | 'squat';

/** How many cameos may wait in line; later ones are dropped (he's busy enough). */
export const MAX_QUEUED = 3;

/** Which cameo a Quick Log activity plays (the four built so far cover every preset). */
const BY_ACTIVITY: Record<string, CameoKind> = {
  yoga: 'stretch',
  stretch: 'stretch',
  plank: 'stretch',
  walk: 'walk',
  run: 'run',
  cycling: 'run',
  swim: 'run',
  squats: 'squat',
  pushups: 'squat',
};

export function cameoFor(activityId: string): CameoKind {
  return BY_ACTIVITY[activityId] ?? 'walk';
}

/**
 * Adds new cameos to the waiting line. A cameo equal to the one just before it
 * (already waiting or playing) is skipped, and the line never grows past MAX_QUEUED.
 */
export function enqueueCameos(queue: readonly CameoKind[], incoming: readonly CameoKind[], playing: CameoKind | null): CameoKind[] {
  const next = [...queue];
  for (const kind of incoming) {
    const last = next.length > 0 ? next[next.length - 1] : playing;
    if (kind === last) continue;
    if (next.length >= MAX_QUEUED) break;
    next.push(kind);
  }
  return next;
}

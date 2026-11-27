/**
 * The contract between screens and whatever draws Milo.
 *
 * Screens only ever use <Milo /> (milo.tsx). Milo picks a renderer that
 * follows MiloRenderer. Today that is the PuppetRenderer (layered SVG moved
 * with Reanimated); later a RiveRenderer can follow the same contract and be
 * swapped in renderer.ts without touching any screen.
 */
import type { ComponentType } from 'react';

export type MiloState =
  | 'sleeping'
  | 'waking' // head lifts, stretch, hop, then settles into sitting
  | 'stirring' // still lying down, breathing a little quicker (first activity of the day)
  | 'sitting'
  | 'content' // sitting with happy, mostly closed eyes (goal reached)
  | 'reacting' // paw lift, e.g. when a set is saved
  | 'celebrating' // jump with confetti
  | 'drinking' // laps from a water bowl
  | 'departing' // ears perk, crouch, hops off toward you (leaving for a workout)
  | 'arriving' // hops back in from below and lands in his spot (back from a workout)
  // Activity cameos after a Quick Log (about 2 s each, then back to what he was doing):
  | 'cameo-stretch' // reaches up and stretches, eyes closed
  | 'cameo-walk' // a few easy steps on the spot
  | 'cameo-run' // quick strides, ears back
  | 'cameo-squat'; // three slow squats

export type MiloRendererProps = {
  state: MiloState;
  /** Width and height in points. Milo is drawn on a square stage. */
  size: number;
  /** Changes every time a one-shot (reacting, celebrating) should replay. */
  cue: number;
  /** Changes on every tap: turn the head or twitch an ear. */
  tapSignal: number;
  /** Screen hidden or app in background: stop all looping motion. */
  paused: boolean;
  /** iPhone Reduce Motion is on: show still poses, no motion. */
  reducedMotion: boolean;
  /** Dark backgrounds get a darker contact shadow and lighter "Zz". */
  isDark: boolean;
  /** The couch is part of the room: keep it when Milo gets up (otherwise it fades away). */
  keepCouch?: boolean;
  /** Wears his towel (after a workout today). */
  towel?: boolean;
  /** Called when a one-shot state (waking, reacting) has finished. */
  onSettled: (state: MiloState) => void;
};

export type MiloRenderer = ComponentType<MiloRendererProps>;

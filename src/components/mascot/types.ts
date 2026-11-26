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
  | 'sitting'
  | 'reacting' // paw lift, e.g. when a set is saved
  | 'celebrating' // jump with confetti
  | 'drinking'; // laps from a water bowl

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
  /** Called when a one-shot state (waking, reacting) has finished. */
  onSettled: (state: MiloState) => void;
};

export type MiloRenderer = ComponentType<MiloRendererProps>;

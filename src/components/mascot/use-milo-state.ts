/**
 * useMiloState(): Milo's mood, with simple commands for screens.
 * One-shot moods (waking, reacting) report back when they finish, and Milo
 * settles into sitting on his own.
 */
import { useCallback, useMemo, useState } from 'react';

import type { MiloState } from './types';

export function useMiloState(initial: MiloState = 'sitting') {
  const [state, setState] = useState<MiloState>(initial);
  const [cue, setCue] = useState(0);

  const go = useCallback((next: MiloState) => {
    setState(next);
    setCue((c) => c + 1); // replays a reaction even if Milo is already reacting
  }, []);

  const onSettled = useCallback((done: MiloState) => {
    if (done === 'waking' || done === 'reacting') setState((s) => (s === done ? 'sitting' : s));
  }, []);

  return useMemo(
    () => ({
      state,
      props: { state, cue, onSettled },
      set: go,
      sleep: () => go('sleeping'),
      wake: () => setState((s) => (s === 'sleeping' ? 'waking' : s)),
      sit: () => go('sitting'),
      react: () => go('reacting'),
      celebrate: () => go('celebrating'),
      drink: () => go('drinking'),
    }),
    [state, cue, go, onSettled],
  );
}

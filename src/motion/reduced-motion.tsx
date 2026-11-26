/**
 * Reduce Motion, kept live and in one place.
 *
 * - <MotionRoot> (app root) is the single owner: it follows the iPhone's
 *   Reduce Motion setting (also when it changes while the app is open), applies
 *   any screen override, and keeps Reanimated's one global switch in step with
 *   the result (springs and timings use ReduceMotion.System).
 * - <ReducedMotionOverride> asks the root to force it on or off while that
 *   screen is mounted (the Scene Lab), and clears the request on unmount.
 *   It applies app-wide and supports one override at a time.
 * - useReducedMotion() returns the result. Always use this one, not
 *   Reanimated's (which only reads the setting once, at app launch).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReduceMotion, ReducedMotionConfig, useReducedMotion as useLaunchReducedMotion } from 'react-native-reanimated';

type MotionContext = { reduced: boolean; setOverride: (value: boolean | null) => void };
const Ctx = createContext<MotionContext | null>(null);

export function MotionRoot({ children }: { children: ReactNode }) {
  const atLaunch = useLaunchReducedMotion();
  const [system, setSystem] = useState(atLaunch);
  const [override, setOverride] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setSystem(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  const reduced = override ?? system;
  const value = useMemo(() => ({ reduced, setOverride }), [reduced]);
  return (
    <Ctx.Provider value={value}>
      <ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never} />
      {children}
    </Ctx.Provider>
  );
}

/** Forces Reduce Motion on (true) or off (false) while mounted; null follows the iPhone. */
export function ReducedMotionOverride({ value, children }: { value: boolean | null; children: ReactNode }) {
  const setOverride = useContext(Ctx)?.setOverride;
  useEffect(() => {
    setOverride?.(value);
    return () => setOverride?.(null);
  }, [setOverride, value]);
  return children;
}

export function useReducedMotion(): boolean {
  const launch = useLaunchReducedMotion();
  return useContext(Ctx)?.reduced ?? launch;
}

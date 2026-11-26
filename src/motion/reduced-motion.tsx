/**
 * Reduce Motion, kept live and in one place.
 *
 * - <MotionRoot> (app root) follows the iPhone's Reduce Motion setting, also
 *   when it changes while the app is open, and keeps Reanimated's global
 *   switch in step with it (springs and timings use ReduceMotion.System).
 * - <ReducedMotionOverride> forces it on or off for one screen (the Scene
 *   Lab), including Reanimated's global switch while that screen is mounted.
 * - useReducedMotion() returns whichever applies. Always use this one, not
 *   Reanimated's (which only reads the setting once, at app launch).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReduceMotion, ReducedMotionConfig, useReducedMotion as useLaunchReducedMotion } from 'react-native-reanimated';

const Reduced = createContext<boolean | null>(null);

export function MotionRoot({ children }: { children: ReactNode }) {
  const atLaunch = useLaunchReducedMotion();
  const [system, setSystem] = useState(atLaunch);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setSystem(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return (
    <Reduced.Provider value={system}>
      <ReducedMotionConfig mode={system ? ReduceMotion.Always : ReduceMotion.Never} />
      {children}
    </Reduced.Provider>
  );
}

export function ReducedMotionOverride({ value, children }: { value: boolean | null; children: ReactNode }) {
  const outer = useReducedMotion();
  const effective = value ?? outer;
  return (
    <Reduced.Provider value={effective}>
      {value !== null && <ReducedMotionConfig mode={value ? ReduceMotion.Always : ReduceMotion.Never} />}
      {children}
    </Reduced.Provider>
  );
}

export function useReducedMotion(): boolean {
  const launch = useLaunchReducedMotion();
  return useContext(Reduced) ?? launch;
}

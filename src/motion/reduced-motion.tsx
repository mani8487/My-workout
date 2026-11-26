/**
 * useReducedMotion(): the iPhone's Reduce Motion setting, unless a screen
 * (the Scene Lab) forces it on or off for everything inside it.
 *
 * Always use this one, not Reanimated's, so the Lab override reaches every
 * animated component.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useReducedMotion as useSystemReducedMotion } from 'react-native-reanimated';

const Override = createContext<boolean | null>(null);

export function ReducedMotionOverride({ value, children }: { value: boolean | null; children: ReactNode }) {
  return <Override.Provider value={value}>{children}</Override.Provider>;
}

export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const forced = useContext(Override);
  return forced ?? system;
}

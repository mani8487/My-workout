/**
 * useTodayKey(): today's local date key ("2026-11-26"). Changes at local
 * midnight while the app is open, and when the app comes back from the
 * background on a new day, so screens can reset for the new day.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dayKeyOf, msUntilNextMidnight } from './day';

export function useTodayKey(): string {
  const [key, setKey] = useState(() => dayKeyOf(new Date()));
  // Bumped by every timer fire, so the timer re-arms even if it fired a little
  // early (clock correction, time-zone change) and the day hasn't changed yet.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setKey(dayKeyOf(new Date()));
      setTick((t) => t + 1);
    }, msUntilNextMidnight(new Date()) + 50);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setKey(dayKeyOf(new Date()));
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [key, tick]);
  return key;
}

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
  useEffect(() => {
    // Re-armed every time the key changes, so it always points at the coming midnight.
    const timer = setTimeout(() => setKey(dayKeyOf(new Date())), msUntilNextMidnight(new Date()) + 50);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setKey(dayKeyOf(new Date()));
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [key]);
  return key;
}

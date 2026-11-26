/**
 * useMotionActive(): true only while this screen is focused AND the app is in
 * the foreground. Looping animations stop (cancelAnimation) when it turns
 * false, so nothing runs behind another screen or with the phone locked.
 */
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useMotionActive(): boolean {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

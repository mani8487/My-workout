/**
 * useMotionActive(): true only while this screen is focused and the app is
 * not in the background. Looping animations stop when it turns false, so
 * nothing runs behind another screen or with the phone locked. "inactive"
 * (Control Center, Face ID, a call banner) still counts as on screen, so Milo
 * doesn't freeze mid-pose while he's visible.
 */
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useMotionActive(): boolean {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s !== 'background'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

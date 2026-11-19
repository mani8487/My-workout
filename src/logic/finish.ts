/** Shared "Finish Workout" flow, used by Active Workout and Workout Progress. */
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { finishSession, type SessionDetail } from '@/db/sessions';
import { syncMyWeek } from './social';

export function workingSetsLeft(detail: SessionDetail) {
  return detail.exercises
    .flatMap((e) => e.sets)
    .filter((s) => !s.isWarmup && s.completedAt == null).length;
}

export function confirmFinishWorkout(db: SQLiteDatabase, detail: SessionDetail, stopRestTimer: () => void) {
  async function finish() {
    stopRestTimer();
    await finishSession(db, detail.id);
    syncMyWeek(db); // update the friends leaderboard in the background (does nothing offline or signed out)
    // Clear the workout screens away, then show the summary on top of Home.
    router.dismissTo('/');
    router.push({ pathname: '/workout/summary', params: { id: String(detail.id) } });
  }

  const left = workingSetsLeft(detail);
  if (left <= 0) {
    finish();
    return;
  }
  // "Keep Going" uses the cancel style, which iOS shows as the bold, highlighted choice.
  Alert.alert(`You have ${left} ${left === 1 ? 'set' : 'sets'} left`, 'Finish anyway?', [
    { text: 'Finish', onPress: finish },
    { text: 'Keep Going', style: 'cancel' },
  ]);
}

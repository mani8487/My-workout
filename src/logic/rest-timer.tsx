/**
 * The rest timer.
 *
 * iPhones pause apps in the background, so instead of counting down second by
 * second we save the moment rest ENDS (in the database) and schedule a phone
 * notification for that moment. When you unlock or reopen the app, the time
 * left is simply "end time minus now", so it's always correct, and the
 * notification buzzes you even if the phone is locked.
 */
import * as Notifications from 'expo-notifications';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getSetting, setSetting } from '@/db/settings';

// Show the "rest over" alert with sound even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type TimerState = { endsAt: number; totalMs: number; notificationId: string | null } | null;

type RestTimerValue = {
  /** Milliseconds left, or null when no timer is running. */
  remainingMs: number | null;
  totalMs: number;
  start: (seconds: number) => void;
  addSeconds: (seconds: number) => void;
  skip: () => void;
};

const RestTimerContext = createContext<RestTimerValue | null>(null);

async function scheduleEndAlert(endsAt: number): Promise<string | null> {
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null; // timer still works on screen, just no buzz
    const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set.', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {
    return null;
  }
}

async function cancelAlert(id: string | null) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [timer, setTimer] = useState<TimerState>(null);
  const [now, setNow] = useState(Date.now());

  // Restore a running timer after the app was closed.
  useEffect(() => {
    (async () => {
      const saved = await getSetting(db, 'rest_timer');
      if (!saved) return;
      const t = JSON.parse(saved) as NonNullable<TimerState>;
      if (t.endsAt > Date.now()) setTimer(t);
      else await setSetting(db, 'rest_timer', null);
    })();
  }, [db]);

  const persist = useCallback(
    (t: TimerState) => {
      setTimer(t);
      setSetting(db, 'rest_timer', t ? JSON.stringify(t) : null);
    },
    [db],
  );

  // Redraw a few times a second while running; stop when time is up.
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= timer.endsAt) persist(null);
    }, 250);
    return () => clearInterval(id);
  }, [timer, persist]);

  const start = useCallback(
    async (seconds: number) => {
      await cancelAlert(timer?.notificationId ?? null);
      const endsAt = Date.now() + seconds * 1000;
      const base = { endsAt, totalMs: seconds * 1000, notificationId: null };
      persist(base);
      setNow(Date.now());
      const notificationId = await scheduleEndAlert(endsAt);
      persist({ ...base, notificationId });
    },
    [timer, persist],
  );

  const addSeconds = useCallback(
    async (seconds: number) => {
      if (!timer) return;
      await cancelAlert(timer.notificationId);
      const endsAt = timer.endsAt + seconds * 1000;
      const next = { endsAt, totalMs: timer.totalMs + seconds * 1000, notificationId: null };
      persist(next);
      persist({ ...next, notificationId: await scheduleEndAlert(endsAt) });
    },
    [timer, persist],
  );

  const skip = useCallback(async () => {
    await cancelAlert(timer?.notificationId ?? null);
    persist(null);
  }, [timer, persist]);

  const value = useMemo(
    () => ({
      remainingMs: timer ? Math.max(0, timer.endsAt - now) : null,
      totalMs: timer?.totalMs ?? 0,
      start,
      addSeconds,
      skip,
    }),
    [timer, now, start, addSeconds, skip],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerValue {
  const v = useContext(RestTimerContext);
  if (!v) throw new Error('useRestTimer must be used inside RestTimerProvider');
  return v;
}

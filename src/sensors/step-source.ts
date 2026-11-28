/**
 * Where steps come from. Today: the iPhone's motion chip (CoreMotion, through
 * expo-sensors' Pedometer), which works in Expo Go. Later, an Apple Health
 * source can follow the same StepSource shape and replace `stepSource` below
 * without touching any screen.
 */
import { Pedometer } from 'expo-sensors';

export type StepPermission = 'granted' | 'denied' | 'undetermined';

export interface StepSource {
  /** Whether this phone can count steps at all. */
  isAvailable(): Promise<boolean>;
  /** Current permission, without asking. */
  permission(): Promise<StepPermission>;
  /** Asks (shows the iPhone prompt the first time). */
  requestPermission(): Promise<StepPermission>;
  /** Steps walked between two times. */
  stepsBetween(start: Date, end: Date): Promise<number>;
  /** Live updates: `onSteps` gets the steps counted since watching began. Returns a stop function. */
  watch(onSteps: (sinceStart: number) => void): () => void;
}

const statusOf = (r: { granted: boolean; canAskAgain: boolean; status: string }): StepPermission =>
  r.granted ? 'granted' : r.status === 'undetermined' && r.canAskAgain ? 'undetermined' : 'denied';

/** CoreMotion's pedometer (iPhone). Keeps the last seven days. */
export const pedometerSource: StepSource = {
  isAvailable: () => Pedometer.isAvailableAsync().catch(() => false),
  permission: () => Pedometer.getPermissionsAsync().then(statusOf),
  requestPermission: () => Pedometer.requestPermissionsAsync().then(statusOf),
  stepsBetween: (start, end) => Pedometer.getStepCountAsync(start, end).then((r) => r.steps),
  watch(onSteps) {
    const sub = Pedometer.watchStepCount((r) => onSteps(r.steps));
    return () => sub.remove();
  },
};

/** The source the app uses. Swap in an Apple Health one here later. */
export const stepSource: StepSource = pedometerSource;

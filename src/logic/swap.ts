/** Shared "swap an exercise you've already started" prompt (Active Workout and Workout Progress). */
import { Alert } from 'react-native';

export function confirmSplitSwap(name: string, proceed: () => void) {
  Alert.alert(
    `Swap ${name}?`,
    `The sets you've already ticked stay logged as ${name}. The sets still to do move to the exercise you pick next.`,
    [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Choose exercise', onPress: proceed },
    ],
  );
}

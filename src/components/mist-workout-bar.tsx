/**
 * Mist & Mint bottom bar on Active Workout, made of Liquid Glass:
 *   [rest ring + time]  [+ Set]  [pause / play]
 * The rest timer starts by itself when you tick a set. With no rest running,
 * tapping the ring starts this exercise's rest by hand.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressRing } from '@/components/progress-ring';
import { useRestEndBuzz } from '@/components/rest-timer-bar';
import { useRestTimer } from '@/logic/rest-timer';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

function mmss(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function MistWorkoutBar({ restSeconds, onAddSet }: { restSeconds: number; onAddSet: () => void }) {
  const { colors } = useTheme();
  const { remainingMs, totalMs, paused, start, pause, resume, addSeconds, skip } = useRestTimer();
  useRestEndBuzz(paused ? null : remainingMs);
  const running = remainingMs != null;
  const fraction = running && totalMs > 0 ? remainingMs / totalMs : 0;

  return (
    <GlassTile
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}>
      {/* Rest: ring and time. Tap to start rest; while resting, tap for +30 s. */}
      <PressableScale
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (running) addSeconds(30);
          else start(restSeconds);
        }}
        onLongPress={running ? skip : undefined}
        accessibilityRole="button"
        accessibilityLabel={
          running ? `Rest, ${mmss(remainingMs)} left${paused ? ', paused' : ''}` : `Start rest, ${mmss(restSeconds * 1000)}`
        }
        accessibilityHint={running ? 'Tap to add 30 seconds. Long-press to skip rest.' : undefined}
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}>
        <ProgressRing size={44} stroke={3} fraction={fraction}>
          <SymbolView name="timer" size={16} tintColor={colors.text} />
        </ProgressRing>
        <View style={{ flexShrink: 1 }}>
          <AppText variant="label" numberOfLines={1}>
            {running ? mmss(remainingMs) : 'Rest'}
          </AppText>
          <AppText variant="small" muted numberOfLines={1}>
            {running ? (paused ? 'Paused' : 'Tap +30s · hold to skip') : mmss(restSeconds * 1000)}
          </AppText>
        </View>
      </PressableScale>

      <PressableScale
        onPress={onAddSet}
        accessibilityRole="button"
        accessibilityLabel="Add a set"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height: 44,
          paddingHorizontal: spacing.lg,
          borderRadius: 22,
          backgroundColor: colors.accent,
        }}>
        <SymbolView name="plus" size={15} tintColor={colors.onAccent} />
        <AppText variant="label" color={colors.onAccent}>
          Set
        </AppText>
      </PressableScale>

      <PressableScale
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (paused) resume();
          else pause();
        }}
        disabled={!running}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Resume rest timer' : 'Pause rest timer'}
        accessibilityState={{ disabled: !running }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.cardAlt,
          opacity: running ? 1 : 0.45,
        }}>
        <SymbolView name={paused ? 'play.fill' : 'pause.fill'} size={16} tintColor={colors.text} />
      </PressableScale>
    </GlassTile>
  );
}

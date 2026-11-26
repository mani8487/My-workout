/**
 * Mist & Mint "Today's Workout" card on Home: a small label, the workout name,
 * one line of detail and a pill button (with an optional quieter one beside it).
 */
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

type Props = {
  eyebrow: string;
  title: string;
  detail?: string;
  /** The main button; leave out for days you can't start yet. */
  button?: { title: string; onPress: () => void };
  /** A quieter outlined pill beside (or instead of) the main button, e.g. "Change". */
  secondary?: { title: string; onPress: () => void; label?: string };
  /** Tapping the card body (e.g. open the preview). */
  onPress?: () => void;
  /** VoiceOver hint for tapping the card body. */
  hint?: string;
};

export function MistDayCard({ eyebrow, title, detail, button, secondary, onPress, hint = 'Shows the exercises' }: Props) {
  const { colors } = useTheme();
  return (
    <GlassTile style={{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress}
        pressedScale={0.98}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${eyebrow}. ${title}${detail ? `. ${detail}` : ''}`}
        accessibilityHint={onPress ? hint : undefined}
        style={{ gap: 2 }}>
        <AppText variant="small" muted>
          {eyebrow}
        </AppText>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="small" muted>
            {detail}
          </AppText>
        ) : null}
      </PressableScale>
      {(button || secondary) && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {button && (
            <PressableScale
              onPress={button.onPress}
              accessibilityRole="button"
              accessibilityLabel={button.title}
              style={{
                flex: 1,
                minHeight: MIN_TAP,
                borderRadius: 999,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
              }}>
              <AppText variant="label" color={colors.onAccent}>
                {button.title}
              </AppText>
            </PressableScale>
          )}
          {secondary && (
            <PressableScale
              onPress={secondary.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondary.label ?? secondary.title}
              style={{
                flex: button ? 0 : 1,
                minHeight: MIN_TAP,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
              }}>
              <AppText variant="label">{secondary.title}</AppText>
            </PressableScale>
          )}
        </View>
      )}
    </GlassTile>
  );
}

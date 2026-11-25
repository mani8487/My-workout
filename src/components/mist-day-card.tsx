/**
 * Mist & Mint "Today's Workout" card on Home: a small label, the workout name,
 * one line of detail and a full-width pill button.
 */
import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type Props = {
  eyebrow: string;
  title: string;
  detail?: string;
  /** The main button; leave out for days you can't start yet. */
  button?: { title: string; onPress: () => void };
  /** Tapping the card body (e.g. open the preview). */
  onPress?: () => void;
};

export function MistDayCard({ eyebrow, title, detail, button, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <GlassTile style={{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress}
        pressedScale={0.98}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${eyebrow}. ${title}${detail ? `. ${detail}` : ''}`}
        accessibilityHint={onPress ? 'Shows the exercises' : undefined}
        style={{ gap: 2 }}>
        <AppText variant="small" muted>
          {eyebrow}
        </AppText>
        <AppText variant="heading" numberOfLines={2}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="small" muted>
            {detail}
          </AppText>
        ) : null}
      </PressableScale>
      {button && (
        <PressableScale
          onPress={button.onPress}
          accessibilityRole="button"
          accessibilityLabel={button.title}
          style={{
            minHeight: 50,
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
    </GlassTile>
  );
}

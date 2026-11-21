/**
 * Ember theme's "today" card on Home, in the style of Apple Fitness: a quiet
 * dark row with a small orange label, the workout name, one line of detail and
 * a round orange play button. Colour is spent only on what you can act on.
 */
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type Props = {
  eyebrow: string;
  title: string;
  detail?: string;
  /** Tapping the card (e.g. open the preview). */
  onPress?: () => void;
  /** The round play button; leave out for days you can't start yet. */
  onPlay?: () => void;
  playLabel?: string;
};

export function CompactDayCard({ eyebrow, title, detail, onPress, onPlay, playLabel = 'Start workout' }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow}. ${title}${detail ? `. ${detail}` : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md + 2,
        paddingLeft: spacing.lg,
        paddingRight: spacing.md + 2,
        borderRadius: radius.lg,
        backgroundColor: colors.card,
      }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="small" color={colors.accent} style={{ letterSpacing: 0.6 }}>
          {eyebrow.toUpperCase()}
        </AppText>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="small" muted numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {onPlay && (
        <PressableScale
          onPress={onPlay}
          accessibilityRole="button"
          accessibilityLabel={playLabel}
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <SymbolView name="play.fill" size={22} tintColor={colors.onAccent} />
        </PressableScale>
      )}
    </PressableScale>
  );
}

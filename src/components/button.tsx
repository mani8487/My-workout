import type { ComponentProps } from 'react';
import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

type Props = Omit<ComponentProps<typeof PressableScale>, 'children'> & {
  title: string;
  /**
   * primary   = filled accent colour (the main action, e.g. Start Workout)
   * secondary = quiet outlined button (e.g. Change Workout, Finish Workout)
   */
  kind?: 'primary' | 'secondary';
  size?: 'large' | 'normal';
};

export function Button({ title, kind = 'primary', size = 'normal', style, ...rest }: Props) {
  const { colors } = useTheme();
  const isPrimary = kind === 'primary';

  return (
    <PressableScale
      accessibilityRole="button"
      style={[
        {
          // Primary = solid brass. Secondary = quiet outline.
          backgroundColor: isPrimary ? colors.accent : 'transparent',
          borderColor: isPrimary ? colors.accent : colors.inputBorder,
          borderWidth: 1,
          borderRadius: radius.md,
          minHeight: size === 'large' ? 56 : MIN_TAP,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...rest}>
      <AppText
        variant={size === 'large' ? 'heading' : 'label'}
        color={isPrimary ? colors.onAccent : colors.text}>
        {title}
      </AppText>
    </PressableScale>
  );
}

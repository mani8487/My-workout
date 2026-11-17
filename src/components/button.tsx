import { Pressable, type PressableProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

type Props = Omit<PressableProps, 'children'> & {
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
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        {
          backgroundColor: isPrimary ? colors.accent : colors.card,
          borderColor: isPrimary ? colors.accent : colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingVertical: size === 'large' ? spacing.lg + 2 : spacing.md,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          opacity: state.pressed ? 0.75 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <AppText
        variant={size === 'large' ? 'heading' : 'label'}
        color={isPrimary ? colors.onAccent : colors.text}>
        {title}
      </AppText>
    </Pressable>
  );
}

import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { typography, type TextVariant } from '@/theme/typography';

type Props = TextProps & {
  variant?: TextVariant;
  /** Use the quieter "muted" text colour. */
  muted?: boolean;
  /** Override with any colour role value, e.g. colors.accent. */
  color?: string;
};

/** All text in the app goes through this, so sizes and colours stay consistent. */
export function AppText({ variant = 'body', muted, color, style, ...rest }: Props) {
  const { colors } = useTheme();
  const textColor = color ?? (muted ? colors.textMuted : colors.text);
  return <Text style={[typography[variant], { color: textColor }, style]} {...rest} />;
}

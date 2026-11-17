import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { fontFor, typography, type TextVariant } from '@/theme/typography';

type Props = TextProps & {
  variant?: TextVariant;
  /** Use the quieter "muted" text colour. */
  muted?: boolean;
  /** Override with any colour role value, e.g. colors.accent. */
  color?: string;
};

/** All text in the app goes through this, so sizes, colours and the Inter font stay consistent. */
export function AppText({ variant = 'body', muted, color, style, ...rest }: Props) {
  const { colors } = useTheme();
  const textColor = color ?? (muted ? colors.textMuted : colors.text);
  const flat = StyleSheet.flatten(style) ?? {};
  // A screen asking for e.g. fontWeight '600' gets the SemiBold Inter file instead.
  const weightFix = flat.fontWeight ? { fontFamily: fontFor(flat.fontWeight), fontWeight: undefined } : null;
  return <Text style={[typography[variant], { color: textColor }, style, weightFix]} {...rest} />;
}

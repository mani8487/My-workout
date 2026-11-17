/** Grouped list building blocks: a titled section and tappable rows. */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const items = Children.toArray(children);
  return (
    <View style={{ gap: spacing.sm }}>
      {title && (
        <AppText variant="small" muted style={{ fontWeight: '600' }}>
          {title.toUpperCase()}
        </AppText>
      )}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}>
        {items.map((child, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  right,
  chevron = !!onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: SFSymbol;
  onPress?: () => void;
  right?: ReactNode;
  chevron?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: pressed ? colors.cardAlt : 'transparent',
      })}>
      {icon && <SymbolView name={icon} size={22} tintColor={colors.accent} />}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="small" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron && <SymbolView name="chevron.right" size={14} tintColor={colors.textMuted} />}
    </Pressable>
  );
}

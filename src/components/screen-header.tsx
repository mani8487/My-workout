/** Header used by workout screens: back arrow, centred title, optional right button. */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type Props = {
  title: string;
  onBack?: () => void;
  backIcon?: SFSymbol;
  backLabel?: string;
  right?: { icon: SFSymbol; label: string; onPress: () => void };
};

export function ScreenHeader({ title, onBack, backIcon = 'chevron.left', backLabel = 'Back', right }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, height: 48 }}>
      <Pressable
        onPress={onBack}
        disabled={!onBack}
        hitSlop={10}
        accessibilityLabel={backLabel}
        style={{ width: 44, alignItems: 'center' }}>
        {onBack && <SymbolView name={backIcon} size={22} tintColor={colors.accent} />}
      </Pressable>
      <AppText variant="heading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </AppText>
      <Pressable
        onPress={right?.onPress}
        disabled={!right}
        hitSlop={10}
        accessibilityLabel={right?.label}
        style={{ width: 44, alignItems: 'center' }}>
        {right && <SymbolView name={right.icon} size={22} tintColor={colors.accent} />}
      </Pressable>
    </View>
  );
}

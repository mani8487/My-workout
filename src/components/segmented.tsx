/** A row of options where exactly one is selected (like iOS's segmented control). */
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable accessibilityRole="button"
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              paddingVertical: spacing.sm - 2,
              borderRadius: radius.sm - 2,
              alignItems: 'center',
              backgroundColor: on ? colors.card : 'transparent',
            }}>
            <AppText variant="small" color={on ? colors.text : colors.textMuted} style={{ fontWeight: '600' }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

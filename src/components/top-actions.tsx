/**
 * Mist & Mint top row, right-aligned and in the same order on every screen:
 * calendar, water droplet (live gauge), settings gear.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { WaterGauge } from '@/components/water-gauge';
import { useTheme } from '@/theme/theme-context';

type Props = {
  /** Opens the week schedule; defaults to the current week. */
  onCalendar?: () => void;
};

export function TopActions({ onCalendar }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <IconButton
        icon="calendar"
        label="Week schedule"
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (onCalendar) onCalendar();
          else router.push('/week');
        }}
      />
      {/* Water tracking arrives in step 6 (hydration pop-up); the gauge is live already. */}
      <WaterGauge
        ml={0}
        goal={2000}
        onPress={() => Alert.alert('Water', 'Water tracking is coming in the next update.')}
      />
      <IconButton icon="gearshape" label="Settings" onPress={() => router.push('/settings')} />
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={icon} size={22} tintColor={colors.text} />
    </PressableScale>
  );
}

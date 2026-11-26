/**
 * Mist & Mint top row, right-aligned and in the same order on every screen:
 * calendar, water droplet (live gauge), settings gear.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { AccessibilityInfo, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { WaterGauge } from '@/components/water-gauge';
import { addWater, useWaterToday } from '@/db/water';
import { fmtMl } from '@/logic/hydration';
import { useTheme } from '@/theme/theme-context';

type Props = {
  /** Opens the week schedule; defaults to the current week. */
  onCalendar?: () => void;
  /** Living Home shows water as a chip below instead, so it hides the droplet here. */
  showWater?: boolean;
};

export function TopActions({ onCalendar, showWater = true }: Props) {
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
      {showWater && <WaterButton />}
      <IconButton icon="gearshape" label="Settings" onPress={() => router.push('/settings')} />
    </View>
  );
}

/** The droplet gauge. Tap: the hydration pop-up. Long-press: log your last amount straight away. */
function WaterButton() {
  const db = useSQLiteContext();
  const water = useWaterToday();
  return (
    <WaterGauge
      ml={water?.ml ?? 0}
      goal={water?.goal ?? 2000}
      onPress={() => router.push('/water')}
      onLongPress={async () => {
        const amount = water?.lastMl ?? 250;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await addWater(db, amount);
        AccessibilityInfo.announceForAccessibility('Added ' + fmtMl(amount) + ' millilitres');
      }}
    />
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

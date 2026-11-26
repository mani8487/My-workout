/**
 * Living Home's slim water chip: droplet, "1.2 / 2.4 L" and a thin bar that
 * springs to the new level. Tap for the hydration sheet; long-press to log
 * your usual glass straight away.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { PressableScale } from '@/components/pressable-scale';
import { addWater, type WaterToday } from '@/db/water';
import { fmtMl } from '@/logic/hydration';
import { ratio } from '@/logic/scene-state';
import { SPRING } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

const litres = (ml: number) => (ml / 1000).toFixed(1).replace(/\.0$/, '');

/** `water` is passed in by Home, which holds it steady while a sheet covers the screen. */
export function WaterChip({ water }: { water: WaterToday }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { ml, goal } = water;
  const level = useSharedValue(ratio(ml, goal));
  useEffect(() => {
    level.set(withSpring(ratio(ml, goal), SPRING.gentle));
  }, [level, ml, goal]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: level.get() }] }));

  return (
    <PressableScale
      onPress={() => router.push('/water')}
      onLongPress={async () => {
        const amount = water.lastMl;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await addWater(db, amount);
        AccessibilityInfo.announceForAccessibility(`Added ${fmtMl(amount)} millilitres`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Water: ${litres(ml)} of ${litres(goal)} litres`}
      accessibilityHint="Opens hydration. Long-press to add your usual glass."
      pressedScale={0.98}>
      <GlassTile style={{ borderRadius: radius.md, minHeight: MIN_TAP, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <SymbolView name="drop.fill" size={16} tintColor={colors.water} />
        <AppText variant="small">
          {litres(ml)} / {litres(goal)} L
        </AppText>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.accentSoft, overflow: 'hidden' }}>
          <Animated.View style={[{ height: 4, width: '100%', borderRadius: 2, backgroundColor: colors.water, transformOrigin: 'left' }, bar]} />
        </View>
      </GlassTile>
    </PressableScale>
  );
}

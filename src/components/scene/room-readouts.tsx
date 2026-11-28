/**
 * The small readouts over Milo's head: today's water ("1.2 / 2.4 L", while
 * there's water in him) and, with Milo Steps on, today's steps ("4,230", with
 * a badge once a milestone is reached). Tap one for its pop-up. They sit in
 * the room's coordinates, measured from the bottom of the room (the room is
 * laid out at the bottom of its space), side by side and centred above Milo.
 */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { MILO_ART } from '@/components/mascot/palette';
import { badgeLabel, fmtSteps } from '@/logic/milo-steps';
import { DURATION } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

import { ROOM } from './room-parts';

const litres = (ml: number) => (ml / 1000).toFixed(1).replace(/\.0$/, '');
/** Centre of the readouts in room units: above Milo's ears. */
const AT = { x: 180, y: 38 };
/** Room for both pills side by side. */
const BOX_W = 240;

type Props = {
  water?: { ml: number; goal: number; onPress?: () => void };
  steps?: { count: number; badge: number | null; onPress?: () => void };
  k: number;
  /** The room's own fade and lift (leaving for a workout), so the readouts go with it. */
  away: SharedValue<number>;
  fade: SharedValue<number>;
  lift: number;
};

function Pill({ icon, tint, text, label, hint, badge, onPress }: { icon: SFSymbol; tint: string; text: string; label: string; hint: string; badge?: string; onPress?: () => void }) {
  const { colors, isDark } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(DURATION.transition.short)} exiting={FadeOut.duration(DURATION.micro.base)}>
      <PressableScale
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={{ minHeight: MIN_TAP, justifyContent: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(241,244,248,0.12)' : 'rgba(255,255,255,0.85)',
            backgroundColor: isDark ? 'rgba(34,45,59,0.72)' : 'rgba(255,255,255,0.72)',
          }}>
          <SymbolView name={icon} size={11} tintColor={tint} />
          <AppText variant="small" color={colors.text} maxFontSizeMultiplier={1.3}>
            {text}
          </AppText>
          {badge && (
            <Animated.View entering={FadeIn.duration(DURATION.transition.short)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <SymbolView name="medal.fill" size={10} tintColor={colors.accent} />
              <AppText variant="small" muted maxFontSizeMultiplier={1.3}>
                {badge}
              </AppText>
            </Animated.View>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export function RoomReadouts({ water, steps, k, away, fade, lift }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - away.get()),
    transform: [{ translateY: -away.get() * lift * k }],
  }));
  const left = (width - ROOM.w * k) / 2 + (AT.x - BOX_W / 2) * k;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        { position: 'absolute', left, width: BOX_W * k, bottom: (ROOM.h - AT.y) * k - MIN_TAP / 2, flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
        style,
      ]}>
      {steps && (
        <Pill
          icon="figure.walk"
          tint={colors.accent}
          text={fmtSteps(steps.count)}
          badge={steps.badge ? badgeLabel(steps.badge) : undefined}
          label={`Steps today: ${fmtSteps(steps.count)}${steps.badge ? `, ${badgeLabel(steps.badge)} badge` : ''}`}
          hint="Opens steps"
          onPress={steps.onPress}
        />
      )}
      {water && (
        <Pill
          icon="drop.fill"
          tint={MILO_ART.liquid}
          text={`${litres(water.ml)} / ${litres(water.goal)} L`}
          label={`Water: ${litres(water.ml)} of ${litres(water.goal)} litres`}
          hint="Opens water"
          onPress={water.onPress}
        />
      )}
    </Animated.View>
  );
}

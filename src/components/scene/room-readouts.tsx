/**
 * The small readouts over Milo's head: today's water ("1.2 / 2.4 L", while
 * there's water in him) and, with Milo Steps on, today's steps ("4,230", with
 * a badge once a milestone is reached). Tap one for its pop-up. They sit in
 * the room's coordinates, measured from the bottom of the room (the room is
 * laid out at the bottom of its space). The water pill keeps its own spot,
 * centred above Milo; the steps pill sits just to its left (centred there
 * itself when there's no water yet) and glides when the water pill comes or goes.
 */
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { MILO_ART } from '@/components/mascot/palette';
import { badgeLabel, fmtSteps } from '@/logic/milo-steps';
import { DURATION, EASE } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

import { ROOM } from './room-parts';

const litres = (ml: number) => (ml / 1000).toFixed(1).replace(/\.0$/, '');
/** Centre of the readouts in room units: above Milo's ears. */
const AT = { x: 180, y: 38 };
/** The water pill's box, centred on AT. */
const BOX_W = 120;

type Props = {
  water?: { ml: number; goal: number; onPress?: () => void };
  steps?: { count: number; badge: number | null; onPress?: () => void };
  k: number;
  /** The room's own fade and lift (leaving for a workout), so the readouts go with it. */
  away: SharedValue<number>;
  fade: SharedValue<number>;
  lift: number;
};

type PillProps = { icon: SFSymbol; tint: string; text: string; label: string; hint: string; badge?: string; onPress?: () => void; onWidth: (w: number) => void };

function Pill({ icon, tint, text, label, hint, badge, onPress, onWidth }: PillProps) {
  const { colors, isDark } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.transition.short)}
      exiting={FadeOut.duration(DURATION.micro.base)}
      onLayout={(e) => onWidth(e.nativeEvent.layout.width)}>
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
  const [waterW, setWaterW] = useState(0);
  const [stepsW, setStepsW] = useState(0);
  const style = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - away.get()),
    transform: [{ translateY: -away.get() * lift * k }],
  }));
  const centre = (width - ROOM.w * k) / 2 + AT.x * k;
  const stepsLeft = water ? centre - waterW / 2 - spacing.xs - stepsW : centre - stepsW / 2;
  // The steps pill's spot: placed directly once both pills are measured (hidden until then), and
  // gliding after that when the water pill comes or goes. -1: not placed yet.
  const placed = !!steps && stepsW > 0 && (!water || waterW > 0);
  const stepsX = useSharedValue(-1);
  useEffect(() => {
    if (!placed) stepsX.set(-1);
    else stepsX.set(stepsX.get() < 0 ? stepsLeft : withTiming(stepsLeft, { duration: DURATION.transition.short, easing: EASE.inOut }));
  }, [placed, stepsLeft, stepsX]);
  const stepsStyle = useAnimatedStyle(() => ({ left: Math.max(0, stepsX.get()), opacity: stepsX.get() < 0 ? 0 : 1 }));
  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0, bottom: (ROOM.h - AT.y) * k - MIN_TAP / 2, height: MIN_TAP }, style]}>
      {steps && (
        <Animated.View style={[{ position: 'absolute', bottom: 0 }, stepsStyle]}>
          <Pill
          icon="figure.walk"
          tint={colors.accent}
          text={fmtSteps(steps.count)}
          badge={steps.badge ? badgeLabel(steps.badge) : undefined}
          label={`Steps today: ${fmtSteps(steps.count)}${steps.badge ? `, ${badgeLabel(steps.badge)} badge` : ''}`}
          hint="Opens steps"
          onPress={steps.onPress}
          onWidth={setStepsW}
          />
        </Animated.View>
      )}
      {water && (
        <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: centre - (BOX_W / 2) * k, width: BOX_W * k, alignItems: 'center' }}>
          <Pill
            icon="drop.fill"
            tint={MILO_ART.liquid}
            text={`${litres(water.ml)} / ${litres(water.goal)} L`}
            label={`Water: ${litres(water.ml)} of ${litres(water.goal)} litres`}
            hint="Opens water"
            onPress={water.onPress}
            onWidth={setWaterW}
          />
        </View>
      )}
    </Animated.View>
  );
}

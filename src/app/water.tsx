/**
 * Hydration pop-up, opened from the droplet in the top row.
 * Milo drinks while you log: +250 / +500 / Custom, Undo, a pace line, and
 * Details on how the goal is worked out. (Long-press the droplet to log your
 * last amount without opening this.)
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { Milo } from '@/components/mascot';
import { PressableScale } from '@/components/pressable-scale';
import { addWater, undoLastWater, useWaterToday } from '@/db/water';
import {
  fmtMl,
  HYDRATION_NOTE,
  MAX_GOAL_ML,
  MIN_GOAL_ML,
  ML_PER_EXERCISE_HOUR,
  ML_PER_KG,
  QUICK_ML,
  waterPace,
} from '@/logic/hydration';
import { SPRING_SETTLE } from '@/theme/motion';
import { useTheme } from '@/theme/theme-context';
import { MAX_FONT_SCALE, spacing, typography } from '@/theme/typography';

export default function WaterSheet() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const water = useWaterToday();
  const [custom, setCustom] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  const ml = water?.ml ?? 0;
  const goal = water?.goal ?? 2000;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withSpring(Math.min(1, goal > 0 ? ml / goal : 0), SPRING_SETTLE);
  }, [ml, goal, fill]);
  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  async function log(amount: number) {
    if (busy || !(amount > 0)) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await addWater(db, amount);
    AccessibilityInfo.announceForAccessibility(`Added ${fmtMl(amount)} millilitres`);
    setBusy(false);
  }

  async function undo() {
    const removed = await undoLastWater(db);
    if (removed != null) {
      Haptics.selectionAsync().catch(() => {});
      AccessibilityInfo.announceForAccessibility(`Removed ${fmtMl(removed)} millilitres`);
    }
  }

  // Shown on the sheet; `new Date()` is fine here, the line refreshes on every log.
  const pace = waterPace(ml, goal, new Date());
  const customMl = Math.round(Number((custom ?? '').replace(',', '.')));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          Water
        </AppText>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
          <AppText variant="label" color={colors.accent}>
            Done
          </AppText>
        </Pressable>
      </View>

      <Milo state="drinking" size={170} style={{ alignSelf: 'center', marginVertical: -spacing.md }} />

      <View accessible accessibilityLabel={`${fmtMl(ml)} of ${fmtMl(goal)} millilitres today`} style={{ alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="title" style={{ fontSize: 36 }} maxFontSizeMultiplier={1.4}>
          {fmtMl(ml)} <AppText variant="heading" muted>/ {fmtMl(goal)} ml</AppText>
        </AppText>
        <View style={{ alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', borderRadius: 5, backgroundColor: colors.water }, barStyle]} />
        </View>
        <AppText variant="small" muted accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
          {pace.line}
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {QUICK_ML.map((a) => (
          <AmountButton key={a} label={`+${a}`} a11y={`Add ${a} millilitres`} onPress={() => log(a)} />
        ))}
        <AmountButton label="Custom" a11y="Add a custom amount" onPress={() => setCustom((c) => (c == null ? '' : null))} />
      </View>

      {custom != null && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <GlassTile style={{ borderRadius: 20, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              keyboardType="number-pad"
              autoFocus
              placeholder="e.g. 330"
              placeholderTextColor={colors.textMuted}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              accessibilityLabel="Custom amount in millilitres"
              style={[typography.body, { flex: 1, color: colors.text, minHeight: 44 }]}
            />
            <AppText variant="label" muted>
              ml
            </AppText>
            <PressableScale
              onPress={async () => {
                if (customMl > 0 && customMl <= 2000) {
                  await log(customMl);
                  setCustom(null);
                }
              }}
              disabled={!(customMl > 0 && customMl <= 2000)}
              accessibilityRole="button"
              accessibilityLabel="Add custom amount"
              style={{ minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', opacity: customMl > 0 && customMl <= 2000 ? 1 : 0.4 }}>
              <AppText variant="label" color={colors.onAccent}>
                Add
              </AppText>
            </PressableScale>
          </GlassTile>
        </Animated.View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable
          onPress={undo}
          disabled={ml <= 0}
          accessibilityRole="button"
          accessibilityLabel="Undo last glass"
          accessibilityState={{ disabled: ml <= 0 }}
          style={{ minHeight: 44, justifyContent: 'center', opacity: ml > 0 ? 1 : 0.4 }}>
          <AppText variant="label" color={colors.accent}>
            Undo
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setDetails((d) => !d)}
          accessibilityRole="button"
          accessibilityState={{ expanded: details }}
          accessibilityLabel="Details on your water goal"
          style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="label" color={colors.accent}>
            {details ? 'Hide details' : 'Details'}
          </AppText>
        </Pressable>
      </View>

      {details && water && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <GlassTile style={{ borderRadius: 20, padding: spacing.lg, gap: spacing.sm }}>
            <AppText variant="label">How your goal is worked out</AppText>
            <AppText variant="small">
              {water.weightKg
                ? `Body weight ${water.weightKg} kg × ${ML_PER_KG} ml = ${fmtMl(water.weightKg * ML_PER_KG)} ml`
                : 'No body weight set, so we start from 2,000 ml. Add it in Settings for a personal goal.'}
            </AppText>
            <AppText variant="small">
              Exercise today {water.exerciseMin} min → +{fmtMl((water.exerciseMin / 60) * ML_PER_EXERCISE_HOUR)} ml ({ML_PER_EXERCISE_HOUR} ml per hour)
            </AppText>
            <AppText variant="small" muted>
              Rounded to the nearest 50 ml and kept between {fmtMl(MIN_GOAL_ML)} and {fmtMl(MAX_GOAL_ML)} ml. Pace assumes an even day from 7:00 to 21:00.
            </AppText>
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
              <AppText variant="label" color={colors.accent}>
                {water.weightKg ? 'Change body weight' : 'Set body weight'}
              </AppText>
            </Pressable>
          </GlassTile>
        </Animated.View>
      )}

      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {HYDRATION_NOTE}
      </AppText>
    </ScrollView>
  );
}

function AmountButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={{ flex: 1 }}>
      <GlassTile style={{ minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }}>
        <AppText variant="label" numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </AppText>
      </GlassTile>
    </PressableScale>
  );
}

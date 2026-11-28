/**
 * Steps pop-up, opened from the steps readout above Milo on Home.
 * Today's steps, how long Milo trotted and ran with you, his energy, the
 * milestones, and the day's recap card to share. If steps can't be read
 * (no permission, or no motion sensor), it says so kindly and how to fix it.
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, Share, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { Milo } from '@/components/mascot';
import { PressableScale } from '@/components/pressable-scale';
import { useStepsToday } from '@/db/steps';
import { MILESTONES, badgeLabel, fmtSteps, recapLine, summarize } from '@/logic/milo-steps';
import { SPRING, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, spacing } from '@/theme/typography';

/** From this hour the recap reads as the day's last word. */
const RECAP_HOUR = 20;

export default function StepsSheet() {
  const { colors } = useTheme();
  const steps = useStepsToday();
  const reduced = useReducedMotion();
  const ok = steps?.status === 'ok';
  const count = ok ? steps.steps : 0;
  const { walkMin, runMin } = summarize(ok ? steps.slices : []);
  const energy = ok ? steps.energy : 0;

  // The energy bar fills with a spring (a static value with Reduce Motion).
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(reduced ? energy / 100 : withSpring(energy / 100, SPRING.soft));
  }, [energy, reduced, fill]);
  const barStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  const evening = new Date().getHours() >= RECAP_HOUR;
  const share = () => Share.share({ message: `${recapLine(count)} 🐾` }).catch(() => {});

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          Steps
        </AppText>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={{ minHeight: MIN_TAP, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
          <AppText variant="label" color={colors.accent}>
            Done
          </AppText>
        </Pressable>
      </View>

      <Milo state="sitting" size={150} energy={energy / 100} style={{ alignSelf: 'center', marginVertical: -spacing.md }} />

      {steps && !ok ? (
        <GlassTile style={{ borderRadius: 20, padding: spacing.lg, gap: spacing.sm }}>
          <AppText variant="label">
            {steps.status === 'denied' ? 'Milo can’t see your steps yet' : steps.status === 'unavailable' ? 'No step counter on this phone' : 'Milo moves with me is off'}
          </AppText>
          <AppText variant="small" muted>
            {steps.status === 'denied'
              ? 'Allow Motion & Fitness for this app in your iPhone’s Settings, and Milo will walk along with you.'
              : steps.status === 'unavailable'
                ? 'This phone can’t count steps, so Milo stays on his couch. Everything else works as usual.'
                : 'Turn it on in Settings to have Milo trot along with your steps.'}
          </AppText>
          {steps.status !== 'unavailable' && (
            <Pressable
              onPress={() => (steps.status === 'denied' ? Linking.openSettings() : router.push('/settings'))}
              accessibilityRole="link"
              style={{ minHeight: MIN_TAP, justifyContent: 'center' }}>
              <AppText variant="label" color={colors.accent}>
                {steps.status === 'denied' ? 'Open iPhone Settings' : 'Open Settings'}
              </AppText>
            </Pressable>
          )}
        </GlassTile>
      ) : (
        <>
          <View accessible accessibilityLabel={`${fmtSteps(count)} steps today`} style={{ alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="title" style={{ fontSize: 36 }} maxFontSizeMultiplier={1.4}>
              {fmtSteps(count)} <AppText variant="heading" muted>steps</AppText>
            </AppText>
            <AppText variant="small" muted style={{ textAlign: 'center' }}>
              {walkMin || runMin
                ? `Milo trotted ${walkMin} min${runMin ? ` and ran ${runMin} min` : ''} with you today.`
                : 'Milo is ready when you are. He trots along as you walk.'}
            </AppText>
          </View>

          <View accessible accessibilityLabel={`Milo's energy: ${energy} out of 100`} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="label">Milo’s energy</AppText>
              <AppText variant="label" muted>
                {energy} / 100
              </AppText>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
              <Animated.View style={[{ height: '100%', borderRadius: 5, backgroundColor: colors.accent }, barStyle]} />
            </View>
            <AppText variant="small" muted>
              Builds with your steps and active minutes, and keeps what it gains all day. The livelier he feels, the perkier his ears and tail.
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {MILESTONES.map((m) => {
              const got = count >= m;
              return (
                <GlassTile
                  key={m}
                  accessible
                  accessibilityLabel={`${badgeLabel(m)} steps: ${got ? 'reached' : 'not yet'}`}
                  style={{ flex: 1, minHeight: 56, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, opacity: got ? 1 : 0.5 }}>
                  <SymbolView name={got ? 'medal.fill' : 'medal'} size={14} tintColor={got ? colors.accent : colors.textMuted} />
                  <AppText variant="label">{badgeLabel(m)}</AppText>
                </GlassTile>
              );
            })}
          </View>

          <GlassTile style={{ borderRadius: 20, padding: spacing.lg, gap: spacing.sm }}>
            <AppText variant="small" muted>
              {evening ? 'Today’s recap' : 'So far today'}
            </AppText>
            <AppText variant="heading">{recapLine(count)}</AppText>
            <PressableScale
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel="Share today's recap"
              style={{ alignSelf: 'flex-start', minHeight: MIN_TAP, paddingHorizontal: spacing.lg, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <SymbolView name="square.and.arrow.up" size={14} tintColor={colors.onAccent} />
              <AppText variant="label" color={colors.onAccent}>
                Share
              </AppText>
            </PressableScale>
          </GlassTile>
        </>
      )}

      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        Steps come from your iPhone’s motion sensor and stay on this phone.
      </AppText>
    </ScrollView>
  );
}

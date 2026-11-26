/**
 * Scene Lab: a tester's bench for judging motion on the phone. Reached from
 * More → Scene Lab. Forces Mist light or dark and Reduce Motion on or off for
 * everything on this screen, and plays each Milo state on demand.
 *
 * Kept in release builds on purpose: it is used through published updates.
 * Phase 0 covers Milo; later phases add the room, progress and cameos here.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Milo, useMiloState, type MiloState } from '@/components/mascot';
import { Page } from '@/components/page';
import { PressableScale } from '@/components/pressable-scale';
import { ReducedMotionOverride, useReducedMotion } from '@/motion';
import { MistPreview, useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

const STATES: { state: MiloState; label: string }[] = [
  { state: 'sleeping', label: 'Sleeping' },
  { state: 'waking', label: 'Waking' },
  { state: 'sitting', label: 'Sitting' },
  { state: 'reacting', label: 'Paw lift' },
  { state: 'celebrating', label: 'Celebrate' },
  { state: 'drinking', label: 'Drinking' },
];

type Motion = 'system' | 'on' | 'off';

function Chip({ label, on, onPress, hint }: { label: string; on: boolean; onPress: () => void; hint?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: MIN_TAP,
        minWidth: MIN_TAP,
        paddingHorizontal: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: on ? colors.accent : colors.card,
      }}>
      <AppText variant="label" color={on ? colors.onAccent : colors.text}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="small" muted>
        {title}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function LabBody({ dark, setDark, motion, setMotion }: { dark: boolean; setDark: (d: boolean) => void; motion: Motion; setMotion: (m: Motion) => void }) {
  const milo = useMiloState('sleeping');
  const reduced = useReducedMotion();
  const label = STATES.find((x) => x.state === milo.state)?.label ?? milo.state;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Milo: ${label}`);
  }, [label]);

  const choose = (state: MiloState) => {
    // Waking only happens from sleep; the button replays it from lying down.
    if (state === 'waking') {
      if (milo.state === 'sleeping') milo.wake();
      else milo.sleep();
    } else milo.set(state);
  };

  return (
    <Page title="Scene Lab">
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
          <AppText variant="label" muted>
            Now: {label}
            {reduced ? ' · Reduce Motion' : ''}
          </AppText>
          <Milo {...milo.props} size={260} />
        </View>

        <Row title="Milo">
          {STATES.map(({ state, label }) => (
            <Chip
              key={state}
              label={label}
              on={milo.state === state}
              onPress={() => choose(state)}
              hint={state === 'waking' && milo.state !== 'sleeping' ? 'Puts Milo to sleep first; tap again to wake him' : undefined}
            />
          ))}
        </Row>

        <Row title="Appearance">
          <Chip label="Light" on={!dark} onPress={() => setDark(false)} />
          <Chip label="Dark" on={dark} onPress={() => setDark(true)} />
        </Row>

        <Row title="Reduce Motion">
          <Chip label="iPhone setting" on={motion === 'system'} onPress={() => setMotion('system')} />
          <Chip label="Off" on={motion === 'off'} onPress={() => setMotion('off')} />
          <Chip label="On" on={motion === 'on'} onPress={() => setMotion('on')} />
        </Row>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="small" muted>
            Small size
          </AppText>
          <Milo {...milo.props} size={100} />
        </View>

        <AppText variant="small" muted>
          Tap Milo to pet him. Waking: tap Waking once to lay him down, then again to watch him wake.
        </AppText>
      </View>
    </Page>
  );
}

export default function SceneLabScreen() {
  const { isDark } = useTheme();
  const [dark, setDark] = useState(isDark);
  const [motion, setMotion] = useState<Motion>('system');

  return (
    <MistPreview dark={dark}>
      <ReducedMotionOverride value={motion === 'system' ? null : motion === 'on'}>
        <LabBody dark={dark} setDark={setDark} motion={motion} setMotion={setMotion} />
      </ReducedMotionOverride>
    </MistPreview>
  );
}

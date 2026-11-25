/**
 * TEMPORARY: preview every Milo state on a light and a dark Mist & Mint
 * stage. Reached from More → Milo test. Remove once the redesign is done.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Milo, useMiloState, type MiloState } from '@/components/mascot';
import { Page } from '@/components/page';
import { PressableScale } from '@/components/pressable-scale';
import { Segmented } from '@/components/segmented';
import { radius, spacing } from '@/theme/typography';

const STAGES = {
  light: { bg: '#EDF0F4', text: '#28384A', muted: '#616E80', chip: '#FFFFFF' },
  dark: { bg: '#151C26', text: '#F1F4F8', muted: '#AAB6C6', chip: '#222D3B' },
};
const MINT = '#A8DCC6';
const NAVY = '#28384A';

const STATES: { state: MiloState; label: string }[] = [
  { state: 'sleeping', label: 'Sleeping' },
  { state: 'waking', label: 'Waking' },
  { state: 'sitting', label: 'Sitting' },
  { state: 'reacting', label: 'Paw lift' },
  { state: 'celebrating', label: 'Celebrate' },
  { state: 'drinking', label: 'Drinking' },
];

export default function MiloTestScreen() {
  const milo = useMiloState('sleeping');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const s = STAGES[mode];

  const choose = (state: MiloState) => {
    if (state === 'waking') {
      // Waking only makes sense from sleep, so start him asleep if needed.
      if (milo.state !== 'sleeping') {
        milo.sleep();
        setTimeout(milo.wake, 700);
      } else milo.wake();
    } else milo.set(state);
  };

  return (
    <Page title="Milo test">
      <Segmented
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View
        style={{
          marginTop: spacing.md,
          backgroundColor: s.bg,
          borderRadius: radius.lg,
          padding: spacing.lg,
          alignItems: 'center',
          gap: spacing.md,
        }}>
        <AppText variant="label" color={s.muted} accessibilityLiveRegion="polite">
          Now: {STATES.find((x) => x.state === milo.state)?.label ?? milo.state}
        </AppText>
        <Milo {...milo.props} size={260} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
          {STATES.map(({ state, label }) => {
            const on = milo.state === state;
            return (
              <PressableScale
                key={state}
                accessibilityRole="button"
                accessibilityLabel={`Show Milo ${label.toLowerCase()}`}
                accessibilityState={{ selected: on }}
                onPress={() => choose(state)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: spacing.md,
                  justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: on ? MINT : s.chip,
                }}>
                <AppText variant="label" color={on ? NAVY : s.text}>
                  {label}
                </AppText>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="small" color={s.muted}>
            Small size (as under the set table)
          </AppText>
          <Milo {...milo.props} size={100} />
        </View>
      </View>

      <AppText variant="small" muted style={{ marginTop: spacing.md }}>
        Tap Milo to pet him (head turn or ear twitch, with a light buzz). Turn on Reduce Motion in iPhone Settings →
        Accessibility → Motion to see still poses. This screen is temporary.
      </AppText>
    </Page>
  );
}

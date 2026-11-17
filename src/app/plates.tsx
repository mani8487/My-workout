/** Plate calculator: enter a target weight, see which plates go on EACH side of the bar. */
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { formatKg, parseKg } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Biggest plates first until the side is filled. */
function platesPerSide(target: number, bar: number) {
  let remaining = Math.round(((target - bar) / 2) * 100) / 100;
  const plates: number[] = [];
  for (const p of PLATES) {
    while (remaining >= p - 1e-9) {
      plates.push(p);
      remaining = Math.round((remaining - p) * 100) / 100;
    }
  }
  return { plates, leftoverPerSide: remaining };
}

export default function PlatesScreen() {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [bar, setBar] = useState<'20' | '15' | '10'>('20');

  const target = parseKg(text);
  const barKg = Number(bar);
  const result = target != null && target >= barKg ? platesPerSide(target, barKg) : null;
  const loaded = result ? barKg + 2 * result.plates.reduce((a, b) => a + b, 0) : null;

  return (
    <Page title="Plate Calculator">
      <Card>
        <AppText variant="label">Target weight (kg)</AppText>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="e.g. 100"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus
          style={{
            ...typography.title,
            color: colors.text,
            backgroundColor: colors.cardAlt,
            borderRadius: radius.sm,
            padding: spacing.md,
          }}
        />
        <AppText variant="small" muted>
          Bar weight
        </AppText>
        <Segmented
          value={bar}
          onChange={setBar}
          options={[
            { value: '20', label: '20 kg' },
            { value: '15', label: '15 kg' },
            { value: '10', label: '10 kg' },
          ]}
        />
      </Card>

      {target != null && target < barKg && <AppText muted>That&apos;s less than the bar.</AppText>}

      {result && (
        <Card>
          <AppText variant="label">On each side</AppText>
          {result.plates.length === 0 ? (
            <AppText muted>Just the bar.</AppText>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {result.plates.map((p, i) => (
                <View
                  key={i}
                  style={{
                    minWidth: 56,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.sm,
                    backgroundColor: colors.accentSoft,
                    alignItems: 'center',
                  }}>
                  <AppText variant="label" color={colors.accent}>
                    {formatKg(p)}
                  </AppText>
                </View>
              ))}
            </View>
          )}
          <AppText variant="small" muted>
            Bar {barKg} kg + plates = {formatKg(loaded)} kg
            {result.leftoverPerSide > 0 ? ` (can't make exactly ${formatKg(target)} kg with standard plates)` : ''}
          </AppText>
        </Card>
      )}
    </Page>
  );
}

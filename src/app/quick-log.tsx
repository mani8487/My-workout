/**
 * Quick Log: a bottom sheet for logging any activity in a few taps.
 * Pick an activity (your last one is pre-selected), adjust the amount with a
 * chip or the keypad, tap Log. A short confirmation shows, then it closes.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { addQuickLog } from '@/db/quick-log';
import { getSetting, setSetting } from '@/db/settings';
import {
  ACTIVITY_PRESETS,
  type ActivityGroup,
  type ActivityUnit,
  describeLog,
  GROUP_LABELS,
} from '@/logic/activity';
import { useTheme } from '@/theme/theme-context';
import { MAX_FONT_SCALE, radius, spacing, typography } from '@/theme/typography';

const LAST_KEY = 'quick_log_last';
const CUSTOM = 'custom';

export default function QuickLogSheet() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [activity, setActivity] = useState<string>('walk');
  const preset = ACTIVITY_PRESETS.find((p) => p.id === activity);
  const [amount, setAmount] = useState('20');
  const [distance, setDistance] = useState('');
  const [customName, setCustomName] = useState('');
  const [customGroup, setCustomGroup] = useState<ActivityGroup>('cardio');
  const [customUnit, setCustomUnit] = useState<ActivityUnit>('min');
  const [done, setDone] = useState<string | null>(null);

  // Start on the activity you logged last time.
  useEffect(() => {
    getSetting(db, LAST_KEY).then((last) => {
      if (last && ACTIVITY_PRESETS.some((p) => p.id === last)) choose(last);
    });
  }, [db]);

  function choose(id: string) {
    Haptics.selectionAsync().catch(() => {});
    setActivity(id);
    setDistance('');
    const p = ACTIVITY_PRESETS.find((x) => x.id === id);
    if (p) setAmount(String(p.chips[Math.floor((p.chips.length - 1) / 2)]));
    else setAmount('10');
  }

  const unit: ActivityUnit = preset ? preset.unit : customUnit;
  const chips = preset ? preset.chips : unit === 'reps' ? [10, 15, 20, 30] : [5, 10, 20, 30];
  const value = Number(amount.replace(',', '.'));
  const name = preset ? preset.name : customName.trim();
  const canSave = value > 0 && name.length > 0;

  async function save() {
    if (!canSave) return;
    const km = Number(distance.replace(',', '.'));
    await addQuickLog(db, {
      activity: preset ? preset.id : CUSTOM,
      name,
      amount: value,
      unit,
      distanceKm: preset?.distance && km > 0 ? km : null,
      group: preset ? preset.group : customGroup,
      loggedAt: Date.now(),
    });
    if (preset) setSetting(db, LAST_KEY, preset.id).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone(`${capitalise(describeLog(name, value, unit))} logged. Nice.`);
    setTimeout(() => router.back(), 1100);
  }

  if (done) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background }}>
        <SymbolView name="checkmark.circle.fill" size={56} tintColor={colors.success} />
        <AppText variant="heading" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
          {done}
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled">
      <AppText variant="heading" accessibilityRole="header">
        Quick log
      </AppText>

      {/* Activity picker */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {[...ACTIVITY_PRESETS, { id: CUSTOM, name: 'Custom', icon: 'plus' }].map((p) => {
          const on = p.id === activity;
          return (
            <PressableScale
              key={p.id}
              onPress={() => choose(p.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={p.name}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs + 2,
                minHeight: 44,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: on ? colors.accent : colors.card,
                borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
              }}>
              <SymbolView name={p.icon as SFSymbol} size={16} tintColor={on ? colors.onAccent : colors.textMuted} />
              <AppText variant="label" color={on ? colors.onAccent : colors.text}>
                {p.name}
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      {/* Custom: name, group and unit */}
      {!preset && (
        <View style={{ gap: spacing.md }}>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Activity name, e.g. Dancing"
            placeholderTextColor={colors.textMuted}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel="Activity name"
            style={[inputStyle(colors), typography.body]}
          />
          <ChipRow
            options={(Object.keys(GROUP_LABELS) as ActivityGroup[]).map((g) => ({ value: g, label: GROUP_LABELS[g] }))}
            value={customGroup}
            onChange={setCustomGroup}
          />
          <ChipRow
            options={[
              { value: 'min' as ActivityUnit, label: 'Minutes' },
              { value: 'reps' as ActivityUnit, label: 'Reps' },
            ]}
            value={customUnit}
            onChange={setCustomUnit}
          />
        </View>
      )}

      {/* Amount */}
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.sm }}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
            maxFontSizeMultiplier={1.2}
            accessibilityLabel={unit === 'reps' ? 'Reps' : 'Minutes'}
            style={[typography.title, { color: colors.text, fontSize: 48, minWidth: 80, textAlign: 'center' }]}
          />
          <AppText variant="heading" muted>
            {unit === 'reps' ? 'reps' : 'min'}
          </AppText>
        </View>
        <ChipRow
          options={chips.map((c) => ({ value: String(c), label: unit === 'reps' ? String(c) : `${c} min` }))}
          value={amount}
          onChange={(v) => {
            Haptics.selectionAsync().catch(() => {});
            setAmount(v);
          }}
          center
        />
      </View>

      {preset?.distance && (
        <TextInput
          value={distance}
          onChangeText={setDistance}
          keyboardType="decimal-pad"
          placeholder="Distance in km (optional)"
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel="Distance in kilometres, optional"
          style={[inputStyle(colors), typography.body]}
        />
      )}

      <Button title="Log it" size="large" onPress={save} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.4 }} />
    </ScrollView>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  center,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  center?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: center ? 'center' : 'flex-start' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              minHeight: 40,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: on ? colors.accentSoft : colors.card,
              borderWidth: 1,
              borderColor: on ? colors.accent : colors.border,
            }}>
            <AppText variant="label" color={on ? colors.accent : colors.text}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors']) {
  return {
    color: colors.text,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md === 999 ? 24 : radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  } as const;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

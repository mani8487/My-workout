/**
 * Mist & Mint "Log movement" sheet. Same data as the classic Quick Log (it
 * writes to the same quick_logs table), laid out as:
 * - a 4-column grid of activity chips (Squats, Walk, Run, Swim, Yoga, Stretch,
 *   Cycling, Custom), your last one pre-selected;
 * - a reps / minutes switch (follows the activity, can be changed);
 * - the amount with quick number chips;
 * - "Counts toward today: N active min" and a Save pill.
 * After saving, Milo gives a paw and the sheet closes.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassTile } from '@/components/glass-tile';
import { Milo } from '@/components/mascot';
import { PressableScale } from '@/components/pressable-scale';
import { addQuickLog, getActiveMinutesBetween } from '@/db/quick-log';
import { getSetting, setSetting } from '@/db/settings';
import {
  ACTIVITY_PRESETS,
  activeMinutes,
  type ActivityGroup,
  type ActivityUnit,
  describeLog,
  GROUP_LABELS,
} from '@/logic/activity';
import { useTheme } from '@/theme/theme-context';
import { MAX_FONT_SCALE, spacing, typography } from '@/theme/typography';

const LAST_KEY = 'quick_log_last';
const CUSTOM = 'custom';
const GRID = ['squats', 'walk', 'run', 'swim', 'yoga', 'stretch', 'cycling', CUSTOM];

const nowMs = () => Date.now();
function todayRange() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return [d.getTime(), d.getTime() + 86_400_000] as const;
}
const fmtMin = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(1).replace(/\.0$/, ''));

export function MistQuickLog() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [activity, setActivity] = useState('walk');
  const preset = ACTIVITY_PRESETS.find((p) => p.id === activity);
  const [unit, setUnit] = useState<ActivityUnit>('min');
  const [amount, setAmount] = useState('20');
  const [distance, setDistance] = useState('');
  const [customName, setCustomName] = useState('');
  const [customGroup, setCustomGroup] = useState<ActivityGroup>('cardio');
  const [todayMin, setTodayMin] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    getSetting(db, LAST_KEY).then((last) => {
      if (last && GRID.includes(last)) pick(last, false);
    });
    const [from, to] = todayRange();
    getActiveMinutesBetween(db, from, to).then(setTodayMin).catch(() => {});
  }, [db]);

  function pick(id: string, haptic = true) {
    if (haptic) Haptics.selectionAsync().catch(() => {});
    setActivity(id);
    setDistance('');
    const p = ACTIVITY_PRESETS.find((x) => x.id === id);
    const u = p ? p.unit : 'min';
    setUnit(u);
    setAmount(String(p ? p.chips[Math.floor((p.chips.length - 1) / 2)] : 10));
  }

  function switchUnit(u: ActivityUnit) {
    if (u === unit) return;
    Haptics.selectionAsync().catch(() => {});
    setUnit(u);
    // Keep the same effort: 20 reps ↔ 2 min.
    const v = Number(amount.replace(',', '.'));
    if (v > 0) setAmount(fmtMin(u === 'min' ? Math.max(1, Math.round(v / 10)) : Math.round(v * 10)));
  }

  const chips =
    preset && preset.unit === unit ? preset.chips : unit === 'reps' ? [10, 15, 20, 30] : [5, 10, 20, 30];
  const value = Number(amount.replace(',', '.'));
  const name = preset ? preset.name : customName.trim();
  const canSave = value > 0 && name.length > 0;
  const total = todayMin + (value > 0 ? activeMinutes(value, unit) : 0);

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
      loggedAt: nowMs(),
    });
    setSetting(db, LAST_KEY, activity).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const what = describeLog(name, value, unit);
    setDone(`${what.charAt(0).toUpperCase()}${what.slice(1)} logged`);
    setTimeout(() => router.back(), 1500);
  }

  if (done) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.background }}>
        <Milo state="reacting" size={200} />
        <AppText variant="heading" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
          {done}
        </AppText>
        <AppText muted style={{ textAlign: 'center' }}>
          Today: {fmtMin(Math.round(total))} active min
        </AppText>
      </View>
    );
  }

  const rows = [GRID.slice(0, 4), GRID.slice(4, 8)];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled">
      <AppText variant="heading" accessibilityRole="header">
        Log movement
      </AppText>

      {/* 4-column activity grid */}
      <View style={{ gap: spacing.sm }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {row.map((id) => {
              const p = ACTIVITY_PRESETS.find((x) => x.id === id);
              const label = p ? p.name : 'Custom';
              const icon = (p ? p.icon : 'plus') as SFSymbol;
              const on = id === activity;
              // Selected: a solid navy/mint chip; the rest are glass.
              const Chip = on ? View : GlassTile;
              return (
                <PressableScale
                  key={id}
                  onPress={() => pick(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  style={{ flex: 1 }}>
                  <Chip
                    style={{
                      minHeight: 72,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingHorizontal: 4,
                      paddingVertical: spacing.sm,
                      ...(on ? { backgroundColor: colors.accent, borderColor: colors.accent } : null),
                    }}>
                    <SymbolView name={icon} size={22} tintColor={on ? colors.onAccent : colors.text} />
                    <AppText variant="small" color={on ? colors.onAccent : colors.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                      {label}
                    </AppText>
                  </Chip>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>

      {!preset && (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Activity name, e.g. Dancing"
            placeholderTextColor={colors.textMuted}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel="Activity name"
            style={[
              typography.body,
              { color: colors.text, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 24, paddingHorizontal: spacing.lg, minHeight: 48 },
            ]}
          />
          <Pills
            options={(Object.keys(GROUP_LABELS) as ActivityGroup[]).map((g) => ({ value: g, label: GROUP_LABELS[g] }))}
            value={customGroup}
            onChange={setCustomGroup}
          />
        </View>
      )}

      {/* Amount, with the reps / minutes switch */}
      <GlassTile style={{ borderRadius: 20, padding: spacing.lg, gap: spacing.md }}>
        <Segmented
          value={unit}
          onChange={switchUnit}
          options={[
            { value: 'reps', label: 'Reps' },
            { value: 'min', label: 'Minutes' },
          ]}
        />
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
        <Pills
          center
          options={chips.map((c) => ({ value: String(c), label: unit === 'reps' ? String(c) : `${c} min` }))}
          value={amount}
          onChange={(v) => {
            Haptics.selectionAsync().catch(() => {});
            setAmount(v);
          }}
        />
      </GlassTile>

      {preset?.distance && (
        <TextInput
          value={distance}
          onChangeText={setDistance}
          keyboardType="decimal-pad"
          placeholder="Distance in km (optional)"
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel="Distance in kilometres, optional"
          style={[
            typography.body,
            { color: colors.text, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 24, paddingHorizontal: spacing.lg, minHeight: 48 },
          ]}
        />
      )}

      <AppText muted style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
        Counts toward today: {fmtMin(Math.round(total))} active min
      </AppText>

      <PressableScale
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel="Save"
        accessibilityState={{ disabled: !canSave }}
        style={{
          minHeight: 52,
          borderRadius: 999,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canSave ? 1 : 0.4,
        }}>
        <AppText variant="label" color={colors.onAccent}>
          Save
        </AppText>
      </PressableScale>
    </ScrollView>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: colors.cardAlt }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent' }}>
            <AppText variant="label" color={on ? colors.onAccent : colors.text}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Pills<T extends string>({
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
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              borderRadius: 999,
              backgroundColor: on ? colors.accent : colors.cardAlt,
            }}>
            <AppText variant="label" color={on ? colors.onAccent : colors.text}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Settings: your name (for the Home greeting) and light/dark appearance. Kilos only, always. */
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Page } from '@/components/page';
import { PressableScale } from '@/components/pressable-scale';
import { Segmented } from '@/components/segmented';
import { getSetting, setSetting } from '@/db/settings';
import { refreshWater } from '@/db/water';
import { ACTIVE_GOAL_KEY, DEFAULT_ACTIVE_GOAL_MIN } from '@/logic/activity';
import { BODY_WEIGHT_KEY, HEIGHT_KEY } from '@/logic/hydration';
import { MILO_WATER_KEY } from '@/logic/hydration-layers';
import { useTheme, type ThemePreference } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { colors, preference, setPreference } = useTheme();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(DEFAULT_ACTIVE_GOAL_MIN);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [waterOnMilo, setWaterOnMilo] = useState(true);

  useEffect(() => {
    getSetting(db, 'user_name').then((v) => setName(v ?? ''));
    getSetting(db, BODY_WEIGHT_KEY).then((v) => setWeight(v ?? ''));
    getSetting(db, HEIGHT_KEY).then((v) => setHeight(v ?? ''));
    getSetting(db, MILO_WATER_KEY).then((v) => setWaterOnMilo(v !== '0'));
    getSetting(db, ACTIVE_GOAL_KEY).then((v) => setGoal(Number(v) > 0 ? Number(v) : DEFAULT_ACTIVE_GOAL_MIN));
  }, [db]);

  function saveWeight() {
    const kg = Number(weight.replace(',', '.'));
    const ok = kg >= 25 && kg <= 300;
    if (!ok) setWeight('');
    setSetting(db, BODY_WEIGHT_KEY, ok ? String(Math.round(kg * 10) / 10) : null).then(refreshWater);
  }

  function saveHeight() {
    const cm = Number(height.replace(',', '.'));
    const ok = cm >= 100 && cm <= 250;
    if (!ok) setHeight('');
    setSetting(db, HEIGHT_KEY, ok ? String(Math.round(cm)) : null).then(refreshWater);
  }

  function changeGoal(delta: number) {
    const next = Math.min(240, Math.max(5, goal + delta));
    setGoal(next);
    setSetting(db, ACTIVE_GOAL_KEY, String(next));
  }

  return (
    <Page title="Settings">
      <Card>
        <AppText variant="label">Your name</AppText>
        <AppText variant="small" muted>
          Used in the greeting on Home.
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => setSetting(db, 'user_name', name.trim() || null)}
          placeholder="Your first name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          returnKeyType="done"
          style={{
            ...typography.body,
            color: colors.text,
            backgroundColor: colors.cardAlt,
            borderRadius: radius.sm,
            padding: spacing.md,
          }}
        />
      </Card>

      <Card>
        <AppText variant="label">Daily active goal</AppText>
        <AppText variant="small" muted>
          Workouts and Quick Logs both count. 10 reps count as about 1 minute.
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <StepButton icon="minus" label="Lower goal by 5 minutes" onPress={() => changeGoal(-5)} />
          <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">
            {goal} min
          </AppText>
          <StepButton icon="plus" label="Raise goal by 5 minutes" onPress={() => changeGoal(5)} />
        </View>
      </Card>

      <Card>
        <AppText variant="label">Body weight and height</AppText>
        <AppText variant="small" muted>
          Set your daily water goal: 33 ml per kg, plus extra on days you exercise. Height lets the goal allow for build. Leave empty to use 2,000 ml.
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            onEndEditing={saveWeight}
            placeholder="e.g. 72"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            accessibilityLabel="Body weight in kilos"
            style={{
              ...typography.body,
              flex: 1,
              color: colors.text,
              backgroundColor: colors.cardAlt,
              borderRadius: radius.sm,
              padding: spacing.md,
            }}
          />
          <AppText variant="label" muted style={{ width: 28 }}>
            kg
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            value={height}
            onChangeText={setHeight}
            onEndEditing={saveHeight}
            placeholder="e.g. 175"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel="Height in centimetres"
            style={{
              ...typography.body,
              flex: 1,
              color: colors.text,
              backgroundColor: colors.cardAlt,
              borderRadius: radius.sm,
              padding: spacing.md,
            }}
          />
          <AppText variant="label" muted style={{ width: 28 }}>
            cm
          </AppText>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="label">Show water on Milo</AppText>
            <AppText variant="small" muted>
              On Home, the water you drink today fills Milo up, with a small readout above him.
            </AppText>
          </View>
          <Switch
            value={waterOnMilo}
            onValueChange={(on) => {
              setWaterOnMilo(on);
              setSetting(db, MILO_WATER_KEY, on ? null : '0').then(refreshWater);
            }}
            trackColor={{ true: colors.accent }}
            accessibilityLabel="Show water on Milo"
          />
        </View>
      </Card>

      <Card>
        <AppText variant="label">Appearance</AppText>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <AppText variant="small" muted>
          Auto follows your iPhone&apos;s light or dark setting.
        </AppText>
      </Card>

      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        All weights are in kilos. Everything is stored on this phone and works offline.
      </AppText>
    </Page>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'minus' | 'plus'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={icon} size={18} tintColor={colors.text} />
    </PressableScale>
  );
}

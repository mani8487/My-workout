/** Settings: your name (for the Home greeting) and light/dark appearance. Kilos only, always. */
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Page } from '@/components/page';
import { PressableScale } from '@/components/pressable-scale';
import { Segmented } from '@/components/segmented';
import { getSetting, setSetting } from '@/db/settings';
import { refreshWater } from '@/db/water';
import { ACTIVE_GOAL_KEY, DEFAULT_ACTIVE_GOAL_MIN } from '@/logic/activity';
import { BODY_WEIGHT_KEY } from '@/logic/hydration';
import { useTheme, type ThemePreference } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { colors, preference, setPreference } = useTheme();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(DEFAULT_ACTIVE_GOAL_MIN);
  const [weight, setWeight] = useState('');

  useEffect(() => {
    getSetting(db, 'user_name').then((v) => setName(v ?? ''));
    getSetting(db, BODY_WEIGHT_KEY).then((v) => setWeight(v ?? ''));
    getSetting(db, ACTIVE_GOAL_KEY).then((v) => setGoal(Number(v) > 0 ? Number(v) : DEFAULT_ACTIVE_GOAL_MIN));
  }, [db]);

  function saveWeight() {
    const kg = Number(weight.replace(',', '.'));
    const ok = kg >= 25 && kg <= 300;
    if (!ok) setWeight('');
    setSetting(db, BODY_WEIGHT_KEY, ok ? String(Math.round(kg * 10) / 10) : null).then(refreshWater);
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
        <AppText variant="label">Body weight</AppText>
        <AppText variant="small" muted>
          Sets your daily water goal (33 ml per kg, plus extra on days you exercise). Leave empty to use 2,000 ml.
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
          <AppText variant="label" muted>
            kg
          </AppText>
        </View>
      </Card>

      <Card>
        <AppText variant="label">Appearance</AppText>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'frost', label: 'Frost' },
            { value: 'ember', label: 'Ember' },
            { value: 'mist', label: 'Mist' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        <AppText variant="small" muted>
          Auto and Mist follow your iPhone&apos;s light or dark setting.
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

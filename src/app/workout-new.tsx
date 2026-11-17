/** Create a new workout (e.g. "Arms & Abs"), then add its exercises in the Plan Editor. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Page } from '@/components/page';
import { addWorkout } from '@/db/plan';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing, typography } from '@/theme/typography';

const ICONS: SFSymbol[] = [
  'dumbbell.fill',
  'figure.strengthtraining.traditional',
  'figure.strengthtraining.functional',
  'figure.core.training',
  'figure.run',
  'figure.cross.training',
  'figure.rower',
  'figure.step.training',
  'flame.fill',
  'bolt.fill',
];

export default function NewWorkoutScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState('');
  const [icon, setIcon] = useState<SFSymbol>(ICONS[0]);

  const input = {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: MIN_TAP,
  };

  async function save() {
    if (!name.trim()) {
      Alert.alert('Name needed', 'Give the workout a name, e.g. Arms & Abs.');
      return;
    }
    const id = await addWorkout(db, { name, muscleLabel: muscles, icon });
    router.replace({ pathname: '/plan/[workoutId]', params: { workoutId: id } });
  }

  return (
    <Page title="New Workout" modal footer={<Button title="Create & Add Exercises" onPress={save} />}>
      <Card>
        <AppText variant="label">Name</AppText>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Arms & Abs" placeholderTextColor={colors.faint} autoFocus style={input} />
      </Card>
      <Card>
        <AppText variant="label">Muscle groups (optional)</AppText>
        <TextInput
          value={muscles}
          onChangeText={setMuscles}
          placeholder="e.g. Biceps · Triceps · Core"
          placeholderTextColor={colors.faint}
          style={input}
        />
      </Card>
      <Card>
        <AppText variant="label">Icon</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {ICONS.map((i) => {
            const on = i === icon;
            return (
              <Pressable
                key={i}
                onPress={() => setIcon(i)}
                accessibilityLabel={`Icon ${i}`}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.lg,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.accent : colors.inputBorder,
                  backgroundColor: on ? colors.accentSoft : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <SymbolView name={i} size={26} tintColor={on ? colors.accent : colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </Card>
      <AppText variant="small" muted>
        New workouts join the rotation after your existing ones, so a cycle is complete once all of them are done.
      </AppText>
    </Page>
  );
}

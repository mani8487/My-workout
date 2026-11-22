/** Add a custom exercise: name, main muscle, other muscles, equipment. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Page } from '@/components/page';
import { addCustomExercise } from '@/db/plan';
import type { Equipment, MuscleGroup } from '@/db/types';
import { titleCase } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];
const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

export default function NewExerciseScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [main, setMain] = useState<MuscleGroup | null>(null);
  const [others, setOthers] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment | null>(null);

  async function save() {
    if (!name.trim() || !main || !equipment) {
      Alert.alert('Almost there', 'Add a name, a main muscle and the equipment.');
      return;
    }
    await addCustomExercise(db, { name, muscles: [main, ...others.filter((m) => m !== main)], equipment });
    router.back();
  }

  return (
    <Page title="New Exercise" modal footer={<Button title="Save Exercise" onPress={save} />}>
      <Card>
        <AppText variant="label">Name</AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Smith Machine Squat"
          placeholderTextColor={colors.textMuted}
          autoFocus
          style={{ ...typography.body, color: colors.text, backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.md }}
        />
      </Card>
      <Card>
        <AppText variant="label">Main muscle</AppText>
        <Chips items={MUSCLES} isOn={(m) => m === main} onToggle={(m) => setMain(m)} />
      </Card>
      <Card>
        <AppText variant="label">Other muscles (optional)</AppText>
        <Chips
          items={MUSCLES.filter((m) => m !== main)}
          isOn={(m) => others.includes(m)}
          onToggle={(m) => setOthers((o) => (o.includes(m) ? o.filter((x) => x !== m) : [...o, m]))}
        />
      </Card>
      <Card>
        <AppText variant="label">Equipment</AppText>
        <Chips items={EQUIPMENT} isOn={(e) => e === equipment} onToggle={(e) => setEquipment(e)} />
      </Card>
    </Page>
  );
}

function Chips<T extends string>({ items, isOn, onToggle }: { items: T[]; isOn: (t: T) => boolean; onToggle: (t: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {items.map((t) => {
        const on = isOn(t);
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: on }}
            key={t}
            onPress={() => onToggle(t)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: on ? colors.accent : colors.cardAlt,
            }}>
            <AppText variant="small" color={on ? colors.onAccent : colors.text} style={{ fontWeight: '600' }}>
              {titleCase(t)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

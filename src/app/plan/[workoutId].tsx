/**
 * Edit one workout's plan: sets, rep range and rest per exercise, drag
 * exercises (≡ handle) to reorder, remove them, or add new ones from the library.
 * Every change saves straight away.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { type ReactNode, useCallback, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DragList } from '@/components/drag-list';
import { Page } from '@/components/page';
import {
  deleteWorkout,
  isCustomWorkout,
  getPlanForWorkout,
  getWorkouts,
  removePlanItem,
  reorderPlanItems,
  updatePlanItem,
  type PlannedExercise,
} from '@/db/plan';
import type { WorkoutId } from '@/db/types';
import { parseReps } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function PlanEditorScreen() {
  const db = useSQLiteContext();
  const { workoutId } = useLocalSearchParams<{ workoutId: WorkoutId }>();
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<PlannedExercise[]>([]);

  const refresh = useCallback(async () => {
    const w = (await getWorkouts(db)).find((x) => x.id === workoutId);
    setName(w?.name ?? '');
    setPlan(await getPlanForWorkout(db, workoutId));
  }, [db, workoutId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function change(fn: () => Promise<void>) {
    await fn();
    await refresh();
  }

  return (
    <Page
      title={name}
      footer={
        <Button
          title="+ Add Exercise"
          kind="secondary"
          onPress={() => router.push({ pathname: '/plan/add', params: { workoutId } })}
        />
      }
      right={
        isCustomWorkout(workoutId)
          ? {
              icon: 'trash',
              label: 'Delete workout',
              onPress: () =>
                Alert.alert(`Delete ${name}?`, 'It leaves the rotation. Past sessions stay in History.', [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteWorkout(db, workoutId);
                      router.back();
                    },
                  },
                ]),
            }
          : undefined
      }>
      {plan.length === 0 && <AppText muted>No exercises yet. Tap Add Exercise.</AppText>}
      <DragList
        items={plan}
        keyOf={(p) => p.planItemId}
        gap={spacing.lg}
        onReorder={(from, to) => {
          // Show the new order straight away, then save it.
          const next = plan.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          setPlan(next);
          change(() => reorderPlanItems(db, next.map((p) => p.planItemId)));
        }}
        renderItem={(p, _i, handle) => (
          <PlanItemCard
            item={p}
            handle={handle}
            onRemove={() =>
              Alert.alert(`Remove ${p.exercise.name}?`, 'It will no longer be part of this workout.', [
                { text: 'Keep', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => change(() => removePlanItem(db, workoutId, p.planItemId)) },
              ])
            }
            onUpdate={(patch) => change(() => updatePlanItem(db, p.planItemId, patch))}
          />
        )}
      />
    </Page>
  );
}

function PlanItemCard({
  item,
  handle,
  onRemove,
  onUpdate,
}: {
  item: PlannedExercise;
  /** The drag grip from DragList. */
  handle: ReactNode;
  onRemove: () => void;
  onUpdate: (patch: Partial<{ targetSets: number; repMin: number; repMax: number; restSeconds: number }>) => void;
}) {
  const { colors } = useTheme();
  const [repMin, setRepMin] = useState(String(item.repMin));
  const [repMax, setRepMax] = useState(String(item.repMax));

  function saveReps() {
    let lo = parseReps(repMin) ?? item.repMin;
    let hi = parseReps(repMax) ?? item.repMax;
    lo = Math.max(1, lo);
    if (hi < lo) hi = lo;
    setRepMin(String(lo));
    setRepMax(String(hi));
    if (lo !== item.repMin || hi !== item.repMax) onUpdate({ repMin: lo, repMax: hi });
  }

  const repInput = {
    ...typography.label,
    color: colors.text,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    width: 44,
    paddingVertical: spacing.xs,
    textAlign: 'center' as const,
  };
  const rest = `${Math.floor(item.restSeconds / 60)}:${String(item.restSeconds % 60).padStart(2, '0')}`;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {handle}
        <AppText variant="label" style={{ flex: 1 }}>
          {item.exercise.name}
        </AppText>
        <IconButton icon="trash" label="Remove" danger onPress={onRemove} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
        <Stepper
          label="Sets"
          value={String(item.targetSets)}
          onMinus={() => item.targetSets > 1 && onUpdate({ targetSets: item.targetSets - 1 })}
          onPlus={() => item.targetSets < 10 && onUpdate({ targetSets: item.targetSets + 1 })}
        />
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="small" muted>
            Reps
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <TextInput value={repMin} onChangeText={setRepMin} onEndEditing={saveReps} keyboardType="number-pad" selectTextOnFocus style={repInput} />
            <AppText muted>–</AppText>
            <TextInput value={repMax} onChangeText={setRepMax} onEndEditing={saveReps} keyboardType="number-pad" selectTextOnFocus style={repInput} />
          </View>
        </View>
        <Stepper
          label="Rest"
          value={rest}
          onMinus={() => item.restSeconds > 30 && onUpdate({ restSeconds: item.restSeconds - 15 })}
          onPlus={() => item.restSeconds < 600 && onUpdate({ restSeconds: item.restSeconds + 15 })}
        />
      </View>
    </Card>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityLabel={label} style={{ opacity: disabled ? 0.25 : 1 }}>
      <SymbolView name={icon} size={18} tintColor={danger ? colors.danger : colors.accent} />
    </Pressable>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const { colors } = useTheme();
  const btn = { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable onPress={onMinus} style={btn} accessibilityLabel={`Less ${label}`}>
          <SymbolView name="minus" size={12} tintColor={colors.accent} />
        </Pressable>
        <AppText variant="label" style={{ minWidth: 34, textAlign: 'center' }}>
          {value}
        </AppText>
        <Pressable onPress={onPlus} style={btn} accessibilityLabel={`More ${label}`}>
          <SymbolView name="plus" size={12} tintColor={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

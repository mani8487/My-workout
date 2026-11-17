/**
 * One row in the set table:
 *   [set no.] [previous] [kg] [reps] [tick] [note]
 *
 * - Tick: saves the set instantly. Tick again to un-tick.
 * - Tap the numbers of a ticked set to edit them, then tick to save.
 * - Long-press the set number: toggle warm-up (shown as "W").
 * - Swipe left: reveals Delete.
 * - Note icon: opens a text box under the row.
 * - After ticking, an optional "reps left" row (0–3) slides in.
 */
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Keyboard, Pressable, TextInput, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import type { PreviousSet, SessionSet, SetPatch } from '@/db/sessions';
import { formatKg, formatSet, parseKg, parseReps } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export const SET_INPUT_ACCESSORY_ID = 'set-input-done';

/** Column widths, shared with the table header so everything lines up. */
export const COLS = { set: 40, kg: 72, reps: 58, tick: 40, note: 30 } as const;

type Props = {
  set: SessionSet;
  /** "1", "2"… for working sets, "W" for warm-ups. */
  label: string;
  previous?: PreviousSet;
  hidePrevious?: boolean;
  showRir: boolean;
  onSave: (patch: SetPatch) => Promise<void>;
  /** Called after a set is newly ticked (not when re-saving an edit). */
  onCompleted: () => void;
  onRir: (rir: number | null) => void;
  onDelete: () => void;
};

export function SetRow({ set, label, previous, hidePrevious, showRir, onSave, onCompleted, onRir, onDelete }: Props) {
  const { colors } = useTheme();
  const isDone = set.completedAt != null;

  const [weightText, setWeightText] = useState(formatKg(set.weightKg));
  const [repsText, setRepsText] = useState(set.reps != null ? String(set.reps) : '');
  const [editing, setEditing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(set.note ?? '');

  const inputsLive = !isDone || editing;

  async function handleTick() {
    // Ticking a finished set (not being edited) un-ticks it.
    if (isDone && !editing) {
      await onSave({ completedAt: null });
      return;
    }
    const weight = parseKg(weightText);
    // Empty reps box? Use last time's reps, the greyed-out hint.
    const reps = parseReps(repsText) ?? previous?.reps ?? null;
    if (reps == null || reps === 0) {
      Alert.alert('Enter your reps', 'Type how many reps you did, then tick the set.');
      return;
    }
    Keyboard.dismiss();
    await onSave({ weightKg: weight, reps, completedAt: isDone ? set.completedAt : Date.now() });
    setWeightText(formatKg(weight));
    setRepsText(String(reps));
    const wasNew = !isDone;
    setEditing(false);
    if (wasNew) onCompleted();
  }

  function saveWeightDraft() {
    if (isDone) return; // edits to a ticked set are saved when you tick it again
    const w = parseKg(weightText);
    if (w !== set.weightKg) onSave({ weightKg: w });
  }

  function saveRepsDraft() {
    if (isDone) return;
    const r = parseReps(repsText);
    if (r !== set.reps) onSave({ reps: r });
  }

  function saveNote() {
    const trimmed = noteText.trim();
    if (trimmed !== (set.note ?? '')) onSave({ note: trimmed === '' ? null : trimmed });
  }

  const rowBg = isDone && !editing ? colors.successSoft : colors.card;
  const inputStyle = {
    ...typography.label,
    color: colors.text,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    textAlign: 'center' as const,
  };

  return (
    <View>
      <Swipeable
        friction={2}
        rightThreshold={40}
        renderRightActions={() => (
          <Pressable
            onPress={onDelete}
            accessibilityLabel="Delete set"
            style={{
              backgroundColor: colors.danger,
              justifyContent: 'center',
              paddingHorizontal: spacing.xl,
            }}>
            <AppText variant="label" color="#FFFFFF">
              Delete
            </AppText>
          </Pressable>
        )}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            backgroundColor: rowBg,
            opacity: set.isWarmup && !isDone ? 0.85 : 1,
          }}>
          {/* Set number. Long-press toggles warm-up. */}
          <Pressable
            onLongPress={() => onSave({ isWarmup: !set.isWarmup })}
            delayLongPress={350}
            accessibilityLabel={set.isWarmup ? 'Warm-up set. Long press to make it a working set' : `Set ${label}. Long press to mark as warm-up`}
            style={{
              width: COLS.set,
              height: 32,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: set.isWarmup ? colors.cardAlt : 'transparent',
            }}>
            <AppText variant="label" muted={set.isWarmup}>
              {label}
            </AppText>
          </Pressable>

          {/* Last time's result, muted (hidden in History). */}
          {hidePrevious ? (
            <View style={{ flex: 1 }} />
          ) : (
            <AppText variant="small" muted numberOfLines={1} style={{ flex: 1 }}>
              {previous ? formatSet(previous.weightKg, previous.reps) : '—'}
            </AppText>
          )}

          {inputsLive ? (
            <>
              <TextInput
                value={weightText}
                onChangeText={setWeightText}
                onEndEditing={saveWeightDraft}
                placeholder={previous?.weightKg != null ? formatKg(previous.weightKg) : 'kg'}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                inputAccessoryViewID={SET_INPUT_ACCESSORY_ID}
                selectTextOnFocus
                accessibilityLabel="Weight in kilos"
                style={[inputStyle, { width: COLS.kg }]}
              />
              <TextInput
                value={repsText}
                onChangeText={setRepsText}
                onEndEditing={saveRepsDraft}
                placeholder={previous?.reps != null ? String(previous.reps) : 'reps'}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                inputAccessoryViewID={SET_INPUT_ACCESSORY_ID}
                selectTextOnFocus
                accessibilityLabel="Reps"
                style={[inputStyle, { width: COLS.reps }]}
              />
            </>
          ) : (
            // A ticked set: tap the numbers to edit.
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityLabel="Edit this set"
              style={{ flexDirection: 'row', gap: spacing.sm }}>
              <AppText variant="label" style={{ width: COLS.kg, textAlign: 'center' }}>
                {formatKg(set.weightKg) || 'BW'}
              </AppText>
              <View style={{ width: COLS.reps, alignItems: 'center' }}>
                <AppText variant="label">{set.reps}</AppText>
                {set.rir != null && (
                  <AppText variant="small" muted style={{ fontSize: 11 }}>
                    {set.rir} left
                  </AppText>
                )}
              </View>
            </Pressable>
          )}

          {/* Tick */}
          <Pressable
            onPress={handleTick}
            hitSlop={6}
            accessibilityLabel={isDone && !editing ? 'Untick set' : 'Tick set as done'}
            style={{
              width: 34,
              height: 34,
              marginHorizontal: (COLS.tick - 34) / 2,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: isDone ? colors.success : colors.border,
              backgroundColor: isDone && !editing ? colors.success : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <SymbolView
              name="checkmark"
              size={16}
              weight="bold"
              tintColor={isDone && !editing ? '#FFFFFF' : editing ? colors.success : colors.textMuted}
            />
          </Pressable>

          {/* Note */}
          <Pressable
            onPress={() => setNoteOpen((o) => !o)}
            hitSlop={6}
            accessibilityLabel={set.note ? 'Edit note' : 'Add note'}
            style={{ width: COLS.note, alignItems: 'center' }}>
            <SymbolView
              name={set.note ? 'note.text' : 'square.and.pencil'}
              size={18}
              tintColor={set.note ? colors.accent : colors.textMuted}
            />
          </Pressable>
        </View>
      </Swipeable>

      {noteOpen && (
        <Animated.View entering={FadeIn.duration(150)} style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            onEndEditing={saveNote}
            placeholder="Note for this set, e.g. seat height 4, felt easy"
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus={!set.note}
            style={{
              ...typography.body,
              color: colors.text,
              backgroundColor: colors.cardAlt,
              borderRadius: radius.sm,
              padding: spacing.md,
              minHeight: 44,
            }}
          />
        </Animated.View>
      )}

      {showRir && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.sm,
          }}>
          <AppText variant="small" muted style={{ flex: 1 }}>
            Reps left in the tank?
          </AppText>
          {[0, 1, 2, 3].map((n) => (
            <Pressable
              key={n}
              onPress={() => onRir(n)}
              accessibilityLabel={`${n} reps left`}
              style={({ pressed }) => ({
                width: 40,
                height: 34,
                borderRadius: radius.sm,
                backgroundColor: pressed ? colors.accent : colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              })}>
              <AppText variant="label" color={colors.accent}>
                {n}
              </AppText>
            </Pressable>
          ))}
          <Pressable onPress={() => onRir(null)} hitSlop={8} accessibilityLabel="Skip reps left">
            <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

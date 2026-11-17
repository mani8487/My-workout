/**
 * One row in the set table:
 *   [set no.] [previous] [kg] [reps] [tick] [note]
 *
 * - Tick: saves the set instantly (with a light haptic). Tick again to un-tick.
 * - Tap the numbers of a ticked set to edit them, then tick to save.
 * - Long-press the set number: toggle warm-up (shown as "W").
 * - Swipe left: reveals Delete.
 * - Note icon: opens a text box under the row.
 * - After ticking, an optional "reps left" row (0–3) slides in.
 * - While typing, the bar above the number pad has − / + steppers
 *   (2.5 kg for weight, 1 for reps) and Done.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, InputAccessoryView, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import type { PreviousSet, SessionSet, SetPatch } from '@/db/sessions';
import { formatKg, formatSet, parseKg, parseReps } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { MAX_FONT_SCALE, MIN_TAP, radius, spacing, typography } from '@/theme/typography';

export const SET_INPUT_ACCESSORY_ID = 'set-input-done';

/** Column widths, shared with the table header so everything lines up. */
export const COLS = { set: 34, kg: 78, reps: 56, tick: 44, note: 28 } as const;

// ---- The −/+ stepper above the number pad acts on whichever box is focused ----
let activeStep: ((dir: -1 | 1) => void) | null = null;

/** The bar shown above the iPhone number pad. Render once per screen. */
export function NumberPadBar() {
  const { colors } = useTheme();
  if (Platform.OS !== 'ios') return null;
  const stepBtn = {
    minWidth: 64,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <InputAccessoryView nativeID={SET_INPUT_ACCESSORY_ID}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
        <Pressable onPress={() => activeStep?.(-1)} style={stepBtn} accessibilityLabel="Decrease">
          <AppText variant="label">−</AppText>
        </Pressable>
        <Pressable onPress={() => activeStep?.(1)} style={stepBtn} accessibilityLabel="Increase">
          <AppText variant="label">+</AppText>
        </Pressable>
        <AppText variant="small" muted style={{ flex: 1 }}>
          kg ±2.5 · reps ±1
        </AppText>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={10} style={{ height: 40, justifyContent: 'center' }}>
          <AppText variant="label" color={colors.accent}>
            Done
          </AppText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

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
  const showDone = isDone && !editing;

  async function handleTick() {
    // Ticking a finished set (not being edited) un-ticks it.
    if (showDone) {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  const inputStyle = {
    ...typography.number,
    color: colors.text,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    height: MIN_TAP,
    paddingVertical: 0,
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
            style={{ backgroundColor: colors.danger, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
            <AppText variant="label" color="#FFFFFF">
              Delete
            </AppText>
          </Pressable>
        )}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            // Solid card underneath so the swipe covers the Delete button; green tint on top when done.
            backgroundColor: colors.card,
          }}>
          {showDone && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.successSoft }}
            />
          )}

          {/* Set number. Long-press toggles warm-up. */}
          <Pressable
            onLongPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSave({ isWarmup: !set.isWarmup });
            }}
            delayLongPress={350}
            accessibilityLabel={set.isWarmup ? 'Warm-up set. Long press to make it a working set' : `Set ${label}. Long press to mark as warm-up`}
            style={{
              width: COLS.set,
              height: MIN_TAP,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: set.isWarmup ? colors.accentSoft : 'transparent',
            }}>
            <AppText variant="label" color={set.isWarmup ? colors.accent : colors.text}>
              {label}
            </AppText>
          </Pressable>

          {/* Last time's result, muted (hidden in History). */}
          {hidePrevious ? (
            <View style={{ flex: 1 }} />
          ) : (
            <AppText variant="previous" muted numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1 }}>
              {previous ? formatSet(previous.weightKg, previous.reps) : '—'}
            </AppText>
          )}

          {inputsLive ? (
            <>
              <TextInput
                value={weightText}
                onChangeText={setWeightText}
                onFocus={() => {
                  activeStep = (dir) =>
                    setWeightText((t) => formatKg(Math.max(0, (parseKg(t) ?? previous?.weightKg ?? 0) + dir * 2.5)));
                }}
                onEndEditing={saveWeightDraft}
                placeholder={previous?.weightKg != null ? formatKg(previous.weightKg) : 'kg'}
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                inputAccessoryViewID={SET_INPUT_ACCESSORY_ID}
                selectTextOnFocus
                maxFontSizeMultiplier={1.2}
                accessibilityLabel="Weight in kilos"
                style={[inputStyle, { width: COLS.kg }]}
              />
              <TextInput
                value={repsText}
                onChangeText={setRepsText}
                onFocus={() => {
                  activeStep = (dir) =>
                    setRepsText((t) => String(Math.max(0, (parseReps(t) ?? previous?.reps ?? 0) + dir)));
                }}
                onEndEditing={saveRepsDraft}
                placeholder={previous?.reps != null ? String(previous.reps) : 'reps'}
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                inputAccessoryViewID={SET_INPUT_ACCESSORY_ID}
                selectTextOnFocus
                maxFontSizeMultiplier={1.2}
                accessibilityLabel="Reps"
                style={[inputStyle, { width: COLS.reps }]}
              />
            </>
          ) : (
            // A ticked set: tap the numbers to edit.
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityLabel="Edit this set"
              style={{ flexDirection: 'row', gap: 6, height: MIN_TAP, alignItems: 'center' }}>
              <AppText variant="number" style={{ width: COLS.kg, textAlign: 'center' }} maxFontSizeMultiplier={1.2}>
                {formatKg(set.weightKg) || 'BW'}
              </AppText>
              <View style={{ width: COLS.reps, alignItems: 'center' }}>
                <AppText variant="number" maxFontSizeMultiplier={1.2}>
                  {set.reps}
                </AppText>
                {set.rir != null && (
                  <AppText variant="small" muted style={{ fontSize: 11, marginTop: -4 }} maxFontSizeMultiplier={1}>
                    {set.rir} left
                  </AppText>
                )}
              </View>
            </Pressable>
          )}

          {/* Tick */}
          <Pressable
            onPress={handleTick}
            hitSlop={4}
            accessibilityLabel={showDone ? 'Untick set' : 'Tick set as done'}
            style={{
              width: COLS.tick,
              height: COLS.tick,
              borderRadius: COLS.tick / 2,
              borderWidth: 2,
              borderColor: isDone ? colors.success : colors.inputBorder,
              backgroundColor: showDone ? colors.success : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <SymbolView
              name="checkmark"
              size={18}
              weight="bold"
              tintColor={showDone ? colors.background : editing ? colors.success : colors.faint}
            />
          </Pressable>

          {/* Note */}
          <Pressable
            onPress={() => setNoteOpen((o) => !o)}
            hitSlop={10}
            accessibilityLabel={set.note ? 'Edit note' : 'Add note'}
            style={{ width: COLS.note, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' }}>
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
            placeholder="Note for this set, e.g. seat height 4"
            placeholderTextColor={colors.faint}
            multiline
            autoFocus={!set.note}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{
              ...typography.body,
              color: colors.text,
              backgroundColor: colors.input,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              borderRadius: radius.sm,
              padding: spacing.md,
              minHeight: MIN_TAP,
            }}
          />
        </Animated.View>
      )}

      {showRir && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
          <AppText variant="small" muted style={{ flex: 1 }}>
            Reps left in the tank?
          </AppText>
          {[0, 1, 2, 3].map((n) => (
            <Pressable
              key={n}
              onPress={() => onRir(n)}
              accessibilityLabel={`${n} reps left`}
              style={({ pressed }) => ({
                width: MIN_TAP,
                height: MIN_TAP - 4,
                borderRadius: radius.sm,
                borderWidth: 1,
                // 0 left gets a soft crimson tint; the rest are neutral outlines.
                borderColor: n === 0 ? colors.danger : colors.inputBorder,
                backgroundColor: pressed ? colors.cardAlt : n === 0 ? colors.dangerSoft : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              })}>
              <AppText variant="label">{n}</AppText>
            </Pressable>
          ))}
          <Pressable onPress={() => onRir(null)} hitSlop={12} accessibilityLabel="Skip reps left">
            <SymbolView name="xmark" size={14} tintColor={colors.textMuted} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

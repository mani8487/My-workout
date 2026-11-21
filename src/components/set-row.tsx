/**
 * One row in the set table:
 *   [set no.] [previous] [kg] [reps] [tick] [note]
 *
 * - Tick: saves the set instantly (with a light haptic). Tick again to un-tick.
 * - Tap the numbers of a ticked set to edit them, then tick to save.
 * - Tap the set number: menu with warm-up on/off and Delete. Long-press
 *   toggles warm-up straight away (shown as "W").
 * - Swipe left: reveals Delete.
 * - Note icon: opens a text box under the row.
 * - After ticking, an optional "reps left" row (0–3) slides in.
 * - kg / reps boxes open the app's own number pad (number-pad.tsx), with
 *   − / + steppers (2.5 kg, 1 rep), Next and Done.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, TextInput, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedTick } from '@/components/animated-tick';
import { AppText } from '@/components/app-text';
import { closePad, openPad, type PadField, updatePad, useActivePadId } from '@/components/number-pad';
import type { PreviousSet, SessionSet, SetPatch } from '@/db/sessions';
import { formatKg, formatSet, parseKg, parseReps } from '@/logic/format';
import { SPRING_SETTLE } from '@/theme/motion';
import { useTheme } from '@/theme/theme-context';
import { MAX_FONT_SCALE, MIN_TAP, radius, spacing, typography } from '@/theme/typography';

/** Column widths, shared with the table header so everything lines up. */
export const COLS = { set: 34, kg: 78, reps: 56, tick: 44, note: 40 } as const;

type PadBoxProps = Omit<PadField, 'measure'> & { placeholder: string; width: number; label: string };

/** A kg or reps box. Tapping it opens the app's own number pad. */
function PadBox({ placeholder, width, label, ...rest }: PadBoxProps) {
  const { colors } = useTheme();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const active = useActivePadId() === rest.id;
  const field: PadField = {
    ...rest,
    measure: (cb) => ref.current?.measureInWindow((_x, y, _w, h) => cb(y, h)),
  };
  // After every render, hand the open pad this box's latest value and callbacks.
  useEffect(() => updatePad(field));
  return (
    <Pressable
      ref={ref}
      onPress={() => openPad(field)}
      accessibilityLabel={label}
      accessibilityValue={{ text: rest.value || placeholder }}
      style={{
        width,
        height: MIN_TAP,
        borderRadius: radius.sm,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.accent : colors.inputBorder,
        backgroundColor: colors.input,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText variant="number" color={rest.value ? colors.text : colors.textMuted} maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {rest.value || placeholder}
      </AppText>
    </Pressable>
  );
}

type Props = {
  set: SessionSet;
  /** "1", "2"… for working sets, "W" for warm-ups. */
  label: string;
  /** The next set to do: shown as an orange dot instead of its number (Ember). */
  isCurrent?: boolean;
  previous?: PreviousSet;
  hidePrevious?: boolean;
  showRir: boolean;
  onSave: (patch: SetPatch) => Promise<void>;
  /** Called after a set is newly ticked (not when re-saving an edit). */
  onCompleted: () => void;
  onRir: (rir: number | null) => void;
  onDelete: () => void;
};

export function SetRow({ set, label, isCurrent = false, previous, hidePrevious, showRir, onSave, onCompleted, onRir, onDelete }: Props) {
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
    closePad();
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

  function repsField(): PadField {
    return { id: `${set.id}-reps`, kind: 'reps', value: repsText, fallback: previous?.reps, onChange: setRepsText, onCommit: saveRepsDraft };
  }

  function kgField(): PadField {
    return {
      id: `${set.id}-kg`,
      kind: 'kg',
      value: weightText,
      fallback: previous?.weightKg,
      onChange: setWeightText,
      onCommit: saveWeightDraft,
      onNext: () => openPad(repsField()),
    };
  }

  // Row wipe: 0 = no tint, 1 = full green tint.
  const reduced = useReducedMotion();
  const wipe = useSharedValue(showDone ? 1 : 0);
  useEffect(() => {
    // Reduce Motion: a gentle fade instead of the sweep.
    wipe.value = reduced
      ? withTiming(showDone ? 1 : 0, { duration: 200, reduceMotion: ReduceMotion.Never })
      : withSpring(showDone ? 1 : 0, { ...SPRING_SETTLE, duration: showDone ? 400 : 250 });
  }, [showDone, wipe, reduced]);
  const wipeStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: wipe.value }
      : { transform: [{ scaleX: wipe.value }], opacity: Math.min(1, wipe.value * 2) },
  );

  function openSetMenu() {
    const warmLabel = set.isWarmup ? 'Make Working Set' : 'Mark as Warm-up';
    const toggle = () => onSave({ isWarmup: !set.isWarmup });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [warmLabel, 'Delete Set', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) toggle();
          if (i === 1) onDelete();
        },
      );
    } else {
      Alert.alert('Set options', undefined, [
        { text: warmLabel, onPress: toggle },
        { text: 'Delete Set', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function saveNote() {
    const trimmed = noteText.trim();
    if (trimmed !== (set.note ?? '')) onSave({ note: trimmed === '' ? null : trimmed });
  }

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
          {/* Green tint that wipes across from the left when the set is ticked. */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.successSoft, transformOrigin: 'left' },
              wipeStyle,
            ]}
          />

          {/* Set number. Tap for a menu; long-press toggles warm-up. */}
          <Pressable
            onPress={openSetMenu}
            onLongPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSave({ isWarmup: !set.isWarmup });
            }}
            delayLongPress={350}
            accessibilityLabel={
              set.isWarmup ? 'Warm-up set. Tap for options' : `Set ${label}${isCurrent ? ', up now' : ''}. Tap for options`
            }
            style={{
              width: COLS.set,
              height: MIN_TAP,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: set.isWarmup ? colors.accentSoft : 'transparent',
            }}>
            {isCurrent && !set.isWarmup ? (
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} />
            ) : (
              <AppText variant="label" color={set.isWarmup ? colors.accent : colors.text}>
                {label}
              </AppText>
            )}
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
              <PadBox
                {...kgField()}
                placeholder={previous?.weightKg != null ? formatKg(previous.weightKg) : 'kg'}
                width={COLS.kg}
                label="Weight in kilos"
              />
              <PadBox
                {...repsField()}
                placeholder={previous?.reps != null ? String(previous.reps) : 'reps'}
                width={COLS.reps}
                label="Reps"
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
                  <AppText variant="small" muted style={{ marginTop: -4 }} maxFontSizeMultiplier={1.2}>
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
            <AnimatedTick
              done={showDone}
              color={colors.background}
              idleColor={showDone ? 'transparent' : editing ? colors.success : colors.faint}
            />
          </Pressable>

          {/* Note */}
          <Pressable
            onPress={() => setNoteOpen((o) => !o)}
            hitSlop={4}
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
            onFocus={closePad}
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

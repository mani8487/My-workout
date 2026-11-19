/**
 * The app's own number pad for the kg and reps boxes in the set table.
 *
 * - A box opens the pad with `openPad(...)`. The pad slides up from the bottom
 *   and every key press goes back to that box.
 * - The first key replaces the box's value (like "select all"); later keys add to it.
 * - Top bar: − / + steppers (2.5 kg or 1 rep), Next (kg → reps) and Done.
 * - Render <NumberPad /> once per screen, inside the SafeAreaView.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { type ComponentRef, type RefObject, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Dimensions, Keyboard, Pressable, type ScrollView, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { formatKg, parseKg, parseReps } from '@/logic/format';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export type PadField = {
  /** Unique per box, e.g. `${setId}-kg`. Lets the box know it's the active one. */
  id: string;
  kind: 'kg' | 'reps';
  value: string;
  /** Used by − / + when the box is empty (last time's value). */
  fallback?: number | null;
  onChange: (text: string) => void;
  /** Called when the pad closes or moves to another box. */
  onCommit: () => void;
  /** Present for kg boxes: moves to the reps box of the same set. */
  onNext?: () => void;
  /** Where the box is on screen, so the pad can scroll it into view. */
  measure?: (cb: (y: number, height: number) => void) => void;
};

// ---- A tiny store: which box is open, and whether the next key replaces the value ----
let current: PadField | null = null;
let fresh = true;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openPad(field: PadField) {
  if (current && current.id !== field.id) current.onCommit();
  Keyboard.dismiss();
  current = field;
  fresh = true;
  emit();
}

export function closePad() {
  if (!current) return;
  const f = current;
  current = null;
  emit();
  f.onCommit();
}

/** Keeps the open box's value and callbacks fresh when its row re-renders. */
export function updatePad(field: PadField) {
  if (current?.id === field.id) current = field;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The id of the box the pad is typing into, or null when it's closed. */
export function useActivePadId() {
  return useSyncExternalStore(subscribe, () => current?.id ?? null);
}

function press(key: string) {
  const f = current;
  if (!f) return;
  Haptics.selectionAsync().catch(() => {});
  let text = fresh ? '' : f.value;
  fresh = false;
  if (key === 'back') text = text.slice(0, -1);
  else if (key === '.') {
    if (f.kind === 'reps' || text.includes('.')) return;
    text = (text === '' ? '0' : text) + '.';
  } else {
    const [whole, dec] = text.split('.');
    if (dec != null && dec.length >= 2) return; // 62.25 at most
    if (dec == null && whole.length >= (f.kind === 'kg' ? 3 : 3)) return; // 999 kg / 999 reps
    text = text === '0' ? key : text + key;
  }
  current = { ...f, value: text };
  f.onChange(text);
}

function step(dir: -1 | 1) {
  const f = current;
  if (!f) return;
  Haptics.selectionAsync().catch(() => {});
  const text =
    f.kind === 'kg'
      ? formatKg(Math.max(0, (parseKg(f.value) ?? f.fallback ?? 0) + dir * 2.5))
      : String(Math.max(0, (parseReps(f.value) ?? f.fallback ?? 0) + dir));
  fresh = false;
  current = { ...f, value: text };
  f.onChange(text);
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

type Props = {
  /** The screen's scroll view, so the pad can move the open box above itself. */
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  /** The scroll view's current offset (kept up to date by the screen's onScroll). */
  scrollY?: RefObject<number>;
};

export function NumberPad({ scrollRef, scrollY }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const activeId = useActivePadId();
  const [height, setHeight] = useState(320);
  const field = current;
  const lastScrolled = useRef<string | null>(null);

  // Close the pad when the screen goes away.
  useEffect(() => () => closePad(), []);

  // Scroll the open box into view above the pad.
  useEffect(() => {
    if (!activeId || !field?.measure || !scrollRef?.current || lastScrolled.current === activeId) return;
    lastScrolled.current = activeId;
    field.measure((y, h) => {
      const padTop = Dimensions.get('window').height - height;
      const overlap = y + h + spacing.lg - padTop;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: (scrollY?.current ?? 0) + overlap, animated: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, height]);
  useEffect(() => {
    if (!activeId) lastScrolled.current = null;
  }, [activeId]);

  if (!activeId || !field) return null;

  const keyStyle = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: pressed ? colors.cardAlt : colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  });
  const barBtn = ({ pressed }: { pressed: boolean }) => ({
    minWidth: 56,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: pressed ? colors.cardAlt : colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  });

  return (
    <Animated.View
      entering={SlideInDown.duration(220)}
      exiting={SlideOutDown.duration(180)}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        gap: spacing.sm,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable onPress={() => step(-1)} style={barBtn} accessibilityLabel="Decrease">
          <AppText variant="label">−</AppText>
        </Pressable>
        <Pressable onPress={() => step(1)} style={barBtn} accessibilityLabel="Increase">
          <AppText variant="label">+</AppText>
        </Pressable>
        <AppText variant="small" muted style={{ flex: 1, textAlign: 'center' }}>
          {field.kind === 'kg' ? 'Weight · ±2.5 kg' : 'Reps · ±1'}
        </AppText>
        {field.onNext ? (
          <Pressable onPress={field.onNext} style={barBtn} accessibilityLabel="Next: reps">
            <AppText variant="label" color={colors.accent}>
              Next
            </AppText>
          </Pressable>
        ) : null}
        <Pressable onPress={closePad} style={barBtn} accessibilityLabel="Done">
          <AppText variant="label" color={colors.accent}>
            Done
          </AppText>
        </Pressable>
      </View>

      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {KEYS.slice(row * 3, row * 3 + 3).map((k) => {
            const disabled = k === '.' && field.kind === 'reps';
            return (
              <Pressable
                key={k}
                onPress={() => press(k)}
                onLongPress={k === 'back' ? () => { fresh = true; press('back'); } : undefined}
                disabled={disabled}
                accessibilityLabel={k === 'back' ? 'Delete' : k === '.' ? 'Decimal point' : k}
                style={(s) => [keyStyle(s), disabled && { opacity: 0.3 }]}>
                {k === 'back' ? (
                  <SymbolView name="delete.left" size={22} tintColor={colors.text} />
                ) : (
                  <AppText variant="heading" maxFontSizeMultiplier={1.2}>
                    {k}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

/** Space to leave at the bottom of a scroll view so the last rows can sit above the pad. */
export function usePadSpacer() {
  return useActivePadId() ? 340 : 0;
}

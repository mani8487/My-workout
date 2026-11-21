/**
 * A vertical list you can reorder by dragging.
 *
 * Hold an item's handle (the ≡ icon) for a moment, then drag it up or down.
 * The other items slide out of the way; letting go calls `onReorder` with the
 * new order. Items can have different heights.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SPRING_RELEASE, SPRING_SETTLE } from '@/theme/motion';
import { useTheme } from '@/theme/theme-context';

type Layout = { y: number; h: number };

/** Where the dragged item would land, given its current centre. */
function targetIndex(layouts: Layout[], from: number, ty: number) {
  'worklet';
  const l = layouts[from];
  if (!l) return from;
  const centre = l.y + l.h / 2 + ty;
  let to = from;
  for (let j = 0; j < layouts.length; j++) {
    const o = layouts[j];
    if (!o) continue;
    if (j > from && centre > o.y + o.h / 2) to = j;
    if (j < from && centre < o.y + o.h / 2 && to >= from) to = j;
  }
  return to;
}

export function DragList<T>({
  items,
  keyOf,
  gap,
  onReorder,
  renderItem,
}: {
  items: T[];
  keyOf: (item: T) => string | number;
  gap: number;
  onReorder: (from: number, to: number) => void;
  /** `handle` is the drag grip; place it inside the item where it fits. */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const layouts = useSharedValue<Layout[]>([]);
  const dragging = useSharedValue(-1);
  const dragY = useSharedValue(0);
  // Bumped after each drop so every item resets its offset together with the new order.
  const [generation, setGeneration] = useState(0);

  // Forget the sizes of items that have been removed.
  useEffect(() => {
    layouts.value = layouts.value.slice(0, items.length);
  }, [items.length, layouts]);

  function drop(from: number, to: number) {
    dragging.value = -1;
    dragY.value = 0;
    if (from !== to) onReorder(from, to);
    setGeneration((g) => g + 1);
  }

  return (
    <View style={{ gap }}>
      {items.map((item, i) => (
        <DragItem
          key={`${keyOf(item)}-${generation}`}
          index={i}
          gap={gap}
          layouts={layouts}
          dragging={dragging}
          dragY={dragY}
          onDrop={drop}
          render={(handle) => renderItem(item, i, handle)}
          canMoveUp={i > 0}
          canMoveDown={i < items.length - 1}
        />
      ))}
    </View>
  );
}

function DragItem({
  index,
  gap,
  layouts,
  dragging,
  dragY,
  onDrop,
  render,
  canMoveUp,
  canMoveDown,
}: {
  index: number;
  gap: number;
  layouts: SharedValue<Layout[]>;
  dragging: SharedValue<number>;
  dragY: SharedValue<number>;
  onDrop: (from: number, to: number) => void;
  render: (handle: ReactNode) => ReactNode;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { colors } = useTheme();
  const lifted = useSharedValue(0);

  const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  const tick = () => Haptics.selectionAsync().catch(() => {});
  const lastTarget = useSharedValue(index);

  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      dragging.set(index);
      dragY.set(0);
      lastTarget.value = index;
      lifted.value = withTiming(1, { duration: 120 });
      scheduleOnRN(buzz);
    })
    .onUpdate((e) => {
      dragY.set(e.translationY);
      const t = targetIndex(layouts.value, index, e.translationY);
      if (t !== lastTarget.value) {
        lastTarget.value = t;
        scheduleOnRN(tick);
      }
    })
    .onEnd((e) => {
      const to = targetIndex(layouts.value, index, dragY.value);
      const ls = layouts.value;
      // Slide into the gap it opened, then hand the new order to the list.
      const dest = to === index ? 0 : to > index ? ls[to].y + ls[to].h - (ls[index].y + ls[index].h) : ls[to].y - ls[index].y;
      // Spring carries the finger's speed into the drop, and never overshoots the slot.
      dragY.set(withSpring(dest, { ...SPRING_RELEASE, duration: 300, velocity: e.velocityY, overshootClamping: true }, () => {
        scheduleOnRN(onDrop, index, to);
      }));
      lifted.value = withTiming(0, { duration: 160 });
    });

  const style = useAnimatedStyle(() => {
    const d = dragging.value;
    if (d === index) {
      return {
        zIndex: 10,
        transform: [{ translateY: dragY.value }, { scale: 1 + lifted.value * 0.03 }],
        shadowOpacity: lifted.value * 0.25,
      };
    }
    let shift = 0;
    if (d >= 0) {
      const h = (layouts.value[d]?.h ?? 0) + gap;
      const to = targetIndex(layouts.value, d, dragY.value);
      if (d < index && index <= to) shift = -h;
      if (to <= index && index < d) shift = h;
    }
    return { zIndex: 0, transform: [{ translateY: withSpring(shift, SPRING_SETTLE) }, { scale: 1 }], shadowOpacity: 0 };
  });

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        hitSlop={10}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Reorder. Hold and drag, or swipe up or down"
        accessibilityActions={[
          ...(canMoveUp ? [{ name: 'increment', label: 'Move up' }] : []),
          ...(canMoveDown ? [{ name: 'decrement', label: 'Move down' }] : []),
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && canMoveUp) onDrop(index, index - 1);
          if (e.nativeEvent.actionName === 'decrement' && canMoveDown) onDrop(index, index + 1);
        }}
        style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
        <SymbolView name="line.3.horizontal" size={18} tintColor={colors.textMuted} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        const next = layouts.value.slice();
        next[index] = { y, h: height };
        layouts.set(next);
      }}
      style={[{ shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, style]}>
      {render(handle)}
    </Animated.View>
  );
}

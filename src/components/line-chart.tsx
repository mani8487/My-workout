/** A simple, calm line chart: one line in the accent colour, dots per workout, min/max labels. */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

type Point = { x: number; y: number };

export function LineChart({
  points,
  formatY,
  formatX,
  height = 180,
}: {
  points: Point[];
  formatY: (v: number) => string;
  formatX: (v: number) => string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <AppText muted>No workouts in this range yet.</AppText>
      </View>
    );
  }

  const pad = 8;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  let [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const sx = (x: number) => (maxX === minX ? width / 2 : pad + ((x - minX) / (maxX - minX)) * (width - pad * 2));
  const sy = (y: number) => pad + (1 - (y - minY) / (maxY - minY)) * (height - pad * 2);
  const coords = points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ justifyContent: 'space-between', paddingVertical: pad - 6 }}>
          <AppText variant="small" muted>
            {formatY(maxY)}
          </AppText>
          <AppText variant="small" muted>
            {formatY(minY)}
          </AppText>
        </View>
        <View style={{ flex: 1, height }} onLayout={onLayout}>
          {width > 0 && (
            <Svg width={width} height={height}>
              <Line x1={0} y1={sy(maxY)} x2={width} y2={sy(maxY)} stroke={colors.border} strokeWidth={1} />
              <Line x1={0} y1={sy(minY)} x2={width} y2={sy(minY)} stroke={colors.border} strokeWidth={1} />
              {points.length > 1 && (
                <Polyline points={coords} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" />
              )}
              {points.map((p, i) => (
                <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={colors.accent} />
              ))}
            </Svg>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 40 }}>
        <AppText variant="small" muted>
          {formatX(minX)}
        </AppText>
        {maxX !== minX && (
          <AppText variant="small" muted>
            {formatX(maxX)}
          </AppText>
        )}
      </View>
    </View>
  );
}

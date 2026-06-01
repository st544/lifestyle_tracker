import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

interface Props {
  /** Days trained this week. */
  value: number;
  /** Denominator for the ring fill (default 7). */
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
}

/**
 * Tiny circular progress ring for "days trained this week". Minimal text —
 * just the count in the center.
 */
export function WeekDaysRing({
  value, max = 7, size = 40, stroke = 5, color = colors.success,
}: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const dash = circ * pct;
  const cx = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {dash > 0 && (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )}
      </Svg>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  value: {
    position: 'absolute',
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
});

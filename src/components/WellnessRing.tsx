import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from 'react-native-reanimated';
import { colors, fontSize } from '../theme';
import { wellnessBand } from '../wellness';
import { AnimatedNumber } from './AnimatedNumber';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number | null;   // 0-100, or null = no recovery data logged
  size?: number;
  stroke?: number;
  /** Sub-label below the number. */
  caption?: string;
}

/**
 * Circular gauge for the composite wellness score. Animated draw on mount /
 * value change; color comes from the wellness band. When `score` is null
 * (no HRV/sleep logged) it shows a muted "—" no-data state.
 */
export function WellnessRing({ score, size = 110, stroke = 10, caption }: Props) {
  const r = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  const band = score != null ? wellnessBand(score) : { label: 'No data', color: colors.textFaint };

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(score != null ? score / 100 : 0, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [score, progress]);

  const ringProps = useAnimatedProps(() => ({
    strokeDasharray: [circumference, circumference] as any,
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* track */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none"
        />
        {/* progress */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={band.color} strokeWidth={stroke} strokeLinecap="round" fill="none"
          rotation={-90} origin={`${size / 2}, ${size / 2}`}
          animatedProps={ringProps}
        />
      </Svg>
      <View style={styles.centerOverlay}>
        {score != null ? (
          <AnimatedNumber
            value={score}
            duration={900}
            style={[styles.value, { color: band.color }]}
          />
        ) : (
          <Text style={[styles.value, { color: band.color }]}>—</Text>
        )}
        <Text style={styles.band}>{band.label.toUpperCase()}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  centerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  value: { fontSize: 30, fontWeight: '900', letterSpacing: -1, minWidth: 50, textAlign: 'center' },
  band: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: -2 },
  caption: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
});

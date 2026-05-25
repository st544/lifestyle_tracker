import React, { useEffect, useRef } from 'react';
import { TextStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring,
} from 'react-native-reanimated';

interface Props {
  value: number;
  style?: TextStyle | TextStyle[];
}

/**
 * Static number that briefly pulses (scale 1 → 1.18 → 1) whenever the value
 * changes. Replaces AnimatedNumber for small-integer stat displays where the
 * old count-up-from-zero felt jittery on each screen open.
 *
 * No animation on first mount — only on subsequent value changes.
 */
export function PulseNumber({ value, style }: Props) {
  const scale = useSharedValue(1);
  const prev = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (prev.current !== undefined && prev.current !== value) {
      scale.value = withSequence(
        withSpring(1.18, { damping: 6, stiffness: 240 }),
        withSpring(1.0, { damping: 10, stiffness: 200 }),
      );
    }
    prev.current = value;
  }, [value, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[style, styles.base, animStyle]}>
      {value}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false as any },
});

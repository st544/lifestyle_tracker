import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withSequence, withTiming, Easing, withDelay,
} from 'react-native-reanimated';
import { zelda } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  size?: number;
  /** Change this to replay. */
  trigger: number | string;
}

const CHECK_LENGTH = 36; // approximate path length for stroke-dash animation

/**
 * Magical-style checkmark draw with a glowing circle that pulses.
 * Use as a one-off success indicator (e.g. overlay on the Save button
 * for ~700ms after save, before navigating away).
 */
export function SaveCheckmark({ size = 56, trigger }: Props) {
  const circleProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);
  const ringPulse = useSharedValue(0);

  useEffect(() => {
    circleProgress.value = 0;
    checkProgress.value = 0;
    ringPulse.value = 0;

    circleProgress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    checkProgress.value = withDelay(
      220,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })
    );
    ringPulse.value = withDelay(
      280,
      withSequence(
        withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) })
      )
    );
  }, [trigger, circleProgress, checkProgress, ringPulse]);

  const r = size / 2 - 2;
  const circumference = 2 * Math.PI * r;

  const circleProps = useAnimatedProps(() => ({
    strokeDasharray: [circumference, circumference] as any,
    strokeDashoffset: circumference * (1 - circleProgress.value),
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDasharray: [CHECK_LENGTH, CHECK_LENGTH] as any,
    strokeDashoffset: CHECK_LENGTH * (1 - checkProgress.value),
  }));

  const ringProps = useAnimatedProps(() => ({
    r: r + ringPulse.value * 10,
    opacity: ringPulse.value * 0.5,
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* pulsing aura */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={zelda.triforceGold}
          strokeWidth={2}
          fill="none"
          animatedProps={ringProps}
        />
        {/* solid ring drawing in */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={zelda.triforceGold}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          animatedProps={circleProps}
          // Start drawing from top
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        {/* check */}
        <AnimatedPath
          d={`M ${size * 0.28} ${size * 0.52} L ${size * 0.46} ${size * 0.7} L ${size * 0.74} ${size * 0.34}`}
          stroke={zelda.triforceGold}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          animatedProps={checkProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

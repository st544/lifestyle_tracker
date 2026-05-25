import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, Easing,
} from 'react-native-reanimated';

interface Props {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** initial Y offset; positive = enters from below */
  fromY?: number;
  /** use spring instead of timing for the translate */
  spring?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Fade + slide-up entrance. Stagger multiple by giving incremental delays.
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 420,
  fromY = 12,
  spring = false,
  style,
}: Props) {
  const op = useSharedValue(0);
  const ty = useSharedValue(fromY);

  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(
      delay,
      spring
        ? withSpring(0, { damping: 14, stiffness: 140 })
        : withTiming(0, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, duration, fromY, spring, op, ty]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming, Easing,
} from 'react-native-reanimated';

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  focused: boolean;
}

/**
 * Tab bar icon that bounces a tiny spring when its tab becomes focused.
 */
export function AnimatedTabIcon({ name, color, size, focused }: Props) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.22, { damping: 6, stiffness: 220 }),
        withSpring(1.0, { damping: 10, stiffness: 200 }),
      );
      translateY.value = withSequence(
        withTiming(-3, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [focused, scale, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name={name} color={color} size={size} />
    </Animated.View>
  );
}

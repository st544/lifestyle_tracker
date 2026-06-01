import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming, Easing,
} from 'react-native-reanimated';
import { colors } from '../theme';

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  focused: boolean;
}

/**
 * Tab bar icon with two upgrades:
 *   1. A pill background appears behind the icon when its tab is focused.
 *   2. The icon springs/translates briefly each time it becomes focused.
 *
 * Used for every tab EXCEPT the center "Add" tab, which has its own custom
 * elevated FAB button registered as `tabBarButton` directly.
 */
export function AnimatedTabIcon({ name, color, size, focused }: Props) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const pillOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    pillOpacity.value = withTiming(focused ? 1 : 0, { duration: 200 });
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
  }, [focused, scale, translateY, pillOpacity]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    backgroundColor: color + '22',
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Ionicons name={name} color={color} size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: 4,
  },
  pill: {
    position: 'absolute',
    width: 48,
    height: 28,
    borderRadius: 14,
  },
});

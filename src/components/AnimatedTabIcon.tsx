import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, withTiming, Easing,
} from 'react-native-reanimated';

interface Props {
  /** The OUTLINE variant name (e.g. "today-outline"). The filled variant is
   *  derived automatically when the tab is focused. */
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  focused: boolean;
}

/**
 * Tab bar icon:
 *   1. Outline glyph when idle → FILLED glyph when focused (derived by
 *      stripping the "-outline" suffix) — the standard active/inactive polish.
 *   2. A soft tinted pill (background + hairline border) fades in behind the
 *      focused icon.
 *   3. The icon springs up briefly each time it becomes focused.
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
        withSpring(1.18, { damping: 7, stiffness: 240 }),
        withSpring(1.0, { damping: 11, stiffness: 220 }),
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
    backgroundColor: color + '1F',
    borderColor: color + '4D',
  }));

  // Filled variant when active ("today-outline" → "today").
  const glyph = (focused && name.endsWith('-outline')
    ? name.slice(0, -'-outline'.length)
    : name) as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Ionicons name={glyph} color={color} size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    paddingVertical: 4,
  },
  pill: {
    position: 'absolute',
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
});

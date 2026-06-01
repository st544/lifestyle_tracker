import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring,
} from 'react-native-reanimated';
import { colors } from '../theme';
import * as haptics from '../haptics';

/**
 * Custom tab bar button for the center "Add" tab. Renders an elevated
 * primary-color filled circle that visually breaks out of the tab bar — the
 * universal FAB-style pattern for the primary action.
 *
 * Receives the standard React Navigation tabBarButton props.
 */
export function ElevatedAddTab(props: any) {
  const { accessibilityState, onPress } = props;
  const focused = !!accessibilityState?.selected;

  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.1, { damping: 6, stiffness: 220 }),
        withSpring(1.0, { damping: 10, stiffness: 200 }),
      );
    }
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={(e) => { haptics.tick(); onPress?.(e); }}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Add"
    >
      <Animated.View style={[styles.circle, focused && styles.circleFocused, animStyle]}>
        <Ionicons name="add" size={30} color="#0B0F14" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    // Raise above the tab bar baseline. The tab bar's overflow has to be
    // visible for the elevated portion to actually render outside.
    marginTop: -14,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Lift it visually
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    // Subtle outline to separate it from the tab bar surface
    borderWidth: 3,
    borderColor: colors.bg,
  },
  circleFocused: {
    // Slight emphasis when active. Keep it understated — the elevation is
    // already plenty of visual weight.
    shadowOpacity: 0.6,
  },
});

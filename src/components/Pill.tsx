import React from 'react';
import { Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated';
import { colors, radius, fontSize, spacing } from '../theme';
import * as haptics from '../haptics';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  small?: boolean;
  style?: ViewStyle;
}

export function Pill({ label, selected, onPress, color, small, style }: Props) {
  const active = !!selected;
  const tint = color ?? colors.primary;
  const bg = active ? tint : colors.surfaceAlt;
  const border = active ? tint : colors.border;
  const textColor = active ? '#0B0F14' : colors.text;

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onIn = () => {
    scale.value = withTiming(0.94, { duration: 80 });
  };
  const onOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 320 });
  };
  const handlePress = () => {
    haptics.tap();
    onPress?.();
  };

  const content = (
    <Animated.View
      style={[
        styles.pill,
        small && styles.pillSmall,
        { backgroundColor: bg, borderColor: border },
        animatedStyle,
        style,
      ]}
    >
      <Text style={[styles.label, small && styles.labelSmall, { color: textColor }]}>{label}</Text>
    </Animated.View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={handlePress} onPressIn={onIn} onPressOut={onOut}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: fontSize.xs,
  },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing, zelda } from '../theme';
import { SupplementKey, SUPPLEMENTS } from '../types';
import * as haptics from '../haptics';

interface Props {
  values: Partial<Record<SupplementKey, boolean>>;
  onToggle: (k: SupplementKey, next: boolean) => void;
}

export function SupplementsRow({ values, onToggle }: Props) {
  return (
    <View style={styles.row}>
      {SUPPLEMENTS.map((s) => (
        <SupplementToggle
          key={s.key}
          k={s.key}
          label={s.label}
          on={!!values[s.key]}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
}

function SupplementToggle({
  k, label, on, onToggle,
}: {
  k: SupplementKey;
  label: string;
  on: boolean;
  onToggle: (k: SupplementKey, next: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handle = () => {
    haptics.tick();
    scale.value = withSpring(1.1, { damping: 5, stiffness: 240 });
    setTimeout(() => { scale.value = withSpring(1, { damping: 10, stiffness: 200 }); }, 50);
    onToggle(k, !on);
  };
  const onIn = () => { scale.value = withTiming(0.94, { duration: 80 }); };
  const onOut = () => { scale.value = withSpring(1, { damping: 10, stiffness: 240 }); };

  return (
    <Pressable onPress={handle} onPressIn={onIn} onPressOut={onOut} style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.btn,
          on && { backgroundColor: zelda.rupeeGreen + '33', borderColor: zelda.rupeeGreen },
          style,
        ]}
      >
        <Ionicons
          name={on ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={on ? zelda.rupeeGreen : colors.textDim}
        />
        <Text style={[styles.label, on && { color: colors.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  label: { color: colors.textDim, fontWeight: '700', fontSize: fontSize.xs },
});

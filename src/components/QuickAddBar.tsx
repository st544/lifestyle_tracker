import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSize, spacing, typeColors, typeIcons } from '../theme';
import { SessionType } from '../types';
import { QUICK_ADD_TYPES } from '../defaults';
import * as haptics from '../haptics';

interface Props {
  onPick: (type: SessionType) => void;
  targetLabel?: string;
}

export function QuickAddBar({ onPick, targetLabel }: Props) {
  return (
    <View>
      {targetLabel ? (
        <Text style={styles.headline}>Quick add {targetLabel}</Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {QUICK_ADD_TYPES.map((t) => (
          <QuickAddButton key={t} type={t} onPress={onPick} />
        ))}
      </ScrollView>
    </View>
  );
}

function QuickAddButton({ type, onPress }: { type: SessionType; onPress: (t: SessionType) => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onIn = () => { scale.value = withTiming(0.92, { duration: 80 }); };
  const onOut = () => { scale.value = withSpring(1, { damping: 11, stiffness: 320 }); };
  const handle = () => { haptics.tick(); onPress(type); };

  return (
    <Pressable onPressIn={onIn} onPressOut={onOut} onPress={handle}>
      <Animated.View style={[styles.btn, { borderColor: typeColors[type] }, style]}>
        <Ionicons name={typeIcons[type] as any} size={18} color={typeColors[type]} />
        <Text style={styles.label}>+ {type}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headline: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
});

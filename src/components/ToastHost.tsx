import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ToastEntry, ToastType, subscribe, toast } from '../toast';
import { colors, fontSize, radius, spacing, zelda } from '../theme';

/**
 * Renders a stack of in-flight toasts at the bottom of the screen, above the
 * tab bar. Mounted ONCE at the app root (inside SafeAreaProvider). Subscribes
 * to the toast singleton — each new entry animates in (slide-up + fade);
 * each removal animates out.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  useEffect(() => subscribe(setEntries), []);

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 78 }]}>
      {entries.map((entry) => (
        <ToastItem key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

function ToastItem({ entry }: { entry: ToastEntry }) {
  const op = useSharedValue(0);
  const ty = useSharedValue(20);

  useEffect(() => {
    op.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    ty.value = withSpring(0, { damping: 14, stiffness: 180 });
    return () => {
      op.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(20, { duration: 180 });
    };
  }, [entry.id, op, ty]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));

  const meta = TYPE_META[entry.type];

  return (
    <Animated.View style={[styles.toast, { borderColor: meta.color + '66' }, animStyle]}>
      <Pressable style={styles.toastInner} onPress={() => toast.dismiss(entry.id)}>
        <Ionicons name={meta.icon as any} size={16} color={meta.color} />
        <Text style={styles.message} numberOfLines={2}>{entry.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const TYPE_META: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: 'checkmark-circle', color: zelda.rupeeGreen },
  error:   { icon: 'alert-circle',     color: colors.danger },
  warn:    { icon: 'warning',          color: zelda.triforceGold },
  info:    { icon: 'information-circle', color: colors.primary },
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: '80%',
    maxWidth: '100%',
    // Slight elevation
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

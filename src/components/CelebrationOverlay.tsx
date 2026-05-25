import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence, withDelay, Easing, withRepeat,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing, zelda } from '../theme';
import { TriforceIcon } from './TriforceIcon';
import { TriforceBurst } from './TriforceBurst';
import * as haptics from '../haptics';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Big headline, e.g. "BJJ — 4 WEEK STREAK" */
  headline: string;
  /** Smaller line under the headline. */
  subline?: string;
  /** Optional icon name to show below the triforce. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

/**
 * Zelda "item get" style overlay. Used for streak milestones
 * (4w / 12w / 52w) and big personal records.
 *
 * Tap to dismiss.
 */
export function CelebrationOverlay({
  visible, onDismiss, headline, subline, icon, iconColor,
}: Props) {
  const scale = useSharedValue(0.6);
  const op = useSharedValue(0);
  const glowSpin = useSharedValue(0);
  const burstKey = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      haptics.success();
      op.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      scale.value = withSequence(
        withSpring(1.05, { damping: 8, stiffness: 120 }),
        withSpring(1.0, { damping: 12, stiffness: 140 }),
      );
      glowSpin.value = 0;
      glowSpin.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
      burstKey.value = Date.now();
    } else {
      op.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.6, { duration: 200 });
    }
  }, [visible, op, scale, glowSpin, burstKey]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: op.value * 0.85 }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${glowSpin.value * 360}deg` }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.root} onPress={onDismiss}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.iconWrap}>
            <Animated.View style={[styles.glowRing, glowStyle]} />
            <TriforceIcon size={96} glow />
          </View>
          <Text style={styles.eyebrow}>★  ACHIEVEMENT UNLOCKED  ★</Text>
          <Text style={styles.headline}>{headline}</Text>
          {subline ? <Text style={styles.subline}>{subline}</Text> : null}
          {icon ? (
            <View style={styles.iconRow}>
              <Ionicons name={icon} size={20} color={iconColor ?? zelda.triforceGold} />
            </View>
          ) : null}
          <Text style={styles.dismiss}>tap anywhere to continue</Text>
          <TriforceBurst trigger={visible ? 'open' : 'closed'} count={26} radius={170} durationMs={1100} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  card: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: zelda.triforceGold,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: zelda.triforceGold,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  glowRing: {
    position: 'absolute',
    width: 140, height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: zelda.triforceGold,
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  eyebrow: {
    color: zelda.triforceGold,
    fontSize: fontSize.xs,
    letterSpacing: 3,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  headline: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subline: {
    color: colors.textDim,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  iconRow: { marginTop: spacing.md },
  dismiss: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    marginTop: spacing.xl,
    letterSpacing: 1,
  },
});

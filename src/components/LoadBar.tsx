import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, radius, fontSize, spacing } from '../theme';
import { getLoadZone } from '../load';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  completedPercent: number;
  projectedPercent: number;
  label?: string;
  /** Pass false to skip the count-up animation (e.g. mid-form previews). */
  animate?: boolean;
}

export function LoadBar({ completedPercent, projectedPercent, label, animate = true }: Props) {
  const zone = getLoadZone(projectedPercent);
  const cap = Math.max(120, projectedPercent + 10);

  // Width values 0..100 of the visible bar
  const completedW = useSharedValue(0);
  const projectedExtraW = useSharedValue(0);
  // Pulse opacity layer used on zone change
  const flash = useSharedValue(0);

  // Track previous zone to detect transitions
  const prevZoneRef = useRef(zone.key);

  useEffect(() => {
    const targetCompleted = Math.min(100, (completedPercent / cap) * 100);
    const targetProjected = Math.min(
      100 - targetCompleted,
      Math.max(0, ((projectedPercent - completedPercent) / cap) * 100)
    );

    if (animate) {
      completedW.value = withTiming(targetCompleted, { duration: 700, easing: Easing.out(Easing.cubic) });
      projectedExtraW.value = withTiming(targetProjected, { duration: 850, easing: Easing.out(Easing.cubic) });
    } else {
      completedW.value = targetCompleted;
      projectedExtraW.value = targetProjected;
    }

    // Zone-transition flash
    if (prevZoneRef.current !== zone.key) {
      flash.value = withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }),
      );
      prevZoneRef.current = zone.key;
    }
  }, [completedPercent, projectedPercent, cap, animate, completedW, projectedExtraW, flash, zone.key]);

  const completedStyle = useAnimatedStyle(() => ({
    width: `${completedW.value}%`,
    backgroundColor: zone.color,
  }));
  const projectedStyle = useAnimatedStyle(() => ({
    width: `${projectedExtraW.value}%`,
    backgroundColor: zone.color + '66',
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.55,
    backgroundColor: zone.color,
  }));

  return (
    <View>
      {label ? (
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.zone, { color: zone.color }]}>{zone.label}</Text>
        </View>
      ) : null}
      <View style={styles.track}>
        {/* 100% marker */}
        <View
          style={[
            styles.marker,
            { left: `${Math.min(100, (100 / cap) * 100)}%` },
          ]}
        />
        <Animated.View style={[styles.completed, completedStyle]} />
        <Animated.View style={[styles.projected, projectedStyle]} />
        <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />
      </View>
      <View style={styles.row}>
        <View style={styles.inline}>
          {animate ? (
            <AnimatedNumber
              value={completedPercent}
              style={styles.valueNum}
              suffix="%"
            />
          ) : (
            <Text style={styles.valueNum}>{Math.round(completedPercent)}%</Text>
          )}
          <Text style={styles.valueSuffix}> completed</Text>
        </View>
        <View style={styles.inline}>
          {animate ? (
            <AnimatedNumber
              value={projectedPercent}
              style={styles.valueDimNum}
              suffix="%"
            />
          ) : (
            <Text style={styles.valueDimNum}>{Math.round(projectedPercent)}%</Text>
          )}
          <Text style={styles.valueDimSuffix}> projected</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inline: { flexDirection: 'row', alignItems: 'baseline' },
  label: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  zone: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  valueNum: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 4,
    minWidth: 36,
  },
  valueSuffix: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginTop: 4,
  },
  valueDimNum: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 4,
    minWidth: 36,
    textAlign: 'right',
  },
  valueDimSuffix: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: 4,
  },
  track: {
    height: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  completed: { height: '100%' },
  projected: { height: '100%' },
  flash: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: 'absolute',
    width: 2,
    top: 0,
    bottom: 0,
    backgroundColor: colors.textFaint,
    zIndex: 5,
  },
});

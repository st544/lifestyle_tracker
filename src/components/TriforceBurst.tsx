import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import Svg, { Polygon, Circle } from 'react-native-svg';
import { rupeePalette, zelda } from '../theme';

interface Props {
  /** When this number changes, a new burst plays. Pass Date.now() or a counter. */
  trigger: number | string;
  count?: number;
  radius?: number;
  durationMs?: number;
  /** Optional bias color (will be mixed with rupee palette). */
  color?: string;
  style?: ViewStyle;
}

interface Particle {
  angle: number;
  distance: number;
  color: string;
  size: number;
  rotation: number;
  shape: 'triforce' | 'rupee' | 'spark';
  delay: number;
  duration: number;
}

/**
 * A "Triforce burst" — a brief shower of golden triforce triangles,
 * rupee diamonds, and sparkle dots radiating from center.
 *
 * Renders absolutely positioned over its parent — give the parent
 * position: 'relative' and the burst will appear centered.
 */
export function TriforceBurst({
  trigger, count = 18, radius = 110, durationMs = 850, color, style,
}: Props) {
  // Re-generate particle set when trigger changes
  const particles = useMemo<Particle[]>(() => {
    const out: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.6;
      const shapeRoll = Math.random();
      const shape: Particle['shape'] =
        shapeRoll < 0.5 ? 'triforce' : shapeRoll < 0.85 ? 'rupee' : 'spark';
      out.push({
        angle: baseAngle + jitter,
        distance: radius * (0.6 + Math.random() * 0.7),
        color: color && Math.random() < 0.4
          ? color
          : rupeePalette[Math.floor(Math.random() * rupeePalette.length)],
        size: 10 + Math.random() * 10,
        rotation: Math.random() * 360,
        shape,
        delay: Math.random() * 90,
        duration: durationMs * (0.85 + Math.random() * 0.4),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      {particles.map((p, idx) => (
        <Particle key={`${trigger}-${idx}`} p={p} />
      ))}
    </View>
  );
}

function Particle({ p }: { p: Particle }) {
  const progress = useSharedValue(0);
  const dx = Math.cos(p.angle) * p.distance;
  const dy = Math.sin(p.angle) * p.distance;

  useEffect(() => {
    progress.value = withDelay(
      p.delay,
      withTiming(1, { duration: p.duration, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, p.delay, p.duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const easeOut = 1 - Math.pow(1 - t, 3);
    return {
      transform: [
        { translateX: dx * easeOut },
        { translateY: dy * easeOut - 28 * t * (1 - t) /* slight arc */ },
        { rotate: `${p.rotation + 360 * t}deg` },
        { scale: t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4) * 0.7 },
      ],
      opacity: t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15,
    };
  });

  return (
    <Animated.View style={[styles.particle, animatedStyle]}>
      <Shape kind={p.shape} size={p.size} color={p.color} />
    </Animated.View>
  );
}

function Shape({ kind, size, color }: { kind: Particle['shape']; size: number; color: string }) {
  if (kind === 'triforce') {
    const pts = `${size / 2},0 ${size},${size} 0,${size}`;
    return (
      <Svg width={size} height={size}>
        <Polygon
          points={pts}
          fill={color}
          stroke={zelda.triforceGoldDeep}
          strokeWidth={1}
        />
      </Svg>
    );
  }
  if (kind === 'rupee') {
    const pts = `${size / 2},0 ${size},${size / 2} ${size / 2},${size} 0,${size / 2}`;
    return (
      <Svg width={size} height={size}>
        <Polygon points={pts} fill={color} opacity={0.95} />
      </Svg>
    );
  }
  // spark
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size / 4} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  particle: {
    position: 'absolute',
  },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../types';
import { colors, radius, fontSize, spacing, typeColors, typeIcons } from '../theme';
import { formatTime } from '../dates';
import { calculateLoadScore } from '../load';
import * as haptics from '../haptics';

interface Props {
  session: Session;
  onPress?: () => void;
  compact?: boolean;
}

export function SessionCard({ session, onPress, compact }: Props) {
  const color = typeColors[session.type];
  const score = session.loadScore ?? calculateLoadScore(session);
  const status = session.status;

  const statusColor =
    status === 'Completed' ? colors.success
    : status === 'Skipped' ? colors.danger
    : status === 'Moved' ? colors.warn
    : status === 'Partial' ? colors.warn
    : colors.textDim;

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onIn = () => { scale.value = withTiming(0.97, { duration: 90 }); };
  const onOut = () => { scale.value = withSpring(1, { damping: 12, stiffness: 280 }); };
  const handle = () => { haptics.tap(); onPress?.(); };

  return (
    <Pressable
      onPress={handle}
      onPressIn={onIn}
      onPressOut={onOut}
    >
    <Animated.View
      style={[
        styles.card,
        compact && styles.cardCompact,
        animStyle,
      ]}
    >
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.titleRow}>
            <Ionicons name={typeIcons[session.type] as any} color={color} size={18} />
            <Text style={styles.title}>{session.type}</Text>
            {session.subtype ? (
              <Text style={styles.subtype}>· {session.subtype}</Text>
            ) : session.type === 'Hiking' && session.hikingDifficulty ? (
              <Text style={styles.subtype}>· {session.hikingDifficulty}</Text>
            ) : null}
          </View>
          <Text style={[styles.status, { color: statusColor }]}>
            {status}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {session.startTime ? (
            <Text style={styles.meta}>{formatTime(session.startTime)}</Text>
          ) : null}
          <Text style={styles.meta}>{session.durationMinutes} min</Text>
          {(session.type === 'Run' || session.type === 'Hiking') && typeof session.miles === 'number' ? (
            <Text style={styles.meta}>{session.miles.toFixed(1)} mi</Text>
          ) : null}
          {session.type === 'Hiking' && typeof session.elevationGainFeet === 'number' && session.elevationGainFeet > 0 ? (
            <Text style={styles.meta}>{Math.round(session.elevationGainFeet)} ft</Text>
          ) : null}
          {typeof session.activeCalories === 'number' && session.activeCalories > 0 ? (
            <Text style={styles.meta}>{Math.round(session.activeCalories)} cal</Text>
          ) : null}
          {session.intensity !== undefined && session.intensity > 0
            && session.type !== 'Run' && session.type !== 'Hiking' ? (
            <Text style={styles.meta}>RPE {session.intensity}</Text>
          ) : null}
          {session.location ? (
            <Text style={styles.metaDim} numberOfLines={1}>
              {session.location}
            </Text>
          ) : session.type === 'Hiking' && session.trailName ? (
            <Text style={styles.metaDim} numberOfLines={1}>
              {session.trailName}
            </Text>
          ) : null}
        </View>
        {score > 0 ? (
          <Text style={styles.score}>Load {score}</Text>
        ) : null}
        {session.notes && !compact ? (
          <Text style={styles.notes} numberOfLines={2}>{session.notes}</Text>
        ) : null}
      </View>
    </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompact: {
    borderRadius: radius.md,
  },
  bar: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
    fontSize: fontSize.lg,
  },
  subtype: {
    color: colors.textDim,
    fontSize: fontSize.md,
  },
  status: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: 2,
  },
  meta: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  metaDim: {
    color: colors.textDim,
    fontSize: fontSize.sm,
  },
  score: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  notes: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: 4,
  },
});

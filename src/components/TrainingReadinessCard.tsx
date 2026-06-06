import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, radius, spacing } from '../theme';
import { ReadinessBreakdown, readinessBand, TrendDirection } from '../readiness';
import { WellnessRing } from './WellnessRing';
import { LoadBar } from './LoadBar';
import { TypewriterText } from './TypewriterText';
import { AnimatedNumber } from './AnimatedNumber';
import { getLoadZone } from '../load';
import * as haptics from '../haptics';

interface Props {
  readiness: ReadinessBreakdown;
  onPress?: () => void;

  // --- Optional "Today's read" section (merged from the old smart-message card)
  smartMessage?: string;
  completedPercent?: number;
  projectedPercent?: number;
}

/**
 * Combined Today-screen card: readiness ring + component breakdown + verdict,
 * plus an optional "Today's read" sub-section (smart message + big COMPLETED %
 * + LoadBar). The two sections are split by a thin divider so the card reads
 * as one composite "where am I right now" view instead of two stacked cards.
 */
export function TrainingReadinessCard({
  readiness, onPress, smartMessage, completedPercent, projectedPercent,
}: Props) {
  const band = readinessBand(readiness.score);
  const hasReadSection =
    smartMessage != null && completedPercent != null && projectedPercent != null;
  // Today's read reflects COMPLETED load — the number on the bar and its color
  // both come from the completed percentage, not the projected total.
  const loadZone = completedPercent != null ? getLoadZone(completedPercent) : null;

  const Wrapper: any = onPress ? Pressable : View;
  const wrapperProps = onPress
    ? { onPress: () => { haptics.tap(); onPress(); } }
    : {};

  return (
    <Wrapper {...wrapperProps} style={[styles.outer, { borderColor: band.color + '66' }]}>
      <LinearGradient
        colors={[band.color + '22', colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.header, { color: band.color }]}>TRAINING READINESS</Text>
          {onPress && (
            <Ionicons name="chevron-forward" size={16} color={band.color} />
          )}
        </View>

        <View style={styles.body}>
          <WellnessRing score={readiness.score} size={110} stroke={10} />

          <View style={styles.right}>
            <Line
              label="HRV"
              value={readiness.hrv}
              trend={readiness.hrvTrend}
              hint={readiness.hrvBaseline
                ? `base ${Math.round(readiness.hrvBaseline)}ms`
                : 'no baseline'}
            />
            <Line
              label="Sleep"
              value={readiness.sleep}
              trend={readiness.sleepTrend}
              hint={readiness.sleepAvg3d
                ? `${readiness.sleepAvg3d.toFixed(1)}h avg 3d`
                : 'no data'}
            />
            <Line
              label="Load"
              value={readiness.load}
              trend={readiness.loadTrend}
              hint={readiness.weeklyLoadPercent != null
                ? `${Math.round(readiness.weeklyLoadPercent)}% of wk`
                : ''}
            />
          </View>
        </View>

        <Text style={[styles.verdict, { color: band.color }]}>
          {band.label.toUpperCase()} · {band.verdict}
        </Text>

        {/* Merged "Today's read" section */}
        {hasReadSection && loadZone && (
          <>
            <View style={styles.divider} />
            <Text style={styles.readEyebrow}>TODAY'S READ</Text>
            <TypewriterText text={smartMessage!} style={styles.smartText} speed={16} delay={200} />
            <View style={styles.bigPctRow}>
              <AnimatedNumber
                value={completedPercent!}
                style={[styles.bigPct, { color: loadZone.color }]}
                suffix="%"
                duration={900}
              />
              <Text style={styles.bigPctSuffix}>of weekly target completed</Text>
            </View>
            <View style={{ height: spacing.sm }} />
            <LoadBar
              completedPercent={completedPercent!}
              projectedPercent={projectedPercent!}
            />
          </>
        )}
      </LinearGradient>
    </Wrapper>
  );
}

function Line({
  label, value, trend, hint,
}: { label: string; value: number | null; trend: TrendDirection; hint: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <View style={styles.lineRight}>
        <TrendArrow direction={trend} />
        <Text style={[styles.lineValue, value == null && { color: colors.textFaint }]}>
          {value == null ? '—' : Math.round(value)}
        </Text>
        <Text style={styles.lineHint}>{hint}</Text>
      </View>
    </View>
  );
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'unknown') {
    return <Ionicons name="remove" size={14} color={colors.textFaint} />;
  }
  if (direction === 'up') {
    return <Ionicons name="arrow-up" size={14} color={colors.success} />;
  }
  if (direction === 'down') {
    return <Ionicons name="arrow-down" size={14} color={colors.danger} />;
  }
  return <Ionicons name="remove" size={14} color={colors.textDim} />;
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  gradient: { padding: spacing.md, gap: 4 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  body: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  right: { flex: 1, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineLabel: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700' },
  lineRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '800', minWidth: 28, textAlign: 'right' },
  lineHint: { color: colors.textFaint, fontSize: fontSize.xs, minWidth: 78, textAlign: 'right' },
  verdict: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // --- Merged "Today's read" sub-section
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  readEyebrow: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  smartText: {
    color: colors.text,
    fontSize: fontSize.md,
    lineHeight: 22,
    minHeight: 44,
  },
  bigPctRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: spacing.md,
  },
  bigPct: { fontSize: fontSize.xxl, fontWeight: '900', letterSpacing: -0.8 },
  bigPctSuffix: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '600' },
});

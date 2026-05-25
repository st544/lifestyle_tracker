import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, subDays } from 'date-fns';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import { DailyLog, Session, Settings, DEFAULT_SETTINGS } from '../types';
import { getDailyLogs, getSessions, getSettings } from '../storage';
import { calculateReadiness, readinessBand, TrendDirection } from '../readiness';
import { toDateString, parseDateString } from '../dates';
import { Section, Card } from '../components/Section';
import { LineChart, LineSeries } from '../components/LineChart';
import { WellnessRing } from '../components/WellnessRing';
import { RootStackParamList } from '../navigation';
import * as haptics from '../haptics';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Readiness'>;

const RANGES = [14, 30, 60, 90] as const;
type Range = typeof RANGES[number];

interface DayEntry {
  date: string;
  label: string;
  score: number;
  hrvComp: number | null;
  sleepComp: number | null;
  loadComp: number | null;
  hrvTrend: TrendDirection;
  sleepTrend: TrendDirection;
}

export default function ReadinessScreen() {
  const nav = useNavigation<Nav>();
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [range, setRange] = useState<Range>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [logs, sess, st] = await Promise.all([
      getDailyLogs(), getSessions(), getSettings(),
    ]);
    setDailyLogs(logs);
    setSessions(sess);
    setSettings(st);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build the readiness time series — one entry per day in the range, oldest → newest.
  const series: DayEntry[] = useMemo(() => {
    const now = new Date();
    const out: DayEntry[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const dateStr = toDateString(d);
      const r = calculateReadiness(
        dateStr, dailyLogs, sessions,
        settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
      );
      out.push({
        date: dateStr,
        label: format(d, 'M/d'),
        score: r.score,
        hrvComp: r.hrv,
        sleepComp: r.sleep,
        loadComp: r.load,
        hrvTrend: r.hrvTrend,
        sleepTrend: r.sleepTrend,
      });
    }
    return out;
  }, [dailyLogs, sessions, settings.defaultWeeklyTargetLoad, settings.weekStartsOn, range]);

  const todayEntry = series[series.length - 1];
  const selected = selectedDate
    ? series.find((s) => s.date === selectedDate) ?? todayEntry
    : todayEntry;
  const selectedBand = readinessBand(selected?.score ?? 0);

  // Stats over the visible window
  const stats = useMemo(() => {
    const scores = series.map((s) => s.score).filter((v) => v > 0);
    if (scores.length === 0) return { avg: 0, max: 0, min: 0 };
    return {
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [series]);

  // LineChart series
  const lineSeries: LineSeries[] = [
    {
      name: 'Readiness',
      color: zelda.triforceGold,
      data: series.map((s) => ({ label: s.label, value: s.score || null })),
      yAxis: 'left',
      format: (v) => `${Math.round(v)}`,
    },
  ];

  // Day list — newest first, capped at 14 to keep the screen compact
  const dayListItems = series.slice().reverse().slice(0, 14);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Hero: selected day's readiness ring + breakdown */}
      <View style={[styles.heroWrap, { borderColor: selectedBand.color + '66' }]}>
        <LinearGradient
          colors={[selectedBand.color + '22', colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <Text style={styles.eyebrow}>
            {selected?.date === todayEntry?.date
              ? 'TODAY · TRAINING READINESS'
              : `${format(parseDateString(selected?.date ?? '2000-01-01'), 'EEE MMM d').toUpperCase()} · TRAINING READINESS`}
          </Text>
          <View style={styles.heroBody}>
            <WellnessRing score={selected?.score ?? 0} size={120} stroke={11} />
            <View style={styles.heroStats}>
              <StatLine label="HRV"   value={selected?.hrvComp}    trend={selected?.hrvTrend} />
              <StatLine label="Sleep" value={selected?.sleepComp}  trend={selected?.sleepTrend} />
              <StatLine label="Load"  value={selected?.loadComp}   trend="flat" />
            </View>
          </View>
          <Text style={[styles.verdict, { color: selectedBand.color }]}>
            {selectedBand.label.toUpperCase()} · {selectedBand.verdict}
          </Text>
        </LinearGradient>
      </View>

      {/* Range toggle */}
      <Section title="Readiness over time" subtitle="Tap the chart to see exact values for a day">
        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const active = range === r;
            return (
              <Pressable
                key={r}
                style={[styles.rangeBtn, active && styles.rangeBtnActive]}
                onPress={() => { haptics.tap(); setRange(r); }}
              >
                <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r}d</Text>
              </Pressable>
            );
          })}
        </View>
        <LineChart
          title="Training Readiness"
          subtitle={`Avg ${Math.round(stats.avg)} · range ${Math.round(stats.min)}–${Math.round(stats.max)}`}
          series={lineSeries}
          height={220}
          targetLeft={70}
          emptyMessage="Log a few days of HRV / sleep to start seeing trends."
        />
      </Section>

      {/* Day list — most recent on top, tap to reload hero */}
      <Section title="Recent days" subtitle="Tap any day to see its breakdown above">
        {dayListItems.map((d) => {
          const band = readinessBand(d.score);
          const isSelected = d.date === selected?.date;
          return (
            <Pressable
              key={d.date}
              onPress={() => { haptics.tap(); setSelectedDate(d.date); }}
              style={[
                styles.dayRow,
                isSelected && { borderColor: band.color, borderWidth: 1.5 },
              ]}
            >
              <View style={styles.dayLeft}>
                <Text style={styles.dayDate}>
                  {format(parseDateString(d.date), 'EEE MMM d')}
                </Text>
                <Text style={[styles.dayBand, { color: band.color }]}>{band.label}</Text>
              </View>
              <View style={styles.dayRight}>
                <Text style={[styles.dayScore, { color: band.color }]}>{d.score}</Text>
                <View style={styles.miniBar}>
                  <View
                    style={[
                      styles.miniBarFill,
                      {
                        width: `${Math.min(100, d.score)}%`,
                        backgroundColor: band.color,
                      },
                    ]}
                  />
                </View>
              </View>
            </Pressable>
          );
        })}
      </Section>

      <Pressable style={styles.doneBtn} onPress={() => nav.goBack()}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function StatLine({
  label, value, trend,
}: { label: string; value: number | null | undefined; trend: TrendDirection | undefined }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRight}>
        <TrendArrow direction={trend ?? 'unknown'} />
        <Text style={[styles.statValue, value == null && { color: colors.textFaint }]}>
          {value == null ? '—' : Math.round(value)}
        </Text>
      </View>
    </View>
  );
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'up')   return <Ionicons name="arrow-up"   size={12} color={colors.success} />;
  if (direction === 'down') return <Ionicons name="arrow-down" size={12} color={colors.danger} />;
  return <Ionicons name="remove" size={12} color={colors.textFaint} />;
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },

  heroWrap: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5 },
  heroGradient: { padding: spacing.md, gap: spacing.sm },
  eyebrow: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroBody: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heroStats: { flex: 1, gap: 6 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700' },
  statRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '800', minWidth: 28, textAlign: 'right' },
  verdict: { marginTop: spacing.xs, fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.5 },

  rangeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  rangeBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rangeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  rangeTextActive: { color: '#0B0F14' },

  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  dayLeft: { flex: 1 },
  dayDate: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  dayBand: { fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  dayRight: { alignItems: 'flex-end', gap: 4, minWidth: 100 },
  dayScore: { fontSize: fontSize.xl, fontWeight: '800', minWidth: 38, textAlign: 'right' },
  miniBar: {
    width: 80, height: 5, borderRadius: 3,
    backgroundColor: colors.surfaceAlt, overflow: 'hidden',
  },
  miniBarFill: { height: '100%' },

  doneBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  doneBtnText: { color: colors.text, fontWeight: '700' },
});

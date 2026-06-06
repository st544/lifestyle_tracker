import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { addDays, format, subWeeks } from 'date-fns';

import { colors, spacing, fontSize, radius, typeColors, zelda } from '../theme';
import {
  Session, SessionType, Settings, DEFAULT_SETTINGS, DailyLog,
} from '../types';
import { getSessions, getSettings, getDailyLogs } from '../storage';
import { calculateWeeklyLoad, isRecoveryType } from '../load';
import { calculateWellness } from '../wellness';
import { weekRange, isInRange, toDateString, parseDateString } from '../dates';
import { Section, Card } from '../components/Section';
import { BarChart, BarPoint } from '../components/BarChart';
import { LineChart, LineSeries, LinePoint } from '../components/LineChart';
import { subDays } from 'date-fns';
import * as haptics from '../haptics';

const RANGES = [4, 8, 12, 26] as const;
type Range = typeof RANGES[number];

interface WeekStats {
  startStr: string;
  label: string;
  load: number;
  sessions: number;
  workoutMinutes: number;
  recoveryMinutes: number;
  miles: number;
  byType: Partial<Record<SessionType, number>>;
}

export default function TrendsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [range, setRange] = useState<Range>(12);

  // Line-chart view controls
  const [lineMode, setLineMode] = useState<'daily' | 'weekly'>('weekly');
  const [showHrv, setShowHrv] = useState(true);
  const [showSleep, setShowSleep] = useState(true);
  const [showQuality, setShowQuality] = useState(false);

  const load = useCallback(async () => {
    const [s, st, logs] = await Promise.all([
      getSessions(), getSettings(), getDailyLogs(),
    ]);
    setSessions(s);
    setSettings(st);
    setDailyLogs(logs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weekly: WeekStats[] = useMemo(() => {
    const now = new Date();
    const out: WeekStats[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const ref = subWeeks(now, i);
      const r = weekRange(ref, settings.weekStartsOn);
      const inWeek = sessions.filter(
        (s) => isInRange(s.date, r.startStr, r.endStr) &&
               (s.status === 'Completed' || s.status === 'Partial')
      );
      let workoutMinutes = 0;
      let recoveryMinutes = 0;
      let miles = 0;
      let load = 0;
      const byType: Partial<Record<SessionType, number>> = {};
      for (const s of inWeek) {
        load += s.loadScore ?? 0;
        byType[s.type] = (byType[s.type] ?? 0) + 1;
        if (isRecoveryType(s.type)) recoveryMinutes += s.durationMinutes;
        else workoutMinutes += s.durationMinutes;
        if (s.type === 'Run' && typeof s.miles === 'number') miles += s.miles;
      }
      out.push({
        startStr: r.startStr,
        label: format(r.start, 'M/d'),
        load,
        sessions: inWeek.length,
        workoutMinutes,
        recoveryMinutes,
        miles,
        byType,
      });
    }
    return out;
  }, [sessions, settings.weekStartsOn, range]);

  const loadData: BarPoint[] = weekly.map((w) => ({ label: w.label, value: w.load }));
  const sessionsData: BarPoint[] = weekly.map((w) => ({ label: w.label, value: w.sessions }));
  const workoutMinData: BarPoint[] = weekly.map((w) => ({ label: w.label, value: w.workoutMinutes }));
  const milesData: BarPoint[] = weekly.map((w) => ({ label: w.label, value: w.miles }));

  // Per-activity weekly counts (BJJ, Lift, Run, Climb)
  const perType = (t: SessionType): BarPoint[] =>
    weekly.map((w) => ({ label: w.label, value: w.byType[t] ?? 0 }));

  // --- Wellness aggregates per WEEK (same x-axis as the other charts) ----
  // Each entry uses the same week-start label as the load/sessions/minutes
  // charts so visual comparison across the page lines up.
  const wellnessWeekly = useMemo(() => {
    return weekly.map((w) => {
      // All daily logs falling within this week
      const logsInWeek: DailyLog[] = [];
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const d = toDateString(addDays(parseDateString(w.startStr), dayIdx));
        const log = dailyLogs.find((l) => l.date === d);
        if (log) logsInWeek.push(log);
      }

      const mean = (arr: number[]) =>
        arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

      const hrvVals = logsInWeek.map((l) => l.hrv).filter((v): v is number => typeof v === 'number' && v > 0);
      const hoursVals = logsInWeek.map((l) => l.sleepHours).filter((v): v is number => typeof v === 'number' && v > 0);
      const qualityVals = logsInWeek.map((l) => l.sleepQuality).filter((v): v is number => typeof v === 'number' && v > 0);

      // Wellness — average of each day's score
      const wellnessScores: number[] = [];
      for (const log of logsInWeek) {
        const score = calculateWellness(
          log.date, log, dailyLogs, sessions,
          settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
        ).score;
        if (score != null && score > 0) wellnessScores.push(score);
      }

      return {
        label: w.label,
        hrv: mean(hrvVals),
        sleepHours: mean(hoursVals),
        sleepQuality: mean(qualityVals),
        wellness: mean(wellnessScores),
      };
    });
  }, [weekly, dailyLogs, sessions, settings.defaultWeeklyTargetLoad, settings.weekStartsOn]);

  const hrvData:          BarPoint[] = wellnessWeekly.map((w) => ({ label: w.label, value: w.hrv }));
  const sleepHoursData:   BarPoint[] = wellnessWeekly.map((w) => ({ label: w.label, value: w.sleepHours }));
  const sleepQualityData: BarPoint[] = wellnessWeekly.map((w) => ({ label: w.label, value: w.sleepQuality }));
  const wellnessData:     BarPoint[] = wellnessWeekly.map((w) => ({ label: w.label, value: w.wellness }));

  // --- Daily series for the line-chart view (covers the same range × 7 days)
  const dailySeries = useMemo(() => {
    const days = range * 7;
    const now = new Date();
    const out: Array<{ label: string; date: string; hrv: number | null; sleepHours: number | null; sleepQuality: number | null }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const dateStr = toDateString(d);
      const log = dailyLogs.find((l) => l.date === dateStr);
      out.push({
        label: format(d, 'M/d'),
        date: dateStr,
        hrv: log?.hrv ?? null,
        sleepHours: log?.sleepHours ?? null,
        sleepQuality: log?.sleepQuality ?? null,
      });
    }
    return out;
  }, [dailyLogs, range]);

  // Build LineSeries for the user's current toggles
  const lineSeries: LineSeries[] = useMemo(() => {
    const fromWeekly = (key: 'hrv' | 'sleepHours' | 'sleepQuality'): LinePoint[] =>
      wellnessWeekly.map((w) => ({ label: w.label, value: w[key] > 0 ? w[key] : null }));
    const fromDaily = (key: 'hrv' | 'sleepHours' | 'sleepQuality'): LinePoint[] =>
      dailySeries.map((d) => ({ label: d.label, value: d[key] }));
    const points = lineMode === 'weekly' ? fromWeekly : fromDaily;

    const arr: LineSeries[] = [];
    if (showHrv) {
      arr.push({
        name: 'HRV (ms)',
        color: zelda.skyTeal,
        data: points('hrv'),
        yAxis: 'left',
        format: (v) => `${Math.round(v)} ms`,
      });
    }
    if (showSleep) {
      // Sleep duration is always on the RIGHT axis when overlaid with HRV
      // and/or sleep quality (its scale, 0-12h, doesn't share with ms or 0-100).
      // Alone, it gets the left axis.
      const overlaid = showHrv || showQuality;
      arr.push({
        name: 'Sleep (h)',
        color: zelda.rupeeBlue,
        data: points('sleepHours'),
        yAxis: overlaid ? 'right' : 'left',
        format: (v) => `${v.toFixed(1)} h`,
      });
    }
    if (showQuality) {
      // Quality 0-100 lives on the left axis. (HRV ms also lives on left and
      // their scales overlap roughly, which is OK for at-a-glance comparison.)
      arr.push({
        name: 'Quality',
        color: zelda.rupeePurple,
        data: points('sleepQuality'),
        yAxis: 'left',
        format: (v) => `${Math.round(v)}`,
      });
    }
    return arr;
  }, [lineMode, showHrv, showSleep, showQuality, dailySeries, wellnessWeekly]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Section title="Trends" subtitle="Completed sessions only">
        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const active = range === r;
            return (
              <Pressable
                key={r}
                style={[styles.rangeBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => { haptics.tap(); setRange(r); }}
              >
                <Text style={[styles.rangeText, active && { color: '#0B0F14' }]}>{r}w</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Training load" subtitle="Per week">
        <View style={{ gap: spacing.md }}>
          <BarChart
            title="Weekly load"
            subtitle="loadScore per week"
            data={loadData}
            target={settings.defaultWeeklyTargetLoad}
            color={colors.primary}
            emptyMessage="No completed sessions yet."
          />
          <BarChart
            title="Sessions per week"
            data={sessionsData}
            color={typeColors.BJJ}
            format={(v) => String(Math.round(v))}
          />
          <BarChart
            title="Workout minutes"
            subtitle="BJJ, lift, run, climb"
            data={workoutMinData}
            color={typeColors.Lift}
            format={(v) => `${Math.round(v)}m`}
          />
          <BarChart
            title="Miles run"
            data={milesData}
            color={typeColors.Run}
            format={(v) => v.toFixed(1)}
            emptyMessage="Add miles to Run sessions to see this chart fill in."
          />
        </View>
      </Section>

      <Section
        title="Wellness over time"
        subtitle="Line view — overlay metrics, switch daily/weekly, tap chart for exact values"
        style={{ marginTop: spacing.lg }}
      >
        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, lineMode === 'weekly' && styles.modeBtnActive]}
            onPress={() => { haptics.tap(); setLineMode('weekly'); }}
          >
            <Text style={[styles.modeText, lineMode === 'weekly' && styles.modeTextActive]}>Weekly avg</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, lineMode === 'daily' && styles.modeBtnActive]}
            onPress={() => { haptics.tap(); setLineMode('daily'); }}
          >
            <Text style={[styles.modeText, lineMode === 'daily' && styles.modeTextActive]}>Daily</Text>
          </Pressable>
        </View>
        {/* Metric chips */}
        <View style={styles.metricRow}>
          <MetricChip label="HRV" color={zelda.skyTeal} active={showHrv}
            onToggle={() => { haptics.tap(); setShowHrv((v) => !v); }} />
          <MetricChip label="Sleep duration" color={zelda.rupeeBlue} active={showSleep}
            onToggle={() => { haptics.tap(); setShowSleep((v) => !v); }} />
          <MetricChip label="Sleep quality" color={zelda.rupeePurple} active={showQuality}
            onToggle={() => { haptics.tap(); setShowQuality((v) => !v); }} />
        </View>

        {lineSeries.length === 0 ? (
          <Card><Text style={{ color: colors.textDim, textAlign: 'center' }}>
            Select at least one metric to plot.
          </Text></Card>
        ) : (
          <LineChart
            title={lineMode === 'weekly' ? 'Weekly average' : 'Daily values'}
            series={lineSeries}
            height={240}
            emptyMessage="No data logged in this window yet."
          />
        )}
      </Section>

      <Section title="Wellness — weekly" subtitle="Same data, week-by-week comparison" style={{ marginTop: spacing.lg }}>
        <View style={{ gap: spacing.md }}>
          <LineChart
            title="HRV"
            subtitle="Avg overnight HRV per week (ms)"
            series={[{
              name: 'HRV (ms)',
              color: zelda.skyTeal,
              data: hrvData.map((p) => ({ label: p.label, value: p.value > 0 ? p.value : null })),
              yAxis: 'left',
              format: (v) => `${Math.round(v)} ms`,
            }]}
            height={200}
            emptyMessage="No HRV logged in this window yet."
          />
          <BarChart
            title="Sleep duration"
            subtitle="Avg hours per night, per week"
            data={sleepHoursData}
            color={zelda.rupeeBlue}
            format={(v) => `${v.toFixed(1)}h`}
            target={8}
            emptyMessage="No sleep logged in this window yet."
          />
          <LineChart
            title="Sleep quality"
            subtitle="Avg quality per week (0-100)"
            series={[{
              name: 'Quality',
              color: zelda.rupeePurple,
              data: sleepQualityData.map((p) => ({ label: p.label, value: p.value > 0 ? p.value : null })),
              yAxis: 'left',
              format: (v) => `${Math.round(v)}`,
            }]}
            height={200}
            targetLeft={80}
            emptyMessage="No quality scores logged in this window yet."
          />
          <LineChart
            title="Wellness score"
            subtitle="Avg daily composite per week (HRV + sleep + load)"
            series={[{
              name: 'Wellness',
              color: zelda.triforceGold,
              data: wellnessData.map((p) => ({ label: p.label, value: p.value > 0 ? p.value : null })),
              yAxis: 'left',
              format: (v) => `${Math.round(v)}`,
            }]}
            height={200}
            targetLeft={75}
            emptyMessage="No wellness data in this window yet."
          />
        </View>
      </Section>

      <Section title="By activity" style={{ marginTop: spacing.lg }}>
        <View style={{ gap: spacing.md }}>
          {(['BJJ', 'Lift', 'Run', 'Rock Climb'] as SessionType[]).map((t) => (
            <BarChart
              key={t}
              title={t}
              data={perType(t)}
              color={typeColors[t]}
              format={(v) => String(Math.round(v))}
              target={settings.goals[t]}
            />
          ))}
        </View>
      </Section>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function MetricChip({
  label, color, active, onToggle,
}: { label: string; color: string; active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        chipStyles.chip,
        active && { backgroundColor: color + '33', borderColor: color },
      ]}
    >
      <View style={[chipStyles.dot, { backgroundColor: active ? color : colors.textFaint }]} />
      <Text style={[chipStyles.label, { color: active ? colors.text : colors.textDim }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontWeight: '700', fontSize: fontSize.sm },
});

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  rangeRow: { flexDirection: 'row', gap: spacing.sm },
  rangeBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rangeText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },

  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  modeBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  modeTextActive: { color: '#0B0F14' },

  metricRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});

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
import { calculateWellness, rollingHrvBaseline, wellnessBand } from '../wellness';
import { toDateString } from '../dates';
import { generateWellnessInsight, InsightTone } from '../wellness-insight';
import { Section, Card } from '../components/Section';
import { BarChart } from '../components/BarChart';
import { LineChart, LineSeries } from '../components/LineChart';
import { WellnessRing } from '../components/WellnessRing';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Wellness'>;

const WINDOW_DAYS = 7;

export default function WellnessScreen() {
  const nav = useNavigation<Nav>();
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    const [logs, sess, st] = await Promise.all([
      getDailyLogs(), getSessions(), getSettings(),
    ]);
    setDailyLogs(logs);
    setSessions(sess);
    setSettings(st);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build the 7-day window, oldest → newest, with undefined for missing days.
  const dailySeries = useMemo(() => {
    const now = new Date();
    const out: Array<{
      date: string;
      label: string;
      log: DailyLog | undefined;
      wellness: number | null;
    }> = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const dateStr = toDateString(d);
      const log = dailyLogs.find((l) => l.date === dateStr);
      const wellness = log
        ? calculateWellness(
            dateStr, log, dailyLogs, sessions,
            settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
          ).score
        : null;
      out.push({
        date: dateStr,
        label: format(d, 'EEE'),
        log,
        wellness,
      });
    }
    return out;
  }, [dailyLogs, sessions, settings.defaultWeeklyTargetLoad, settings.weekStartsOn]);

  const today = toDateString(new Date());
  // Baseline is the 14-day rolling mean ending TODAY (excludes today itself).
  const hrvBaseline = useMemo(() => rollingHrvBaseline(dailyLogs, today) ?? null, [dailyLogs, today]);

  const insight = useMemo(
    () =>
      generateWellnessInsight({
        last7: dailySeries.map((d) => d.log),
        hrvBaseline,
        wellnessScores: dailySeries.map((d) => d.wellness),
      }),
    [dailySeries, hrvBaseline],
  );

  // Null-tolerant series — gaps in data render as gaps in the line.
  const hrvSeries: LineSeries[] = [{
    name: 'HRV (ms)',
    color: zelda.skyTeal,
    data: dailySeries.map((d) => ({ label: d.label, value: d.log?.hrv ?? null })),
    yAxis: 'left',
    format: (v) => `${Math.round(v)} ms`,
  }];
  const sleepHoursData = dailySeries.map((d) => ({
    label: d.label,
    value: d.log?.sleepHours ?? 0,
  }));
  const sleepQualitySeries: LineSeries[] = [{
    name: 'Quality',
    color: zelda.rupeePurple,
    data: dailySeries.map((d) => ({ label: d.label, value: d.log?.sleepQuality ?? null })),
    yAxis: 'left',
    format: (v) => `${Math.round(v)}`,
  }];
  const wellnessSeries: LineSeries[] = [{
    name: 'Wellness',
    color: zelda.triforceGold,
    data: dailySeries.map((d) => ({ label: d.label, value: d.wellness })),
    yAxis: 'left',
    format: (v) => `${Math.round(v)}`,
  }];

  // Hero shows the MOST RECENT day's wellness score, not the 7-day average.
  // Walk backward through the series and take the first non-null score.
  const summaryScore: number | null =
    [...dailySeries].reverse().find((d) => d.wellness != null)?.wellness ?? null;
  const summaryBand =
    summaryScore != null ? wellnessBand(summaryScore) : { color: colors.textFaint, label: 'No data' };

  const toneColor = toneToColor(insight.tone);
  const toneIcon = toneToIcon(insight.tone);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Summary hero */}
      <View style={styles.summaryWrap}>
        <LinearGradient
          colors={[summaryBand.color + '22', colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryGradient}
        >
          <Text style={styles.eyebrow}>WELLNESS · TODAY'S SCORE</Text>
          <View style={styles.summaryBody}>
            <WellnessRing score={summaryScore} size={108} stroke={10} />
            <View style={styles.summaryStats}>
              <StatLine
                label="HRV avg"
                value={insight.stats.avgHrv != null ? `${Math.round(insight.stats.avgHrv)} ms` : '—'}
                hint={
                  insight.stats.hrvBaseline != null
                    ? `baseline ${Math.round(insight.stats.hrvBaseline)}ms`
                    : 'no baseline yet'
                }
              />
              <StatLine
                label="Sleep avg"
                value={insight.stats.avgSleepHours != null ? `${insight.stats.avgSleepHours.toFixed(1)} h` : '—'}
                hint="goal 7-9h"
              />
              <StatLine
                label="Quality avg"
                value={insight.stats.avgSleepQuality != null ? `${Math.round(insight.stats.avgSleepQuality)}/100` : '—'}
                hint="goal 75+"
              />
              <StatLine
                label="Days logged"
                value={`${insight.stats.daysLogged}/7`}
                hint=""
              />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Insight card */}
      <View style={[styles.insightOuter, { borderColor: toneColor + '66' }]}>
        <LinearGradient
          colors={[toneColor + '22', colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.insightGradient}
        >
          <View style={styles.insightHeader}>
            <Ionicons name={toneIcon as any} size={18} color={toneColor} />
            <Text style={[styles.insightHeadline, { color: toneColor }]}>
              {insight.headline}
            </Text>
          </View>
          <Text style={styles.insightBody}>{insight.body}</Text>
        </LinearGradient>
      </View>

      {/* Charts */}
      <Section title="Wellness score" subtitle="Daily composite over last 7 days">
        <LineChart
          title="Wellness score"
          subtitle="Composite: HRV + sleep + load"
          series={wellnessSeries}
          height={210}
          targetLeft={75}
          emptyMessage="No wellness data this week."
        />
      </Section>

      <Section title="HRV" subtitle="Daily overnight HRV (ms)">
        <LineChart
          title="HRV"
          subtitle={hrvBaseline ? `Baseline ${Math.round(hrvBaseline)} ms` : 'No baseline yet'}
          series={hrvSeries}
          height={210}
          targetLeft={hrvBaseline ?? undefined}
          emptyMessage="No HRV logged this week."
        />
      </Section>

      <Section title="Sleep duration" subtitle="Hours slept per night">
        <BarChart
          title="Sleep duration"
          data={sleepHoursData}
          color={zelda.rupeeBlue}
          format={(v) => (v === 0 ? '—' : `${v.toFixed(1)}h`)}
          target={8}
          emptyMessage="No sleep logged this week."
        />
      </Section>

      <Section title="Sleep quality" subtitle="0-100">
        <LineChart
          title="Sleep quality"
          series={sleepQualitySeries}
          height={210}
          targetLeft={80}
          emptyMessage="No quality scores logged this week."
        />
      </Section>

      <Pressable style={styles.doneBtn} onPress={() => nav.goBack()}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function StatLine({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRight}>
        <Text style={styles.statValue}>{value}</Text>
        {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function toneToColor(tone: InsightTone): string {
  switch (tone) {
    case 'good':    return zelda.rupeeGreen;
    case 'caution': return zelda.triforceGold;
    case 'warn':    return colors.danger;
    default:        return colors.primary;
  }
}
function toneToIcon(tone: InsightTone): string {
  switch (tone) {
    case 'good':    return 'checkmark-circle';
    case 'caution': return 'alert-circle';
    case 'warn':    return 'warning';
    default:        return 'information-circle';
  }
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },

  summaryWrap: {
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  summaryGradient: { padding: spacing.md },
  eyebrow: {
    color: colors.textDim, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.5, marginBottom: spacing.sm,
  },
  summaryBody: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  summaryStats: { flex: 1, gap: 6 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700' },
  statRight: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  statHint: { color: colors.textFaint, fontSize: fontSize.xs },

  insightOuter: {
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1.5,
  },
  insightGradient: { padding: spacing.md, gap: spacing.sm },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightHeadline: { fontSize: fontSize.md, fontWeight: '800', letterSpacing: 0.3 },
  insightBody: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },

  doneBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  doneBtnText: { color: colors.text, fontWeight: '700' },
});

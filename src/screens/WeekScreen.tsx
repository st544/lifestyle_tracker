import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';

import { colors, spacing, fontSize, radius, typeColors, zelda } from '../theme';
import { Session, SessionType, Settings, DEFAULT_SETTINGS, WeeklyChecklist, DailyLog } from '../types';
import {
  getSessions, getSettings, getWeeklyChecklist, setMealPrepDone, getDailyLogs,
} from '../storage';
import { calculateWeeklyLoad, getLoadZone } from '../load';
import { calculateLoadForm } from '../load-form';
import { weekRange, isInRange } from '../dates';
import { Section, Card } from '../components/Section';
import { LoadBar } from '../components/LoadBar';
import { SessionCard } from '../components/SessionCard';
import * as haptics from '../haptics';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MS_PER_DAY = 86_400_000;

export default function WeekScreen() {
  const nav = useNavigation<Nav>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [checklist, setChecklist] = useState<WeeklyChecklist | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  // The "reference date" that determines which week is displayed.
  // Defaults to today; chevrons shift it ±7 days.
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  // Compute the currently-displayed week + the *current* week, both in
  // terms of the user's `weekStartsOn` setting.
  const displayedWeek = useMemo(
    () => weekRange(referenceDate, settings.weekStartsOn),
    [referenceDate, settings.weekStartsOn],
  );
  const currentWeek = useMemo(
    () => weekRange(new Date(), settings.weekStartsOn),
    [settings.weekStartsOn],
  );

  const isCurrentWeek = displayedWeek.startStr === currentWeek.startStr;
  const isFutureWeek = displayedWeek.startStr > currentWeek.startStr;

  // "0 weeks ago" = this week, negative = future, positive = past.
  // Computed off the start-of-week dates so it's always an integer.
  const weeksAgo = Math.round(
    (currentWeek.start.getTime() - displayedWeek.start.getTime()) / (MS_PER_DAY * 7),
  );

  const loadSessionsAndSettings = useCallback(async () => {
    const [s, st, logs] = await Promise.all([getSessions(), getSettings(), getDailyLogs()]);
    setSessions(s);
    setSettings(st);
    setDailyLogs(logs);
  }, []);

  // Whenever the displayed week changes, refresh the checklist for that week.
  const loadChecklistForDisplayed = useCallback(async (startStr: string) => {
    const cl = await getWeeklyChecklist(startStr);
    setChecklist(cl);
  }, []);

  useFocusEffect(useCallback(() => { loadSessionsAndSettings(); }, [loadSessionsAndSettings]));

  // Re-fetch the checklist whenever the displayed week's start date changes.
  React.useEffect(() => {
    loadChecklistForDisplayed(displayedWeek.startStr);
  }, [displayedWeek.startStr, loadChecklistForDisplayed]);

  const goPrev = () => {
    haptics.tap();
    setReferenceDate((d) => addDays(d, -7));
  };
  const goNext = () => {
    if (isCurrentWeek) return;
    haptics.tap();
    setReferenceDate((d) => addDays(d, 7));
  };
  const goToday = () => {
    haptics.tick();
    setReferenceDate(new Date());
  };

  const weekSessions = sessions
    .filter((s) => isInRange(s.date, displayedWeek.startStr, displayedWeek.endStr))
    .sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')));
  const weekly = calculateWeeklyLoad(weekSessions, settings.defaultWeeklyTargetLoad);
  const zone = getLoadZone(weekly.percentProjected);

  // 7-day averages for the displayed week
  const weekLogs = useMemo(
    () => dailyLogs.filter((l) => isInRange(l.date, displayedWeek.startStr, displayedWeek.endStr)),
    [dailyLogs, displayedWeek.startStr, displayedWeek.endStr],
  );
  const weekAverages = useMemo(() => {
    const mean = (arr: number[]) => arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      avgHrv: mean(weekLogs.map((l) => l.hrv).filter((v): v is number => typeof v === 'number' && v > 0)),
      avgSleep: mean(weekLogs.map((l) => l.sleepHours).filter((v): v is number => typeof v === 'number' && v > 0)),
      avgQuality: mean(weekLogs.map((l) => l.sleepQuality).filter((v): v is number => typeof v === 'number' && v > 0)),
      daysLogged: weekLogs.length,
    };
  }, [weekLogs]);

  // ACWR (acute:chronic workload ratio) — uses sessions ending at the
  // displayed week's END date, so navigating back in time shows the form
  // ratio as it was at that point.
  const loadForm = useMemo(
    () => calculateLoadForm(sessions, dailyLogs, displayedWeek.end),
    [sessions, dailyLogs, displayedWeek.end],
  );

  const completed = weekSessions.filter((s) => s.status === 'Completed' || s.status === 'Partial');
  const planned = weekSessions.filter((s) => s.status === 'Planned');

  const weekLabel = isCurrentWeek
    ? 'This week'
    : weeksAgo === 1 ? 'Last week'
    : weeksAgo > 1 ? `${weeksAgo} weeks ago`
    : weeksAgo === -1 ? 'Next week'
    : `In ${Math.abs(weeksAgo)} weeks`;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl tintColor={colors.text} refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadSessionsAndSettings();
            await loadChecklistForDisplayed(displayedWeek.startStr);
            setRefreshing(false);
          }} />
      }
    >
      {/* Week navigator */}
      <View style={styles.navWrap}>
        <Pressable onPress={goPrev} style={styles.chevBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.navCenter}>
          <Text style={styles.navSub}>{weekLabel}</Text>
          <Text style={styles.navH1}>
            {format(displayedWeek.start, 'MMM d')} – {format(displayedWeek.end, 'MMM d')}
          </Text>
        </View>

        <Pressable
          onPress={goNext}
          disabled={isCurrentWeek}
          style={[styles.chevBtn, isCurrentWeek && styles.chevBtnDisabled]}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrentWeek ? colors.textFaint : colors.text}
          />
        </Pressable>
      </View>

      {!isCurrentWeek && (
        <Pressable onPress={goToday} style={styles.todayBtn}>
          <Ionicons name="return-up-back" size={14} color={colors.text} />
          <Text style={styles.todayBtnText}>Back to current week</Text>
        </Pressable>
      )}

      <Card>
        <Text style={[styles.zoneLabel, { color: zone.color }]}>{zone.label}</Text>
        <View style={{ height: spacing.sm }} />
        <LoadBar
          completedPercent={weekly.percentCompleted}
          projectedPercent={weekly.percentProjected}
        />
        <View style={styles.totalsRow}>
          <Totals label="Completed" value={weekly.completedLoad} />
          <Totals label="Planned" value={weekly.plannedLoad} />
          <Totals label="Total" value={weekly.totalProjected} />
          <Totals label="Target" value={settings.defaultWeeklyTargetLoad} />
        </View>
      </Card>

      {/* 7-day averages (HRV, sleep, quality) */}
      <Card>
        <View style={styles.avgsRow}>
          <AvgStat
            label="HRV avg"
            value={weekAverages.avgHrv != null ? `${Math.round(weekAverages.avgHrv)}` : '—'}
            unit={weekAverages.avgHrv != null ? 'ms' : ''}
            color={zelda.skyTeal}
          />
          <AvgStat
            label="Sleep avg"
            value={weekAverages.avgSleep != null ? weekAverages.avgSleep.toFixed(1) : '—'}
            unit={weekAverages.avgSleep != null ? 'h' : ''}
            color={zelda.rupeeBlue}
          />
          <AvgStat
            label="Quality avg"
            value={weekAverages.avgQuality != null ? `${Math.round(weekAverages.avgQuality)}` : '—'}
            unit={weekAverages.avgQuality != null ? '/100' : ''}
            color={zelda.rupeePurple}
          />
        </View>
        <Text style={styles.avgsFootnote}>
          {weekAverages.daysLogged}/7 days logged
        </Text>
      </Card>

      {/* ACWR / Load form */}
      <Card>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Load form (ACWR)</Text>
          <Text style={[styles.formBand, { color: loadForm.bandColor }]}>{loadForm.bandLabel}</Text>
        </View>
        <View style={styles.formRow}>
          <FormStat label="Acute (7d)" value={loadForm.acuteLoad} />
          <FormStat label="Chronic (avg)" value={loadForm.chronicLoad} />
          <FormStat
            label="Ratio"
            value={loadForm.ratio > 0 ? loadForm.ratio.toFixed(2) : '—'}
          />
          {loadForm.recoveryPenaltyPct > 0 && (
            <FormStat
              label="Adjusted"
              value={loadForm.adjustedRatio.toFixed(2)}
            />
          )}
        </View>
        <Text style={[styles.formVerdict, { color: loadForm.bandColor }]}>
          {loadForm.verdict}
        </Text>
        {loadForm.recoveryPenaltyPct > 0 && (
          <Text style={styles.formFootnote}>
            +{loadForm.recoveryPenaltyPct}% recovery penalty: HRV / sleep below baseline this week.
          </Text>
        )}
      </Card>

      <Card style={styles.mealPrepCard}>
        <View style={styles.mealPrepRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mealPrepTitle}>
              Meal prep {isCurrentWeek ? 'this week' : weeksAgo === 1 ? 'last week' : `(${weekLabel.toLowerCase()})`}
            </Text>
            <Text style={styles.mealPrepSubtitle}>One tap to mark done.</Text>
          </View>
          <Pressable
            onPress={async () => {
              haptics.success();
              const cl = await setMealPrepDone(displayedWeek.startStr, !checklist?.mealPrepDone);
              setChecklist(cl);
            }}
            style={[
              styles.mealPrepBtn,
              checklist?.mealPrepDone && {
                backgroundColor: zelda.rupeeGreen + '33',
                borderColor: zelda.rupeeGreen,
              },
            ]}
          >
            <Ionicons
              name={checklist?.mealPrepDone ? 'checkmark-circle' : 'restaurant-outline'}
              size={18}
              color={checklist?.mealPrepDone ? zelda.rupeeGreen : colors.textDim}
            />
            <Text
              style={[
                styles.mealPrepBtnText,
                checklist?.mealPrepDone && { color: zelda.rupeeGreen },
              ]}
            >
              {checklist?.mealPrepDone ? 'Done' : 'Mark done'}
            </Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={styles.minutesRow}>
          <MinutesStat
            label="Workout minutes"
            value={weekly.workoutMinutes}
            color={colors.primary}
          />
          <MinutesStat
            label="Recovery minutes"
            value={weekly.recoveryMinutes}
            color={typeColors['Mobility / Recovery']}
          />
          {weekly.milesRun > 0 && (
            <MinutesStat
              label="Miles run"
              value={weekly.milesRun}
              format={(v) => v.toFixed(1)}
              color={typeColors.Run}
            />
          )}
        </View>
      </Card>

      <Section title="Counts by type" style={{ marginTop: spacing.lg }}>
        <Card>
          <View style={styles.countsGrid}>
            <Count type="BJJ" n={weekly.byType.BJJ ?? 0} />
            <Count type="Lift" n={weekly.byType.Lift ?? 0} />
            <Count type="Run" n={weekly.byType.Run ?? 0} />
            <Count type="Rock Climb" n={weekly.byType['Rock Climb'] ?? 0} />
            <Count type="Sauna" n={(weekly.byType.Sauna ?? 0) + (weekly.byType['Sauna + Cold Plunge'] ?? 0)} />
            <Count type="Cold Plunge" n={(weekly.byType['Cold Plunge'] ?? 0) + (weekly.byType['Sauna + Cold Plunge'] ?? 0)} />
            <Count type="Mobility / Recovery" n={weekly.byType['Mobility / Recovery'] ?? 0} />
            <Count type="Rest" n={weekly.byType.Rest ?? 0} />
          </View>
        </Card>
      </Section>

      {completed.length > 0 && (
        <Section title={`Completed (${completed.length})`}>
          {completed.map((s) => (
            <SessionCard
              key={s.id} session={s}
              onPress={() => nav.navigate('AddSession', { sessionId: s.id })}
            />
          ))}
        </Section>
      )}

      {planned.length > 0 && (
        <Section title={`Planned (${planned.length})`}>
          {planned.map((s) => (
            <SessionCard
              key={s.id} session={s}
              onPress={() => nav.navigate('AddSession', { sessionId: s.id })}
            />
          ))}
        </Section>
      )}

      {weekSessions.length === 0 && (
        <Card>
          <Text style={styles.dim}>
            {isCurrentWeek
              ? 'No sessions this week yet. Start with a quick-add from the Today tab.'
              : 'No sessions logged for this week.'}
          </Text>
        </Card>
      )}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function AvgStat({
  label, value, unit, color,
}: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.avgStat}>
      <View style={[styles.avgDot, { backgroundColor: color }]} />
      <View>
        <View style={styles.avgValRow}>
          <Text style={styles.avgVal}>{value}</Text>
          {unit ? <Text style={styles.avgUnit}>{unit}</Text> : null}
        </View>
        <Text style={styles.avgLabel}>{label}</Text>
      </View>
    </View>
  );
}

function FormStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.formStat}>
      <Text style={styles.formStatVal}>{value}</Text>
      <Text style={styles.formStatLbl}>{label}</Text>
    </View>
  );
}

function Totals({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalVal}>{value}</Text>
      <Text style={styles.totalLbl}>{label}</Text>
    </View>
  );
}

function MinutesStat({
  label, value, color, format,
}: { label: string; value: number; color: string; format?: (v: number) => string }) {
  return (
    <View style={styles.minStat}>
      <View style={[styles.minDot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.minValue}>
          {format ? format(value) : Math.round(value)}
          {!format && <Text style={styles.minUnit}> min</Text>}
        </Text>
        <Text style={styles.minLabel}>{label}</Text>
      </View>
    </View>
  );
}

function Count({ type, n }: { type: SessionType; n: number }) {
  return (
    <View style={styles.count}>
      <View style={[styles.countDot, { backgroundColor: typeColors[type] }]} />
      <View>
        <Text style={styles.countVal}>{n}</Text>
        <Text style={styles.countLbl}>{type}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  h1: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '800', letterSpacing: -0.5 },
  dim: { color: colors.textDim, fontSize: fontSize.md },
  zoneLabel: { fontSize: fontSize.lg, fontWeight: '800' },

  // Week navigator
  navWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chevBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border,
  },
  chevBtnDisabled: { opacity: 0.4 },
  navCenter: { flex: 1, alignItems: 'center' },
  navSub: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  navH1: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  todayBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  todayBtnText: { color: colors.text, fontSize: fontSize.xs, fontWeight: '700' },

  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  total: { alignItems: 'center' },
  totalVal: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  totalLbl: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2, letterSpacing: 0.5 },

  countsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  count: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countDot: { width: 10, height: 10, borderRadius: 5 },
  countVal: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  countLbl: { color: colors.textDim, fontSize: fontSize.xs },

  minutesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  minStat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  minDot: { width: 10, height: 10, borderRadius: 5 },
  minValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  minUnit: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '600' },
  minLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },

  mealPrepCard: { },
  mealPrepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mealPrepTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  mealPrepSubtitle: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },
  mealPrepBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  mealPrepBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },

  avgsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  avgStat: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 100 },
  avgDot: { width: 10, height: 10, borderRadius: 5 },
  avgValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  avgVal: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  avgUnit: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '600' },
  avgLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2, letterSpacing: 0.4 },
  avgsFootnote: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: 'center' },

  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  formTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  formBand: { fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  formRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  formStat: { alignItems: 'center', minWidth: 60 },
  formStatVal: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  formStatLbl: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2, letterSpacing: 0.4 },
  formVerdict: { fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.xs },
  formFootnote: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
});

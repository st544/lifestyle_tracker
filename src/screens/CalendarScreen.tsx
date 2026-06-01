import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as haptics from '../haptics';

import { colors, spacing, fontSize, typeColors, typeIcons, radius, zelda } from '../theme';
import { Session, SessionType, Settings, DEFAULT_SETTINGS, DailyLog } from '../types';
import {
  getSessions, getSettings, getLastSeenStreaks, saveLastSeenStreaks, getDailyLogs,
} from '../storage';
import { todayString } from '../dates';
import { ALL_TYPES } from '../defaults';
import { calculateStreak } from '../streaks';
import { calculateWellness, wellnessBand } from '../wellness';
import { Section } from '../components/Section';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface StreakRow {
  type: SessionType;
  goal: number;
  weeks: number;
  metThisWeek: boolean;
}

const MILESTONES = [4, 12, 26, 52];

export default function CalendarScreen() {
  const nav = useNavigation<Nav>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [milestone, setMilestone] = useState<null | { type: SessionType; weeks: number }>(null);

  const load = useCallback(async () => {
    const [s, st, logs] = await Promise.all([
      getSessions(), getSettings(), getDailyLogs(),
    ]);
    setSessions(s);
    setSettings(st);
    setDailyLogs(logs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Activity-type dots per date (one per distinct type/color; no wellness).
  const dotsByDate = useMemo(() => {
    const map: Record<string, { color: string; key: string }[]> = {};
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = [];
      const color = typeColors[s.type];
      if (!map[s.date].find((d) => d.color === color)) {
        map[s.date].push({ key: s.type, color });
      }
    }
    return map;
  }, [sessions]);

  // Wellness band color per date with a daily log — rendered as a tinted
  // background behind the date box (not a dot).
  const wellnessByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of dailyLogs) {
      const hasAny =
        log.hrv != null ||
        log.sleepHours != null ||
        log.sleepQuality != null ||
        Object.values(log.supplements ?? {}).some(Boolean);
      if (!hasAny) continue;
      const w = calculateWellness(
        log.date, log, dailyLogs, sessions,
        settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
      );
      map[log.date] = wellnessBand(w.score).color;
    }
    return map;
  }, [dailyLogs, sessions, settings.defaultWeeklyTargetLoad, settings.weekStartsOn]);

  const firstDay = settings.weekStartsOn === 'sunday' ? 0 : 1;

  // Custom day cell — taller block, original-size activity dots, and a faint
  // wellness-colored background behind the date box.
  const renderDay = useCallback((dayProps: any) => {
    const date = dayProps?.date;
    if (!date) return <View style={dayStyles.cell} />;
    const ds: string = date.dateString;
    const dots = dotsByDate[ds] ?? [];
    const wellnessColor = wellnessByDate[ds];
    const disabled = dayProps.state === 'disabled';
    // Only mark "today" within the active month — prevents the duplicate of
    // today shown as an extra day in the adjacent month from getting a marker.
    const isToday = ds === todayString() && !disabled;
    return (
      <Pressable
        onPress={() => { haptics.tap(); nav.navigate('DayDetail', { date: ds }); }}
        style={dayStyles.cell}
      >
        <View style={dayStyles.numBox}>
          {wellnessColor ? (
            <View style={[dayStyles.wellTint, { backgroundColor: wellnessColor + '33', borderColor: wellnessColor }]} />
          ) : null}
          <View style={[dayStyles.numWrap, isToday && dayStyles.todayWrap]}>
            <Text style={[dayStyles.num, disabled && dayStyles.numDim, isToday && dayStyles.numToday]}>
              {date.day}
            </Text>
          </View>
        </View>
        <View style={dayStyles.dotRow}>
          {dots.slice(0, 6).map((d: { key: string; color: string }, i: number) => (
            <View key={`${d.key}-${i}`} style={[dayStyles.dot, { backgroundColor: d.color }]} />
          ))}
        </View>
      </Pressable>
    );
  }, [dotsByDate, wellnessByDate, nav]);

  const streaks: StreakRow[] = useMemo(() => {
    const out: StreakRow[] = [];
    for (const t of ALL_TYPES) {
      const goal = settings.goals[t];
      if (!goal) continue;
      const s = calculateStreak(sessions, t, goal, settings.weekStartsOn);
      out.push({ type: t, goal, ...s });
    }
    return out;
  }, [sessions, settings.goals, settings.weekStartsOn]);

  // Milestone detection: surface a celebration overlay if any streak crossed a
  // milestone threshold since the user last opened this screen.
  useEffect(() => {
    if (streaks.length === 0) return;
    (async () => {
      const lastSeen = await getLastSeenStreaks();
      const nextSeen: Record<string, number> = { ...lastSeen };
      let toCelebrate: { type: SessionType; weeks: number } | null = null;

      for (const s of streaks) {
        const prev = lastSeen[s.type] ?? 0;
        nextSeen[s.type] = s.weeks;
        for (const m of MILESTONES) {
          if (prev < m && s.weeks >= m && !toCelebrate) {
            toCelebrate = { type: s.type, weeks: m };
            break;
          }
        }
      }
      await saveLastSeenStreaks(nextSeen);
      if (toCelebrate) setMilestone(toCelebrate);
    })();
  }, [streaks]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {streaks.length > 0 && (
        <Section title="Streaks" subtitle="Consecutive weeks hitting your goal">
          <View style={styles.streakRow}>
            {streaks.map((s, i) => (
              <StreakChip key={s.type} row={s} index={i} />
            ))}
          </View>
        </Section>
      )}

      <Calendar
        key={firstDay}
        dayComponent={renderDay}
        firstDay={firstDay}
        enableSwipeMonths
        theme={{
          calendarBackground: colors.bg,
          backgroundColor: colors.bg,
          dayTextColor: colors.text,
          monthTextColor: colors.text,
          textDisabledColor: colors.textFaint,
          arrowColor: colors.primary,
          todayTextColor: colors.primary,
          textMonthFontWeight: '700',
          textDayFontWeight: '500',
          textDayHeaderFontWeight: '700',
          textSectionTitleColor: colors.textDim,
        }}
      />

      <Section title="Legend" style={{ marginTop: spacing.lg }}>
        <View style={styles.legend}>
          {ALL_TYPES.map((t) => (
            <View key={t} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: typeColors[t as SessionType] }]} />
              <Text style={styles.legendText}>{t}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={styles.wellnessSwatch} />
            <Text style={styles.legendText}>Date tint = wellness score</Text>
          </View>
        </View>
      </Section>

      <CelebrationOverlay
        visible={!!milestone}
        onDismiss={() => setMilestone(null)}
        headline={milestone ? `${milestone.type.toUpperCase()}` : ''}
        subline={milestone ? `${milestone.weeks}-week streak unlocked` : ''}
        icon={milestone ? (typeIcons[milestone.type] as any) : undefined}
        iconColor={milestone ? typeColors[milestone.type] : zelda.triforceGold}
      />
    </ScrollView>
  );
}

function StreakChip({ row }: { row: StreakRow; index: number }) {
  const tint = typeColors[row.type];
  const burning = row.weeks > 0;

  // Continuously-shifting gradient sheen in the activity color (active streaks
  // only). A colored band sweeps left→right on a loop — no scale/move "pop".
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(-1);

  useEffect(() => {
    if (burning) {
      sweep.value = withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      );
    } else {
      sweep.value = -1;
    }
  }, [burning, sweep]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * (width || 120) }],
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.streakChip,
        { borderColor: burning ? tint : colors.border, backgroundColor: burning ? tint + '14' : colors.surface },
      ]}
    >
      {burning && width > 0 && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheenStyle]}>
          <LinearGradient
            colors={['transparent', tint + '66', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <Ionicons
        name={burning ? 'flame' : (typeIcons[row.type] as any)}
        size={14}
        color={burning ? tint : colors.textDim}
      />
      <Text style={[styles.streakType, { color: colors.text }]}>{row.type}</Text>
      <Text style={[styles.streakWeeks, { color: burning ? tint : colors.textDim }]}>{row.weeks}w</Text>
      <Text style={styles.streakGoal}>· {row.goal}/wk</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  wellnessSwatch: {
    width: 16, height: 12, borderRadius: 3,
    backgroundColor: colors.success + '33',
    borderWidth: 1, borderColor: colors.success + '66',
  },
  legendText: { color: colors.textDim, fontSize: fontSize.xs, fontWeight: '600' },

  streakRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1.5,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  streakType: { fontSize: fontSize.sm, fontWeight: '700' },
  streakWeeks: { fontSize: fontSize.sm, fontWeight: '800' },
  streakGoal: { fontSize: fontSize.xs, color: colors.textDim, fontWeight: '600' },
});

// Custom calendar day cell — taller block, larger dots.
const dayStyles = StyleSheet.create({
  cell: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    paddingTop: 3,
    paddingBottom: 3,
    gap: 4,
  },
  // Holds the wellness tint rectangle + the number, centered on top.
  numBox: {
    width: 26, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  // Small square (no rounded edges) neon outline tinted by the wellness band.
  wellTint: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    borderRadius: 0,
    borderWidth: 1,
  },
  numWrap: {
    width: 24, height: 22, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  todayWrap: { backgroundColor: colors.primary + '33' },
  num: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  numDim: { color: colors.textFaint },
  numToday: { color: colors.primary, fontWeight: '800' },
  dotRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 3, maxWidth: 42,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

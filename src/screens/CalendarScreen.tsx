import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withSequence, withSpring, withTiming, Easing,
} from 'react-native-reanimated';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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

  const markedDates = useMemo(() => {
    const map: Record<string, { dots: { color: string; key: string }[] }> = {};
    // Session-type dots
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = { dots: [] };
      const color = typeColors[s.type];
      if (!map[s.date].dots.find((d) => d.color === color)) {
        map[s.date].dots.push({ key: s.type, color });
      }
    }
    // Wellness dot for each day with a daily log (uses wellness-band color)
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
      const color = wellnessBand(w.score).color;
      if (!map[log.date]) map[log.date] = { dots: [] };
      if (!map[log.date].dots.find((d) => d.key === 'wellness')) {
        // Insert at front so it reads as the "left-most" indicator
        map[log.date].dots.unshift({ key: 'wellness', color });
      }
    }
    const t = todayString();
    const out: any = { ...map };
    out[t] = {
      ...(out[t] ?? { dots: [] }),
      selected: true,
      selectedColor: colors.primary + '33',
    };
    return out;
  }, [sessions, dailyLogs, settings.defaultWeeklyTargetLoad, settings.weekStartsOn]);

  const firstDay = settings.weekStartsOn === 'sunday' ? 0 : 1;

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
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={(day) => nav.navigate('DayDetail', { date: day.dateString })}
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
            <View style={[styles.dot, {
              backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.textDim,
            }]} />
            <Text style={styles.legendText}>Daily log (color = wellness)</Text>
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

function StreakChip({ row, index }: { row: StreakRow; index: number }) {
  const tint = typeColors[row.type];
  const burning = row.weeks > 0;

  // Ignition animation
  const scale = useSharedValue(0.6);
  const op = useSharedValue(0);
  const flameScale = useSharedValue(0.8);

  useEffect(() => {
    op.value = withDelay(index * 70, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
    scale.value = withDelay(
      index * 70,
      withSequence(
        withSpring(1.08, { damping: 7, stiffness: 200 }),
        withSpring(1.0, { damping: 11, stiffness: 200 }),
      )
    );
    if (burning) {
      flameScale.value = withDelay(
        180 + index * 70,
        withSequence(
          withSpring(1.25, { damping: 5, stiffness: 220 }),
          withSpring(1.0, { damping: 9, stiffness: 220 }),
        )
      );
    }
  }, [burning, index, op, scale, flameScale]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: scale.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  return (
    <Animated.View style={[styles.streakChip, { borderColor: burning ? tint : colors.border }, chipStyle]}>
      <Animated.View style={flameStyle}>
        <Ionicons
          name={burning ? 'flame' : (typeIcons[row.type] as any)}
          size={14}
          color={burning ? tint : colors.textDim}
        />
      </Animated.View>
      <Text style={[styles.streakType, { color: colors.text }]}>{row.type}</Text>
      <Text style={[styles.streakWeeks, { color: burning ? tint : colors.textDim }]}>{row.weeks}w</Text>
      <Text style={styles.streakGoal}>· {row.goal}/wk</Text>
    </Animated.View>
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
  legendText: { color: colors.textDim, fontSize: fontSize.xs, fontWeight: '600' },

  streakRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  streakType: { fontSize: fontSize.sm, fontWeight: '700' },
  streakWeeks: { fontSize: fontSize.sm, fontWeight: '800' },
  streakGoal: { fontSize: fontSize.xs, color: colors.textDim, fontWeight: '600' },
});

import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import { Session, SessionType, Settings, DEFAULT_SETTINGS, DailyLog, DailyInsight } from '../types';
import {
  getSessions, getSettings, seedDefaultsIfEmpty, updateSession,
  getLastSeenWeeklyPercent, saveLastSeenWeeklyPercent,
  getDailyLogs, upsertDailyLog, getDailyInsight,
  migrateSleepQualityIfNeeded,
} from '../storage';
import { calculateWeeklyLoad, getLoadZone } from '../load';
import { weekRange, isInRange, todayString, parseDateString } from '../dates';
import { generateSmartMessage } from '../messages';
import { calculateWellness } from '../wellness';
import { calculateReadiness } from '../readiness';
import { generateDailyInsight } from '../api/insights';
import { syncStravaActivities } from '../api/strava-sync';
import { addDays } from 'date-fns';
import { toDateString } from '../dates';
import { QuickAddBar } from '../components/QuickAddBar';
import { LoadBar } from '../components/LoadBar';
import { SessionCard } from '../components/SessionCard';
import { Section, Card } from '../components/Section';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { PulseNumber } from '../components/PulseNumber';
import { FadeInView } from '../components/FadeInView';
import { TypewriterText } from '../components/TypewriterText';
import { TriforceBurst } from '../components/TriforceBurst';
import { DailyLogRow } from '../components/DailyLogRow';
import { DailyInsightCard } from '../components/DailyInsightCard';
import { TrainingReadinessCard } from '../components/TrainingReadinessCard';
import * as haptics from '../haptics';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TodayScreen() {
  const nav = useNavigation<Nav>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [smartMessage, setSmartMessage] = useState('');
  const firstLoadRef = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    await seedDefaultsIfEmpty();
    await migrateSleepQualityIfNeeded();

    // Best-effort Strava sync. Silently no-ops if not configured; logs but
    // doesn't throw on transient API errors so the screen always renders.
    try {
      await syncStravaActivities();
    } catch (err) {
      // Swallow — surfaced via the Strava setup screen on next visit
      console.warn('Strava sync failed:', err);
    }

    const [s, st, logs] = await Promise.all([
      getSessions(), getSettings(), getDailyLogs(),
    ]);
    setSessions(s);
    setSettings(st);
    setDailyLogs(logs);

    const { startStr, endStr } = weekRange(new Date(), st.weekStartsOn);
    const weekSessions = s.filter((x) => isInRange(x.date, startStr, endStr));
    const weekly = calculateWeeklyLoad(weekSessions, st.defaultWeeklyTargetLoad);
    const newMsg = generateSmartMessage(weekly, s);
    setSmartMessage(newMsg);

    // Load cached insight for tomorrow
    const tomorrow = toDateString(addDays(new Date(), 1));
    const cached = await getDailyInsight(tomorrow);
    setInsight(cached ?? null);

    // Celebration: pulled-to-refresh AND projected weekly % went up since last open
    const lastSeen = await getLastSeenWeeklyPercent();
    if (isRefresh && weekly.percentProjected > lastSeen + 4) {
      haptics.success();
      setBurstKey((k) => k + 1);
    }
    await saveLastSeenWeeklyPercent(weekly.percentProjected);

    firstLoadRef.current = false;
  }, []);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const today = todayString();
  const todayLog = dailyLogs.find((l) => l.date === today);
  const todaySessions = sessions.filter((s) => s.date === today);
  const planned = todaySessions.filter((s) => s.status === 'Planned');
  const done = todaySessions.filter((s) => s.status === 'Completed' || s.status === 'Partial');

  const { startStr, endStr } = weekRange(new Date(), settings.weekStartsOn);
  const weekSessions = sessions.filter((s) => isInRange(s.date, startStr, endStr));
  const weekly = calculateWeeklyLoad(weekSessions, settings.defaultWeeklyTargetLoad);
  const zone = getLoadZone(weekly.percentProjected);
  const wellness = calculateWellness(
    today, todayLog, dailyLogs, sessions,
    settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
  );
  const readiness = calculateReadiness(
    today, dailyLogs, sessions,
    settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
  );

  // Gradient colors shift with the zone
  const gradientColors: [string, string] =
    zone.key === 'light' ? [zelda.skyTeal + '33', colors.surface]
    : zone.key === 'moderate' ? [zelda.rupeeGreen + '33', colors.surface]
    : zone.key === 'productive' ? [zelda.rupeeBlue + '33', colors.surface]
    : zone.key === 'high' ? [zelda.triforceGold + '33', colors.surface]
    : [zelda.rupeeRed + '44', colors.surface];

  const onQuickAdd = (type: SessionType) => {
    nav.navigate('AddSession', { type, date: today, startStatus: 'Completed' });
  };

  const onMarkComplete = async (id: string) => {
    haptics.success();
    setBurstKey((k) => k + 1);
    await updateSession(id, { status: 'Completed' });
    load(false);
  };

  const updateLog = async (patch: Partial<DailyLog>) => {
    const updated = await upsertDailyLog({ date: today, ...patch });
    setDailyLogs((prev) => {
      const idx = prev.findIndex((l) => l.date === today);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  };

  const refreshInsight = async () => {
    setInsightLoading(true);
    setInsightError(null);
    try {
      const result = await generateDailyInsight({ force: true });
      setInsight(result);
      haptics.success();
    } catch (err: any) {
      setInsightError(err?.message ?? 'Failed to generate insight');
      haptics.error();
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <FadeInView delay={0} spring>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.dim}>{format(parseDateString(today), 'EEEE')}</Text>
              <Text style={styles.h1}>{format(parseDateString(today), 'MMMM d')}</Text>
            </View>
            <View style={styles.heroBtns}>
              <Pressable style={styles.iconBtn} onPress={() => { haptics.tap(); nav.navigate('Goals'); }}>
                <Ionicons name="flag-outline" size={18} color={colors.text} />
                <Text style={styles.iconBtnText}>Goals</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => { haptics.tap(); nav.navigate('Backfill'); }}>
                <Ionicons name="time-outline" size={18} color={colors.text} />
                <Text style={styles.iconBtnText}>Backfill</Text>
              </Pressable>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <TrainingReadinessCard
            readiness={readiness}
            onPress={() => nav.navigate('Readiness')}
          />
        </FadeInView>

        <FadeInView delay={120}>
          <View style={styles.smartCardWrap}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.smartGradient}
            >
              <Text style={styles.smartTitle}>Today's read</Text>
              <TypewriterText text={smartMessage} style={styles.smartText} speed={16} delay={200} />
              <View style={{ height: spacing.md }} />
              <View style={styles.bigPctRow}>
                <AnimatedNumber
                  value={weekly.percentProjected}
                  style={[styles.bigPct, { color: zone.color }]}
                  suffix="%"
                  duration={900}
                />
                <Text style={styles.bigPctSuffix}>of weekly target</Text>
              </View>
              <View style={{ height: spacing.sm }} />
              <LoadBar
                completedPercent={weekly.percentCompleted}
                projectedPercent={weekly.percentProjected}
              />
            </LinearGradient>
          </View>
        </FadeInView>

        <FadeInView delay={140}>
          <DailyLogRow
            log={todayLog}
            wellness={wellness.score}
            onChange={updateLog}
            onOpenFull={() => nav.navigate('DailyLog', { date: today })}
            onOpenWellness={() => nav.navigate('Wellness')}
          />
        </FadeInView>

        <FadeInView delay={200}>
          <DailyInsightCard
            insight={insight}
            loading={insightLoading}
            error={insightError}
            onRefresh={refreshInsight}
            onOpenSettings={() => nav.navigate('Goals')}
          />
        </FadeInView>

        <FadeInView delay={260}>
          <Section title="Quick add">
            <QuickAddBar onPick={onQuickAdd} />
          </Section>
        </FadeInView>

        {planned.length > 0 && (
          <FadeInView delay={320}>
            <Section title="Planned today">
              {planned.map((s, i) => (
                <FadeInView key={s.id} delay={360 + i * 60}>
                  <View style={styles.plannedWrap}>
                    <SessionCard
                      session={s}
                      onPress={() => nav.navigate('AddSession', { sessionId: s.id })}
                    />
                    <View style={styles.plannedActions}>
                      <Pressable
                        style={[styles.smallBtn, { backgroundColor: colors.success }]}
                        onPress={() => onMarkComplete(s.id)}
                      >
                        <Ionicons name="checkmark" size={16} color="#0B0F14" />
                        <Text style={styles.smallBtnText}>Mark completed</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
                        onPress={() => nav.navigate('AddSession', { sessionId: s.id })}
                      >
                        <Ionicons name="create-outline" size={16} color={colors.text} />
                        <Text style={[styles.smallBtnText, { color: colors.text }]}>Edit</Text>
                      </Pressable>
                    </View>
                  </View>
                </FadeInView>
              ))}
            </Section>
          </FadeInView>
        )}

        <FadeInView delay={400}>
          <Section title={done.length > 0 ? 'Completed today' : 'Nothing logged today'}>
            {done.length > 0 ? (
              done.map((s, i) => (
                <FadeInView key={s.id} delay={440 + i * 60}>
                  <SessionCard
                    session={s}
                    onPress={() => nav.navigate('AddSession', { sessionId: s.id })}
                  />
                </FadeInView>
              ))
            ) : (
              <Card>
                <Text style={styles.dim}>Tap a quick-add above to log a session in under 30 seconds.</Text>
              </Card>
            )}
          </Section>
        </FadeInView>

        <FadeInView delay={460}>
          <Section title="This week so far">
            <Card>
              <View style={styles.weekRow}>
                <WeekStat label="BJJ" value={weekly.byType.BJJ ?? 0} />
                <WeekStat label="Lift" value={weekly.byType.Lift ?? 0} />
                <WeekStat label="Run" value={weekly.byType.Run ?? 0} />
                <WeekStat label="Climb" value={weekly.byType['Rock Climb'] ?? 0} />
                <WeekStat label="Sauna" value={(weekly.byType.Sauna ?? 0) + (weekly.byType['Sauna + Cold Plunge'] ?? 0)} />
                <WeekStat label="Plunge" value={(weekly.byType['Cold Plunge'] ?? 0) + (weekly.byType['Sauna + Cold Plunge'] ?? 0)} />
                <WeekStat label="Rest" value={weekly.byType.Rest ?? 0} />
              </View>
              <View style={{ height: spacing.sm }} />
              <Text style={styles.dim}>
                {weekly.sessionsCompleted} completed · {weekly.sessionsPlanned} planned · target {settings.defaultWeeklyTargetLoad}
              </Text>
            </Card>
          </Section>
        </FadeInView>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
      {burstKey > 0 && (
        <View pointerEvents="none" style={styles.burstLayer}>
          <TriforceBurst trigger={burstKey} count={22} radius={140} />
        </View>
      )}
    </View>
  );
}

function WeekStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.weekStat}>
      <PulseNumber value={value} style={styles.weekStatValue} />
      <Text style={styles.weekStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroBtns: { flexDirection: 'row', gap: spacing.sm },
  h1: { color: colors.text, fontSize: fontSize.display, fontWeight: '800', letterSpacing: -0.5 },
  dim: { color: colors.textDim, fontSize: fontSize.md },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  iconBtnText: { color: colors.text, fontWeight: '600', fontSize: fontSize.sm },

  smartCardWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  smartGradient: { padding: spacing.md, gap: 4 },
  smartTitle: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  smartText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22, marginTop: 4, minHeight: 44 },

  bigPctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: spacing.sm },
  bigPct: { fontSize: fontSize.display, fontWeight: '900', letterSpacing: -1 },
  bigPctSuffix: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '600' },

  plannedWrap: { gap: spacing.sm },
  plannedActions: { flexDirection: 'row', gap: spacing.sm },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  smallBtnText: { color: '#0B0F14', fontWeight: '700', fontSize: fontSize.sm },

  weekRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  weekStat: { alignItems: 'center', minWidth: 44 },
  weekStatValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  weekStatLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2, letterSpacing: 0.4 },

  burstLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

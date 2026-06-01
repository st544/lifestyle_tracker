import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, Pressable, LayoutChangeEvent,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import { Session, SessionType, Settings, DEFAULT_SETTINGS, DailyLog, DailyInsight, FoodEntry } from '../types';
import { ALL_TYPES } from '../defaults';
import { calculateStreak } from '../streaks';
import { WeekDaysRing } from '../components/WeekDaysRing';
import { HolyMoonlightSword } from '../components/HolyMoonlightSword';
import {
  getSessions, getSettings, seedDefaultsIfEmpty, updateSession,
  getLastSeenWeeklyPercent, saveLastSeenWeeklyPercent,
  getDailyLogs, upsertDailyLog, getDailyInsight,
  migrateSleepQualityIfNeeded, migrateLoadScoresIfNeeded,
  getFoodEntriesForDate,
} from '../storage';
import { calculateWeeklyLoad } from '../load';
import { readinessBand } from '../readiness';
import { weekRange, isInRange, todayString, parseDateString } from '../dates';
import { generateSmartMessage } from '../messages';
import { calculateWellness } from '../wellness';
import { calculateReadiness } from '../readiness';
import { generateDailyInsight } from '../api/insights';
import { syncStravaActivities } from '../api/strava-sync';
import { addDays } from 'date-fns';
import { toDateString } from '../dates';
import { QuickAddBar } from '../components/QuickAddBar';
// (LoadBar now lives inside TrainingReadinessCard)
import { SessionCard } from '../components/SessionCard';
import { Section, Card } from '../components/Section';
// (AnimatedNumber moved into TrainingReadinessCard for the big projected % display)
import { PulseNumber } from '../components/PulseNumber';
import { FadeInView } from '../components/FadeInView';
// (TypewriterText moved into TrainingReadinessCard for the smart message)
import { TriforceBurst } from '../components/TriforceBurst';
import { DailyLogRow } from '../components/DailyLogRow';
import { DailyInsightCard } from '../components/DailyInsightCard';
import { TrainingReadinessCard } from '../components/TrainingReadinessCard';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TodayScreen() {
  const nav = useNavigation<Nav>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [smartMessage, setSmartMessage] = useState('');
  const firstLoadRef = useRef(true);

  // Sticky-banner scroll state. We capture the bottom Y of the readiness card
  // via onLayout, then animate a thin banner in once scrollY passes it.
  const scrollY = useSharedValue(0);
  const cardBottomY = useSharedValue(360);  // sensible default before measure
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });
  const onCardLayout = (e: LayoutChangeEvent) => {
    // The card sits below the hero (date row). Use its y + height.
    cardBottomY.value = e.nativeEvent.layout.y + e.nativeEvent.layout.height - 20;
  };
  const bannerStyle = useAnimatedStyle(() => {
    const past = scrollY.value > cardBottomY.value;
    return {
      opacity: withTiming(past ? 1 : 0, { duration: 180 }),
      transform: [{ translateY: withTiming(past ? 0 : -60, { duration: 180 }) }],
    };
  });

  const load = useCallback(async (isRefresh = false) => {
    await seedDefaultsIfEmpty();
    await migrateSleepQualityIfNeeded();
    await migrateLoadScoresIfNeeded();

    // Best-effort Strava sync. Silently no-ops if not configured; logs but
    // doesn't throw on transient API errors so the screen always renders.
    try {
      const result = await syncStravaActivities();
      if (result.imported > 0) {
        toast.success(`Strava: ${result.imported} ${result.imported === 1 ? 'activity' : 'activities'} imported`);
      }
    } catch (err) {
      // Swallow — surfaced via the Strava setup screen on next visit
      console.warn('Strava sync failed:', err);
    }

    const [s, st, logs, food] = await Promise.all([
      getSessions(), getSettings(), getDailyLogs(), getFoodEntriesForDate(todayString()),
    ]);
    setSessions(s);
    setSettings(st);
    setDailyLogs(logs);
    setFoodEntries(food);

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

  // Nutrition summary (today)
  const calConsumed = Math.round(foodEntries.reduce((a, e) => a + (e.calories || 0), 0));
  const calBurned = Math.round(done.reduce((a, s) => a + (s.activeCalories || 0), 0));
  const proteinSum = Math.round(foodEntries.reduce((a, e) => a + (e.proteinG || 0), 0));
  const carbsSum = Math.round(foodEntries.reduce((a, e) => a + (e.carbsG || 0), 0));
  const fatSum = Math.round(foodEntries.reduce((a, e) => a + (e.fatG || 0), 0));
  const calGoal = settings.dailyCalorieGoal;
  const calPct = calGoal && calGoal > 0 ? Math.min(100, (calConsumed / calGoal) * 100) : 0;

  const { startStr, endStr } = weekRange(new Date(), settings.weekStartsOn);
  const weekSessions = sessions.filter((s) => isInRange(s.date, startStr, endStr));
  const weekly = calculateWeeklyLoad(weekSessions, settings.defaultWeeklyTargetLoad, settings.bodyWeightKg);

  // Longest active streak across all goal types (for the flame chip).
  const bestStreak = ALL_TYPES.reduce((best, t) => {
    const goal = settings.goals[t];
    if (!goal) return best;
    const { weeks } = calculateStreak(sessions, t, goal, settings.weekStartsOn);
    return Math.max(best, weeks);
  }, 0);

  // Distinct days trained this week (any completed/partial non-Rest session).
  const daysTrained = new Set(
    weekSessions
      .filter((s) => (s.status === 'Completed' || s.status === 'Partial') && s.type !== 'Rest')
      .map((s) => s.date),
  ).size;
  const wellness = calculateWellness(
    today, todayLog, dailyLogs, sessions,
    settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
  );
  const readiness = calculateReadiness(
    today, dailyLogs, sessions,
    settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
  );

  const onQuickAdd = (type: SessionType) => {
    nav.navigate('AddSession', { type, date: today, startStatus: 'Completed' });
  };

  const onMarkComplete = async (id: string) => {
    haptics.success();
    setBurstKey((k) => k + 1);
    await updateSession(id, { status: 'Completed' });
    toast.success('Marked completed');
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
      toast.success('Insight updated');
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to generate insight';
      setInsightError(msg);
      haptics.error();
      toast.error(msg);
    } finally {
      setInsightLoading(false);
    }
  };

  const band = readinessBand(readiness.score);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <FadeInView delay={0} spring>
          <View style={styles.heroRow}>
            {/* Date + glowing Holy Moonlight Sword fill the left */}
            <View style={styles.heroLeft}>
              <View style={styles.heroDate}>
                <Text style={styles.dim}>{format(parseDateString(today), 'EEEE')}</Text>
                <Text style={styles.h1}>{format(parseDateString(today), 'MMMM d')}</Text>
              </View>
              <HolyMoonlightSword style={styles.sword} />
            </View>

            {/* Controls — indicators stacked above the buttons, right-aligned */}
            <View style={styles.heroControls}>
              <View style={styles.heroIndicators}>
              <Pressable
                style={styles.streakChip}
                onPress={() => { haptics.tap(); nav.navigate('Tabs', { screen: 'Calendar' } as any); }}
              >
                <Ionicons
                  name="flame"
                  size={15}
                  color={bestStreak > 0 ? '#FF8A3D' : colors.textFaint}
                />
                <Text style={[styles.streakText, { color: bestStreak > 0 ? '#FF8A3D' : colors.textDim }]}>
                  {bestStreak}w
                </Text>
              </Pressable>
              <Pressable onPress={() => { haptics.tap(); nav.navigate('Tabs', { screen: 'Week' } as any); }}>
                <WeekDaysRing value={daysTrained} max={7} size={38} color={zelda.skyTeal} />
              </Pressable>
            </View>

            <View style={styles.heroBtns}>
              <Pressable style={styles.iconBtn} onPress={() => { haptics.tap(); nav.navigate('Goals'); }}>
                <Ionicons name="flag-outline" size={16} color={colors.text} />
                <Text style={styles.iconBtnText}>Goals</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => { haptics.tap(); nav.navigate('Backfill'); }}>
                <Ionicons name="time-outline" size={16} color={colors.text} />
                <Text style={styles.iconBtnText}>Backfill</Text>
              </Pressable>
              <Pressable style={styles.gearBtn} onPress={() => { haptics.tap(); nav.navigate('Settings'); }}>
                <Ionicons name="settings-outline" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <View onLayout={onCardLayout}>
            <TrainingReadinessCard
              readiness={readiness}
              onPress={() => nav.navigate('Readiness')}
              smartMessage={smartMessage}
              completedPercent={weekly.percentCompleted}
              projectedPercent={weekly.percentProjected}
            />
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

        <FadeInView delay={520}>
          <Section title="Nutrition">
            <Pressable onPress={() => { haptics.tap(); nav.navigate('Nutrition', {}); }}>
              <Card>
                <View style={styles.nutHeader}>
                  <View style={styles.nutTitleRow}>
                    <Ionicons name="restaurant" size={16} color={colors.success} />
                    <Text style={styles.nutTitle}>Food today</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                </View>

                <View style={styles.nutBody}>
                  <View style={styles.nutMain}>
                    <Text style={styles.nutKcal}>
                      {calConsumed}
                      {calGoal ? <Text style={styles.nutKcalGoal}> / {calGoal}</Text> : null}
                    </Text>
                    <Text style={styles.nutKcalLabel}>kcal eaten{calGoal ? '' : ' today'}</Text>
                  </View>
                  <View style={styles.nutSideStats}>
                    <View style={styles.nutSideStat}>
                      <Text style={styles.nutSideVal}>{calBurned > 0 ? calBurned : '—'}</Text>
                      <Text style={styles.nutSideLbl}>Burned</Text>
                    </View>
                    {calGoal ? (
                      <View style={styles.nutSideStat}>
                        <Text style={[styles.nutSideVal, { color: calGoal - calConsumed >= 0 ? colors.success : colors.danger }]}>
                          {Math.abs(calGoal - calConsumed)}
                        </Text>
                        <Text style={styles.nutSideLbl}>{calGoal - calConsumed >= 0 ? 'Left' : 'Over'}</Text>
                      </View>
                    ) : (
                      <View style={styles.nutSideStat}>
                        <Text style={styles.nutSideVal}>{calConsumed - calBurned}</Text>
                        <Text style={styles.nutSideLbl}>Net</Text>
                      </View>
                    )}
                  </View>
                </View>

                {calGoal ? (
                  <View style={styles.nutBarTrack}>
                    <View style={[styles.nutBarFill, { width: `${calPct}%`, backgroundColor: calPct >= 100 ? colors.warn : colors.success }]} />
                  </View>
                ) : null}

                <View style={styles.nutMacros}>
                  <Text style={styles.nutMacro}>P <Text style={styles.nutMacroVal}>{proteinSum}g</Text></Text>
                  <Text style={styles.nutMacro}>C <Text style={styles.nutMacroVal}>{carbsSum}g</Text></Text>
                  <Text style={styles.nutMacro}>F <Text style={styles.nutMacroVal}>{fatSum}g</Text></Text>
                  <Text style={styles.nutHint}>
                    {foodEntries.length === 0 ? 'Tap to log food' : `${foodEntries.length} item${foodEntries.length === 1 ? '' : 's'} · tap for detail`}
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Section>
        </FadeInView>

        <View style={{ height: spacing.xxl }} />
      </Animated.ScrollView>

      {/* Sticky banner — appears when user scrolls past the readiness card */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stickyBanner,
          { borderBottomColor: band.color + '66', backgroundColor: colors.bg + 'F2' },
          bannerStyle,
        ]}
      >
        <Text style={[styles.stickyLabel, { color: band.color }]}>READINESS</Text>
        <Text style={[styles.stickyScore, { color: band.color }]}>{readiness.score}</Text>
        <Text style={[styles.stickyBand, { color: band.color }]}>
          {' · '}{band.label.toUpperCase()}
        </Text>
      </Animated.View>

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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroLeft: { flex: 1 },
  heroControls: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    flexShrink: 0,
  },
  heroDate: {},
  sword: { marginTop: 6, width: '100%' },
  heroIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gearBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FF8A3D55',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  streakText: { fontWeight: '800', fontSize: fontSize.sm },
  heroBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  h1: { color: colors.text, fontSize: fontSize.display, fontWeight: '800', letterSpacing: -0.5 },
  dim: { color: colors.textDim, fontSize: fontSize.md },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  iconBtnText: { color: colors.text, fontWeight: '600', fontSize: fontSize.sm },

  // Sticky readiness banner — thin one-line ticker that slides in from the
  // top once the user scrolls past the training readiness card. Sits just
  // below the tab navigator header, so it does NOT need to pad for a status
  // bar — keep it minimal.
  stickyBanner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    borderBottomWidth: 1,
    zIndex: 50,
  },
  stickyLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.2,
    marginRight: 6,
  },
  stickyScore: { fontSize: fontSize.sm, fontWeight: '900' },
  stickyBand: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  plannedWrap: { gap: spacing.sm },
  plannedActions: { flexDirection: 'row', gap: spacing.sm },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  smallBtnText: { color: '#0B0F14', fontWeight: '700', fontSize: fontSize.sm },

  // Nutrition summary panel
  nutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nutTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nutTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  nutBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.sm },
  nutMain: {},
  nutKcal: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900', letterSpacing: -0.5 },
  nutKcalGoal: { color: colors.textDim, fontSize: fontSize.lg, fontWeight: '700' },
  nutKcalLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: -2 },
  nutSideStats: { flexDirection: 'row', gap: spacing.lg },
  nutSideStat: { alignItems: 'flex-end' },
  nutSideVal: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  nutSideLbl: { color: colors.textDim, fontSize: fontSize.xs, letterSpacing: 0.4 },
  nutBarTrack: {
    height: 7, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  nutBarFill: { height: '100%', borderRadius: radius.pill },
  nutMacros: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  nutMacro: { color: colors.textDim, fontSize: fontSize.xs, fontWeight: '700' },
  nutMacroVal: { color: colors.text, fontWeight: '800' },
  nutHint: { color: colors.textFaint, fontSize: fontSize.xs, marginLeft: 'auto' },

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

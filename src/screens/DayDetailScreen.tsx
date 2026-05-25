import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius, typeColors, zelda } from '../theme';
import { Session, SessionType, DailyLog, Settings, DEFAULT_SETTINGS } from '../types';
import {
  getSessionsForDate, updateSession, deleteSession,
  getDailyLog, upsertDailyLog, getDailyLogs, getSessions, getSettings,
} from '../storage';
import { formatLong } from '../dates';
import { calculateWellness, wellnessBand } from '../wellness';
import { SessionCard } from '../components/SessionCard';
import { Section, Card } from '../components/Section';
import { QuickAddBar } from '../components/QuickAddBar';
import { DailyLogRow } from '../components/DailyLogRow';
import * as haptics from '../haptics';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DayDetail'>;
type R = RouteProp<RootStackParamList, 'DayDetail'>;

export default function DayDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const { date } = route.params;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLog | undefined>(undefined);
  const [allDailyLogs, setAllDailyLogs] = useState<DailyLog[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    const [s, log, logs, allS, st] = await Promise.all([
      getSessionsForDate(date),
      getDailyLog(date),
      getDailyLogs(),
      getSessions(),
      getSettings(),
    ]);
    setSessions(s);
    setDailyLog(log);
    setAllDailyLogs(logs);
    setAllSessions(allS);
    setSettings(st);
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    nav.setOptions({ title: formatLong(date) });
  }, [nav, date]);

  const wellness = calculateWellness(
    date, dailyLog, allDailyLogs, allSessions,
    settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
  );

  const updateLogPatch = async (patch: Partial<DailyLog>) => {
    haptics.tap();
    const updated = await upsertDailyLog({ date, ...patch });
    setDailyLog(updated);
    const refreshed = await getDailyLogs();
    setAllDailyLogs(refreshed);
  };

  const onAdd = (type: SessionType) => {
    nav.navigate('AddSession', { type, date, startStatus: 'Completed' });
  };

  const onSessionPress = (s: Session) => {
    if (s.status === 'Planned') {
      Alert.alert(
        s.type,
        s.subtype ?? '',
        [
          { text: 'Mark Completed', onPress: async () => { await updateSession(s.id, { status: 'Completed' }); load(); } },
          { text: 'Edit / Duration', onPress: () => nav.navigate('AddSession', { sessionId: s.id }) },
          { text: 'Skip', onPress: async () => { await updateSession(s.id, { status: 'Skipped' }); load(); } },
          { text: 'Move', onPress: () => nav.navigate('AddSession', { sessionId: s.id }) },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(s.id) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      nav.navigate('AddSession', { sessionId: s.id });
    }
  };

  const onDelete = (id: string) => {
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteSession(id); load(); },
      },
    ]);
  };

  const planned = sessions.filter((s) => s.status === 'Planned');
  const done = sessions.filter((s) => s.status === 'Completed' || s.status === 'Partial');
  const other = sessions.filter((s) => s.status === 'Skipped' || s.status === 'Moved');

  const hasAnyWellness =
    dailyLog?.hrv != null ||
    dailyLog?.sleepHours != null ||
    dailyLog?.sleepQuality != null ||
    Object.values(dailyLog?.supplements ?? {}).some(Boolean);

  const band = wellnessBand(wellness.score);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section
        title="Daily log"
        subtitle={hasAnyWellness ? `Wellness ${wellness.score}/100 · ${band.label}` : 'Enter HRV, sleep, supplements'}
        right={
          <Pressable
            onPress={() => nav.navigate('DailyLog', { date })}
            style={styles.editChip}
          >
            <Ionicons name="create-outline" size={14} color={colors.text} />
            <Text style={styles.editChipText}>Open editor</Text>
          </Pressable>
        }
      >
        <DailyLogRow
          log={dailyLog}
          wellness={wellness.score}
          onChange={updateLogPatch}
          onOpenFull={() => nav.navigate('DailyLog', { date })}
        />
      </Section>

      <Section title="Add session to this day">
        <QuickAddBar onPick={onAdd} />
        <Pressable
          style={styles.addBtn}
          onPress={() => nav.navigate('AddSession', { date, startStatus: 'Completed' })}
        >
          <Ionicons name="add" size={18} color="#0B0F14" />
          <Text style={styles.addBtnText}>Custom session</Text>
        </Pressable>
      </Section>

      {planned.length > 0 && (
        <Section title="Planned">
          {planned.map((s) => (
            <SessionCard key={s.id} session={s} onPress={() => onSessionPress(s)} />
          ))}
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Completed">
          {done.map((s) => (
            <SessionCard key={s.id} session={s} onPress={() => onSessionPress(s)} />
          ))}
        </Section>
      )}

      {other.length > 0 && (
        <Section title="Skipped / Moved">
          {other.map((s) => (
            <SessionCard key={s.id} session={s} onPress={() => onSessionPress(s)} />
          ))}
        </Section>
      )}

      {sessions.length === 0 && (
        <Card>
          <Text style={styles.dim}>No sessions on this day yet.</Text>
        </Card>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  dim: { color: colors.textDim, fontSize: fontSize.md },
  addBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addBtnText: { color: '#0B0F14', fontWeight: '700', fontSize: fontSize.md },

  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  editChipText: { color: colors.text, fontWeight: '700', fontSize: fontSize.xs },
});

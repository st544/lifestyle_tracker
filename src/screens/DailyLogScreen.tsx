import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import { DailyLog, DEFAULT_SETTINGS, Session, Settings } from '../types';
import {
  getDailyLog, upsertDailyLog, getDailyLogs, getSessions, getSettings,
} from '../storage';
import {
  todayString, parseDateString, toDateString, formatLong,
} from '../dates';
import { calculateWellness } from '../wellness';
import { Section, Card } from '../components/Section';
import { SupplementsRow } from '../components/SupplementsRow';
import { WellnessRing } from '../components/WellnessRing';
import { DurationInput } from '../components/DurationInput';
import * as haptics from '../haptics';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DailyLog'>;
type R = RouteProp<RootStackParamList, 'DailyLog'>;

export default function DailyLogScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const initialDate = route.params?.date ?? todayString();

  const [date, setDate] = useState<string>(initialDate);
  const [log, setLog] = useState<DailyLog | undefined>(undefined);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [hrv, setHrv] = useState<string>('');
  const [quality, setQuality] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showDate, setShowDate] = useState(false);

  const load = useCallback(async (d: string) => {
    const [l, all, ss, st] = await Promise.all([
      getDailyLog(d), getDailyLogs(), getSessions(), getSettings(),
    ]);
    setLog(l);
    setAllLogs(all);
    setSessions(ss);
    setSettings(st);
    setHrv(l?.hrv != null ? String(l.hrv) : '');
    setQuality(l?.sleepQuality != null ? String(l.sleepQuality) : '');
    setNotes(l?.notes ?? '');
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const wellness = calculateWellness(
    date, log, allLogs, sessions,
    settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
  );

  const onCommitField = async (patch: Partial<DailyLog>) => {
    const updated = await upsertDailyLog({ date, ...patch });
    setLog(updated);
    const refreshed = await getDailyLogs();
    setAllLogs(refreshed);
  };

  const save = async () => {
    haptics.success();
    const hrvN = parseFloat(hrv);
    const qualityN = parseInt(quality, 10);
    await upsertDailyLog({
      date,
      hrv: isNaN(hrvN) ? undefined : hrvN,
      sleepQuality: isNaN(qualityN) ? undefined : Math.max(1, Math.min(100, qualityN)),
      notes: notes.trim() || undefined,
    });
    nav.goBack();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="Daily log" subtitle={formatLong(date)}>
        <Card>
          <View style={styles.dateRow}>
            <Pressable style={styles.dateBtn} onPress={() => setShowDate(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
              <Text style={styles.dateBtnText}>{formatLong(date)}</Text>
            </Pressable>
          </View>
          {showDate && (
            <DateTimePicker
              value={parseDateString(date)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, d) => {
                setShowDate(Platform.OS === 'ios');
                if (d) setDate(toDateString(d));
              }}
            />
          )}

          <View style={styles.ringRow}>
            <WellnessRing score={wellness.score} size={120} stroke={11} />
            <View style={styles.breakdown}>
              <BreakdownLine label="HRV" value={wellness.hrv} />
              <BreakdownLine label="Sleep" value={wellness.sleep} />
              <BreakdownLine label="Load balance" value={wellness.load} />
              {wellness.hrvBaseline ? (
                <Text style={styles.baseline}>14-day HRV baseline: {Math.round(wellness.hrvBaseline)}ms</Text>
              ) : null}
            </View>
          </View>
        </Card>
      </Section>

      <Section title="HRV & sleep">
        <Card>
          <Text style={styles.label}>Overnight HRV (ms)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 58"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            value={hrv}
            onChangeText={setHrv}
            onBlur={() => {
              const n = parseFloat(hrv);
              onCommitField({ hrv: isNaN(n) ? undefined : n });
            }}
          />
          <Text style={styles.label}>Sleep duration</Text>
          <DurationInput
            hours={log?.sleepHours}
            onChange={(h) => onCommitField({ sleepHours: h })}
            variant="full"
          />
          <Text style={styles.label}>Sleep quality (1-100)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 80"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            value={quality}
            onChangeText={setQuality}
            maxLength={3}
            onBlur={() => {
              const n = parseInt(quality, 10);
              onCommitField({
                sleepQuality: isNaN(n) ? undefined : Math.max(1, Math.min(100, n)),
              });
            }}
          />
        </Card>
      </Section>

      <Section title="Supplements taken">
        <Card>
          <SupplementsRow
            values={log?.supplements ?? {}}
            onToggle={(k, next) => onCommitField({
              supplements: { ...(log?.supplements ?? {}), [k]: next },
            })}
          />
        </Card>
      </Section>

      <Section title="Notes">
        <Card>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="How did the day feel?"
            placeholderTextColor={colors.textFaint}
            multiline
            value={notes}
            onChangeText={setNotes}
            onBlur={() => onCommitField({ notes: notes.trim() || undefined })}
          />
        </Card>
      </Section>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Ionicons name="checkmark" size={18} color="#0B0F14" />
        <Text style={styles.saveBtnText}>Done</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function BreakdownLine({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.breakdownLine}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownValue, value == null && { color: colors.textFaint }]}>
        {value == null ? '—' : Math.round(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  dateRow: { marginBottom: spacing.sm },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  dateBtnText: { color: colors.text, fontWeight: '600' },

  ringRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  breakdown: { flex: 1, gap: 4 },
  breakdownLine: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { color: colors.textDim, fontSize: fontSize.sm },
  breakdownValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  baseline: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },

  label: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    fontSize: fontSize.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },

  saveBtn: {
    backgroundColor: zelda.triforceGold, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6, marginTop: spacing.md,
  },
  saveBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
});

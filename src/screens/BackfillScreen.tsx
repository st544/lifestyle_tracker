import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius, typeColors, typeIcons } from '../theme';
import { Session, SessionType } from '../types';
import { addSession, getSessions } from '../storage';
import { TYPE_DEFAULTS, QUICK_ADD_TYPES } from '../defaults';
import { lastNDays, formatPretty } from '../dates';
import { Section, Card } from '../components/Section';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BackfillScreen() {
  const nav = useNavigation<Nav>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const days = lastNDays(7);

  const load = useCallback(async () => {
    setSessions(await getSessions());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onQuickLog = async (date: string, type: SessionType) => {
    const d = TYPE_DEFAULTS[type];
    await addSession({
      date,
      type,
      durationMinutes: d.durationMinutes,
      intensity: d.intensity,
      status: 'Completed',
    });
    load();
  };

  const onCustom = (date: string) => {
    nav.navigate('AddSession', { date, startStatus: 'Completed' });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Fill in anything you forgot to log. One tap = one default session for that day.
      </Text>

      {days.map((date) => {
        const todays = sessions.filter((s) => s.date === date);
        return (
          <Section
            key={date}
            title={formatPretty(date)}
            subtitle={todays.length === 0 ? 'No sessions logged' : `${todays.length} logged`}
            right={
              <Pressable onPress={() => onCustom(date)} style={styles.iconChip}>
                <Ionicons name="add" size={14} color={colors.text} />
                <Text style={styles.iconChipText}>Custom</Text>
              </Pressable>
            }
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
              {QUICK_ADD_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.qBtn, { borderColor: typeColors[t] }]}
                  onPress={() => onQuickLog(date, t)}
                >
                  <Ionicons name={typeIcons[t] as any} size={16} color={typeColors[t]} />
                  <Text style={styles.qBtnText}>+ {t}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {todays.length > 0 && (
              <Card style={{ marginTop: spacing.sm }}>
                {todays.map((s) => (
                  <Text key={s.id} style={styles.loggedLine}>
                    · {s.type}{s.subtype ? ` (${s.subtype})` : ''} — {s.durationMinutes} min
                  </Text>
                ))}
              </Card>
            )}
          </Section>
        );
      })}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  intro: { color: colors.textDim, fontSize: fontSize.md, marginBottom: spacing.sm },
  btnRow: { gap: spacing.sm, paddingVertical: 2 },
  qBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1.5, backgroundColor: colors.surface,
  },
  qBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  iconChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill,
  },
  iconChipText: { color: colors.text, fontSize: fontSize.xs, fontWeight: '700' },
  loggedLine: { color: colors.textDim, fontSize: fontSize.sm, paddingVertical: 2 },
});

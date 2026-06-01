import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius, typeColors, typeIcons } from '../theme';
import { Template, SessionType, SessionStatus } from '../types';
import { addSession, getTemplates, deleteTemplate } from '../storage';
import { TYPE_DEFAULTS, ALL_TYPES } from '../defaults';
import { todayString } from '../dates';
import { Section, Card } from '../components/Section';
import { Pill } from '../components/Pill';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddTabScreen() {
  const nav = useNavigation<Nav>();
  const [templates, setTemplates] = useState<Template[]>([]);

  const load = useCallback(async () => {
    setTemplates(await getTemplates());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = todayString();

  const openAddForType = (type: SessionType, startStatus: 'Planned' | 'Completed' = 'Completed') => {
    nav.navigate('AddSession', { type, date: today, startStatus });
  };

  const applyTemplate = (tpl: Template, status: SessionStatus) => {
    Alert.alert(
      tpl.name,
      `Add this template as ${status.toLowerCase()} for today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add', onPress: async () => {
            await addSession({
              date: today,
              type: tpl.type,
              subtype: tpl.subtype,
              durationMinutes: tpl.durationMinutes,
              intensity: tpl.intensity,
              location: tpl.location,
              startTime: tpl.startTime,
              notes: tpl.notes,
              status,
            });
            Alert.alert('Logged', `${tpl.name} added for today.`);
          },
        },
      ],
    );
  };

  const onDeleteTemplate = (id: string) => {
    Alert.alert('Delete template?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTemplate(id); load(); } },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Section title="Quick add for today">
        <View style={styles.grid}>
          {ALL_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.tile, { borderColor: typeColors[t] }]}
              onPress={() => openAddForType(t)}
            >
              <Ionicons name={typeIcons[t] as any} size={22} color={typeColors[t]} />
              <Text style={styles.tileLabel}>{t}</Text>
              <Text style={styles.tileMeta}>
                {TYPE_DEFAULTS[t].durationMinutes} min · RPE {TYPE_DEFAULTS[t].intensity}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Plan ahead">
        <Pressable
          style={styles.planBtn}
          onPress={() => nav.navigate('AddSession', { date: today, startStatus: 'Planned' })}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.text} />
          <Text style={styles.planBtnText}>Plan a future session</Text>
        </Pressable>
      </Section>

      <Section title="Templates" subtitle="Save sessions you repeat often">
        {templates.length === 0 ? (
          <Card>
            <Text style={styles.dim}>
              No templates yet. Save any session as a template from its edit screen.
            </Text>
          </Card>
        ) : (
          templates.map((tpl) => (
            <Card key={tpl.id} style={styles.tplCard}>
              <View style={{ flex: 1 }}>
                <View style={styles.tplTitleRow}>
                  <View style={[styles.dot, { backgroundColor: typeColors[tpl.type] }]} />
                  <Text style={styles.tplName}>{tpl.name}</Text>
                </View>
                <Text style={styles.tplMeta}>
                  {tpl.type}{tpl.subtype ? ` · ${tpl.subtype}` : ''} · {tpl.durationMinutes} min
                  {tpl.intensity ? ` · RPE ${tpl.intensity}` : ''}
                  {tpl.location ? ` · ${tpl.location}` : ''}
                </Text>
              </View>
              <View style={styles.tplActions}>
                <Pill label="Log" small color={colors.success}
                      onPress={() => applyTemplate(tpl, 'Completed')} selected />
                <Pill label="Plan" small color={colors.primary}
                      onPress={() => applyTemplate(tpl, 'Planned')} selected />
                <Pressable onPress={() => onDeleteTemplate(tpl.id)} style={styles.trash}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </Section>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  dim: { color: colors.textDim, fontSize: fontSize.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
    gap: 6,
    minHeight: 86,
  },
  tileLabel: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm },
  tileMeta: { color: colors.textDim, fontSize: fontSize.xs },

  planBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingVertical: 14, borderWidth: 1, borderColor: colors.border,
  },
  planBtnText: { color: colors.text, fontWeight: '700' },

  tplCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tplTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tplName: { color: colors.text, fontWeight: '700', fontSize: fontSize.md },
  tplMeta: { color: colors.textDim, fontSize: fontSize.sm, marginTop: 2 },
  tplActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trash: { padding: 6 },
});

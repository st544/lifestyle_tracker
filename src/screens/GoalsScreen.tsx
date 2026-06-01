import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius, typeColors, typeIcons } from '../theme';
import { SessionType, Settings, DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../storage';
import { toast } from '../toast';
import { ALL_TYPES } from '../defaults';
import { Section, Card } from '../components/Section';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Goals'>;

/**
 * Goals = the targets the user sets for themselves (weekly session minimums,
 * weekly load target, daily calorie goal). Device/credential settings live in
 * SettingsScreen.
 */
export default function GoalsScreen() {
  const nav = useNavigation<Nav>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [target, setTarget] = useState<string>(String(DEFAULT_SETTINGS.defaultWeeklyTargetLoad));
  const [calorieGoal, setCalorieGoal] = useState<string>('');

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTarget(String(s.defaultWeeklyTargetLoad));
      setCalorieGoal(s.dailyCalorieGoal != null ? String(s.dailyCalorieGoal) : '');
    });
  }, []);

  const setGoal = useCallback((type: SessionType, value: number) => {
    setSettings((prev) => {
      const next = { ...prev, goals: { ...prev.goals } };
      if (value <= 0) delete next.goals[type];
      else next.goals[type] = value;
      return next;
    });
  }, []);

  const save = async () => {
    const next: Settings = {
      ...settings,
      defaultWeeklyTargetLoad: parseInt(target, 10) || DEFAULT_SETTINGS.defaultWeeklyTargetLoad,
      dailyCalorieGoal: parseInt(calorieGoal, 10) > 0 ? parseInt(calorieGoal, 10) : undefined,
    };
    await saveSettings(next);
    toast.success('Goals saved');
    nav.goBack();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="Weekly session goals" subtitle="Minimum sessions per week to keep a streak alive. Set to 0 to disable.">
        <Card>
          {ALL_TYPES.map((type) => {
            const value = settings.goals[type] ?? 0;
            return (
              <View key={type} style={styles.row}>
                <View style={styles.left}>
                  <View style={[styles.dot, { backgroundColor: typeColors[type] }]} />
                  <Ionicons name={typeIcons[type] as any} size={16} color={typeColors[type]} />
                  <Text style={styles.rowLabel}>{type}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => setGoal(type, Math.max(0, value - 1))}>
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.stepValue}>{value}</Text>
                  <Pressable style={styles.stepBtn} onPress={() => setGoal(type, value + 1)}>
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Weekly load target" subtitle="loadScore the bar fills against. (Also editable by tapping Target on the This Week tab.)">
        <Card>
          <TextInput
            style={styles.textInput}
            keyboardType="number-pad"
            value={target}
            onChangeText={setTarget}
            placeholder="4000"
            placeholderTextColor={colors.textFaint}
          />
        </Card>
      </Section>

      <Section title="Daily calorie goal" subtitle="Drives the Nutrition progress bar. Optional.">
        <Card>
          <TextInput
            style={styles.textInput}
            keyboardType="number-pad"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            placeholder="e.g. 2400"
            placeholderTextColor={colors.textFaint}
          />
        </Card>
      </Section>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Ionicons name="checkmark" size={18} color="#0B0F14" />
        <Text style={styles.saveBtnText}>Save goals</Text>
      </Pressable>

      <Pressable style={styles.linkBtn} onPress={() => nav.navigate('Settings')}>
        <Ionicons name="settings-outline" size={16} color={colors.textDim} />
        <Text style={styles.linkBtnText}>Device settings, integrations & API keys</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </Pressable>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  stepValue: { color: colors.text, fontWeight: '800', fontSize: fontSize.lg, minWidth: 22, textAlign: 'center' },
  textInput: {
    backgroundColor: colors.surfaceAlt, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.md,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6, marginTop: spacing.md,
  },
  saveBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, marginTop: spacing.sm,
  },
  linkBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm, flex: 1 },
});

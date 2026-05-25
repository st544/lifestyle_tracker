import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { colors, spacing, fontSize, radius, typeColors, typeIcons } from '../theme';
import { SessionType, Settings, DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings, exportAllAsJson } from '../storage';
import { todayString } from '../dates';
import * as haptics from '../haptics';
import { ALL_TYPES } from '../defaults';
import { Section, Card } from '../components/Section';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Goals'>;

export default function GoalsScreen() {
  const nav = useNavigation<Nav>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [target, setTarget] = useState<string>(String(DEFAULT_SETTINGS.defaultWeeklyTargetLoad));
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [maxHr, setMaxHr] = useState<string>(String(DEFAULT_SETTINGS.maxHeartRate ?? 190));
  const [restingHr, setRestingHr] = useState<string>(String(DEFAULT_SETTINGS.restingHeartRate ?? 60));

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTarget(String(s.defaultWeeklyTargetLoad));
      setApiKey(s.anthropicApiKey ?? '');
      setMaxHr(String(s.maxHeartRate ?? 190));
      setRestingHr(String(s.restingHeartRate ?? 60));
    });
  }, []);

  const setGoal = useCallback((type: SessionType, value: number) => {
    setSettings((prev) => {
      const next = { ...prev, goals: { ...prev.goals } };
      if (value <= 0) {
        delete next.goals[type];
      } else {
        next.goals[type] = value;
      }
      return next;
    });
  }, []);

  const exportData = async () => {
    try {
      haptics.tap();
      const json = await exportAllAsJson();
      const filename = `training-export-${todayString()}.json`;
      const file = new File(Paths.cache, filename);
      // expo-file-system v19+: File has .write() / .text() etc.
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export training data',
        });
        haptics.success();
      } else {
        Alert.alert('Sharing unavailable', `File written to ${file.uri}`);
      }
    } catch (err: any) {
      haptics.error();
      Alert.alert('Export failed', err?.message ?? String(err));
    }
  };

  const save = async () => {
    const next: Settings = {
      ...settings,
      defaultWeeklyTargetLoad: parseInt(target, 10) || DEFAULT_SETTINGS.defaultWeeklyTargetLoad,
      anthropicApiKey: apiKey.trim() || undefined,
      maxHeartRate: parseInt(maxHr, 10) || DEFAULT_SETTINGS.maxHeartRate,
      restingHeartRate: parseInt(restingHr, 10) || DEFAULT_SETTINGS.restingHeartRate,
    };
    await saveSettings(next);
    nav.goBack();
  };

  const toggleWeekStart = (val: 'sunday' | 'monday') => {
    setSettings((prev) => ({ ...prev, weekStartsOn: val }));
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
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setGoal(type, Math.max(0, value - 1))}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.stepValue}>{value}</Text>
                  <Pressable
                    style={styles.stepBtn}
                    onPress={() => setGoal(type, value + 1)}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Weekly load target" subtitle="loadScore the bar fills against.">
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

      <Section title="Week starts on">
        <Card>
          <View style={styles.weekBtns}>
            {(['sunday', 'monday'] as const).map((d) => {
              const active = settings.weekStartsOn === d;
              return (
                <Pressable
                  key={d}
                  style={[styles.weekBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => toggleWeekStart(d)}
                >
                  <Text style={[styles.weekBtnText, active && { color: '#0B0F14' }]}>
                    {d === 'sunday' ? 'Sunday' : 'Monday'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </Section>

      <Section title="Heart rate" subtitle="Used to estimate RPE from imported activities.">
        <Card>
          <View style={styles.twoColRow}>
            <View style={styles.col}>
              <Text style={styles.hrLabel}>Max HR</Text>
              <TextInput
                style={styles.textInput}
                value={maxHr}
                onChangeText={setMaxHr}
                keyboardType="number-pad"
                placeholder="190"
                placeholderTextColor={colors.textFaint}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.hrLabel}>Resting HR</Text>
              <TextInput
                style={styles.textInput}
                value={restingHr}
                onChangeText={setRestingHr}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={colors.textFaint}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Default 190 / 60. If you don't know your max, 220 - age is a rough estimate.
          </Text>
        </Card>
      </Section>

      <Section title="Strava sync" subtitle="Auto-import activities from Strava (which Garmin / watches push into).">
        <Pressable
          style={styles.stravaBtn}
          onPress={() => nav.navigate('StravaSetup')}
        >
          <Ionicons name="link" size={16} color="#0B0F14" />
          <Text style={styles.stravaBtnText}>Configure Strava</Text>
        </Pressable>
      </Section>

      <Section title="Import HRV / sleep CSV" subtitle="Backfill from Garmin Connect, Whoop, Oura, or a hand-rolled spreadsheet.">
        <Pressable
          style={styles.csvBtn}
          onPress={() => nav.navigate('CsvImport')}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#0B0F14" />
          <Text style={styles.csvBtnText}>Import CSV</Text>
        </Pressable>
      </Section>

      <Section
        title="Export data"
        subtitle="JSON dump of all sessions, daily logs, templates, weekly checklists, and insights. API keys are stripped."
      >
        <Pressable style={styles.exportBtn} onPress={exportData}>
          <Ionicons name="download-outline" size={16} color="#0B0F14" />
          <Text style={styles.exportBtnText}>Export all data as JSON</Text>
        </Pressable>
      </Section>

      <Section title="Daily AI insight" subtitle="Anthropic API key — used to call Claude once per day for tomorrow's recommendation. Stored only on this device.">
        <Card>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="sk-ant-..."
              placeholderTextColor={colors.textFaint}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowApiKey((v) => !v)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.textDim}
              />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Get a key at console.anthropic.com. Cost is roughly $0.005 per insight ({'<'}$2/year at one call/day).
          </Text>
        </Card>
      </Section>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Ionicons name="checkmark" size={18} color="#0B0F14" />
        <Text style={styles.saveBtnText}>Save</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  stepValue: { color: colors.text, fontWeight: '800', fontSize: fontSize.lg, minWidth: 22, textAlign: 'center' },

  textInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    fontSize: fontSize.md,
  },

  weekBtns: { flexDirection: 'row', gap: spacing.sm },
  weekBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  weekBtnText: { color: colors.text, fontWeight: '700' },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6, marginTop: spacing.md,
  },
  saveBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  twoColRow: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  hrLabel: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stravaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FC4C02',
    paddingVertical: 14, borderRadius: radius.pill,
  },
  stravaBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  csvBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#6FDDD9',
    paddingVertical: 14, borderRadius: radius.pill,
  },
  csvBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#34D399',
    paddingVertical: 14, borderRadius: radius.pill,
  },
  exportBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm, lineHeight: 16 },
});

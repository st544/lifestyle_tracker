import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { colors, spacing, fontSize, radius } from '../theme';
import { Settings, DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings, exportAllAsJson } from '../storage';
import { todayString } from '../dates';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { Section, Card } from '../components/Section';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

/**
 * Device / integration settings — distinct from Goals (which holds the user's
 * self-set targets). Week start, heart rate, body weight, integrations, exports,
 * and API keys live here.
 */
export default function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [maxHr, setMaxHr] = useState<string>(String(DEFAULT_SETTINGS.maxHeartRate ?? 190));
  const [restingHr, setRestingHr] = useState<string>(String(DEFAULT_SETTINGS.restingHeartRate ?? 60));
  const [bodyWeightLb, setBodyWeightLb] = useState<string>(
    String(Math.round((DEFAULT_SETTINGS.bodyWeightKg ?? 80) * 2.2046)),
  );
  const [usdaKey, setUsdaKey] = useState<string>('');
  const [showUsdaKey, setShowUsdaKey] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setMaxHr(String(s.maxHeartRate ?? 190));
      setRestingHr(String(s.restingHeartRate ?? 60));
      if (typeof s.bodyWeightKg === 'number') setBodyWeightLb(String(Math.round(s.bodyWeightKg * 2.2046)));
      setUsdaKey(s.usdaApiKey ?? '');
      setApiKey(s.anthropicApiKey ?? '');
    });
  }, []);

  const toggleWeekStart = (val: 'sunday' | 'monday') => {
    setSettings((prev) => ({ ...prev, weekStartsOn: val }));
  };

  const exportData = async () => {
    try {
      haptics.tap();
      const json = await exportAllAsJson();
      const filename = `training-export-${todayString()}.json`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export training data' });
        haptics.success();
        toast.success('Exported training data');
      } else {
        Alert.alert('Sharing unavailable', `File written to ${file.uri}`);
      }
    } catch (err: any) {
      haptics.error();
      toast.error(`Export failed: ${err?.message ?? 'unknown'}`);
    }
  };

  const save = async () => {
    const lb = parseFloat(bodyWeightLb);
    const next: Settings = {
      ...settings,
      maxHeartRate: parseInt(maxHr, 10) || DEFAULT_SETTINGS.maxHeartRate,
      restingHeartRate: parseInt(restingHr, 10) || DEFAULT_SETTINGS.restingHeartRate,
      bodyWeightKg: lb > 0 ? +(lb / 2.2046).toFixed(1) : DEFAULT_SETTINGS.bodyWeightKg,
      usdaApiKey: usdaKey.trim() || undefined,
      anthropicApiKey: apiKey.trim() || undefined,
    };
    await saveSettings(next);
    toast.success('Settings saved');
    nav.goBack();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
                style={styles.textInput} value={maxHr} onChangeText={setMaxHr}
                keyboardType="number-pad" placeholder="190" placeholderTextColor={colors.textFaint}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.hrLabel}>Resting HR</Text>
              <TextInput
                style={styles.textInput} value={restingHr} onChangeText={setRestingHr}
                keyboardType="number-pad" placeholder="60" placeholderTextColor={colors.textFaint}
              />
            </View>
          </View>
          <Text style={styles.hint}>Default 190 / 60. If you don't know your max, 220 - age is a rough estimate.</Text>
        </Card>
      </Section>

      <Section title="Body weight" subtitle="Used to estimate calories (and load) for lifting, climbing, and hikes without a calorie reading.">
        <Card>
          <View style={styles.twoColRow}>
            <View style={styles.col}>
              <Text style={styles.hrLabel}>Weight (lb)</Text>
              <TextInput
                style={styles.textInput} value={bodyWeightLb} onChangeText={setBodyWeightLb}
                keyboardType="decimal-pad" placeholder="176" placeholderTextColor={colors.textFaint}
              />
            </View>
            <View style={styles.col} />
          </View>
        </Card>
      </Section>

      <Section title="Strava sync" subtitle="Auto-import activities from Strava (which Garmin / watches push into).">
        <Pressable style={styles.stravaBtn} onPress={() => nav.navigate('StravaSetup')}>
          <Ionicons name="link" size={16} color="#0B0F14" />
          <Text style={styles.darkBtnText}>Configure Strava</Text>
        </Pressable>
      </Section>

      {Platform.OS === 'android' && (
        <Section title="Health Connect (Android)" subtitle="Sync Garmin → Health Connect → app: HRV, sleep, exercise, calories, resting HR.">
          <Pressable style={styles.hcBtn} onPress={() => nav.navigate('HealthConnect')}>
            <Ionicons name="fitness-outline" size={16} color="#0B0F14" />
            <Text style={styles.darkBtnText}>Configure Health Connect</Text>
          </Pressable>
        </Section>
      )}

      <Section title="Import HRV / sleep CSV" subtitle="Backfill from Garmin Connect, Whoop, Oura, or a hand-rolled spreadsheet.">
        <Pressable style={styles.csvBtn} onPress={() => nav.navigate('CsvImport')}>
          <Ionicons name="cloud-upload-outline" size={16} color="#0B0F14" />
          <Text style={styles.darkBtnText}>Import CSV</Text>
        </Pressable>
      </Section>

      <Section title="Export data" subtitle="JSON dump of all sessions, daily logs, templates, food, and insights. API keys are stripped.">
        <Pressable style={styles.exportBtn} onPress={exportData}>
          <Ionicons name="download-outline" size={16} color="#0B0F14" />
          <Text style={styles.darkBtnText}>Export all data as JSON</Text>
        </Pressable>
      </Section>

      <Section title="Restore data" subtitle="Import a JSON export from another install (e.g. your old Expo Go app).">
        <Pressable style={styles.restoreBtn} onPress={() => nav.navigate('JsonImport')}>
          <Ionicons name="cloud-download-outline" size={16} color="#0B0F14" />
          <Text style={styles.darkBtnText}>Restore from JSON</Text>
        </Pressable>
      </Section>

      <Section title="USDA food database" subtitle="Free API key for nutrition food search.">
        <Card>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="USDA FoodData Central key"
              placeholderTextColor={colors.textFaint}
              value={usdaKey} onChangeText={setUsdaKey}
              secureTextEntry={!showUsdaKey} autoCapitalize="none" autoCorrect={false}
            />
            <Pressable onPress={() => setShowUsdaKey((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showUsdaKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textDim} />
            </Pressable>
          </View>
          <Text style={styles.hint}>Get a free key at fdc.nal.usda.gov/api-key-signup.html. Stored only on this device.</Text>
        </Card>
      </Section>

      <Section title="Daily AI insight" subtitle="Anthropic API key — used to call Claude once per day for tomorrow's recommendation. Stored only on this device.">
        <Card>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="sk-ant-..."
              placeholderTextColor={colors.textFaint}
              value={apiKey} onChangeText={setApiKey}
              secureTextEntry={!showApiKey} autoCapitalize="none" autoCorrect={false}
            />
            <Pressable onPress={() => setShowApiKey((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textDim} />
            </Pressable>
          </View>
          <Text style={styles.hint}>Get a key at console.anthropic.com. Cost is roughly $0.005 per insight ({'<'}$2/year at one call/day).</Text>
        </Card>
      </Section>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Ionicons name="checkmark" size={18} color="#0B0F14" />
        <Text style={styles.saveBtnText}>Save settings</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  textInput: {
    backgroundColor: colors.surfaceAlt, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.md,
  },
  weekBtns: { flexDirection: 'row', gap: spacing.sm },
  weekBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
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
    color: colors.textDim, fontSize: fontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  stravaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FC4C02', paddingVertical: 14, borderRadius: radius.pill,
  },
  csvBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#6FDDD9', paddingVertical: 14, borderRadius: radius.pill,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#34D399', paddingVertical: 14, borderRadius: radius.pill,
  },
  hcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#34D399', paddingVertical: 14, borderRadius: radius.pill,
  },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#A78BFA', paddingVertical: 14, borderRadius: radius.pill,
  },
  darkBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm, lineHeight: 16 },
});

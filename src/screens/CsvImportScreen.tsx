import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import { upsertDailyLog } from '../storage';
import { parseCsv, ParseResult } from '../csv';
import { Section, Card } from '../components/Section';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CsvImport'>;

/**
 * CSV importer for HRV / sleep / supplement data.
 *
 * Two ways to load CSV: pick a file via expo-document-picker, OR paste the
 * text directly (useful if the file isn't in a place the picker can reach).
 *
 * Expected columns (case-insensitive, auto-detected from common synonyms):
 *   date           — required (ISO, M/D/Y, or YYYY/MM/DD)
 *   hrv            — milliseconds
 *   sleep_hours    — decimal hours OR integer hours (pair with sleep_minutes)
 *   sleep_minutes  — optional
 *   sleep_quality  — 0-100 (1-10 values are auto-multiplied)
 *   creatine, greens, electrolytes, protein — boolean-ish (1/0, y/n, true/false)
 *   notes
 */
export default function CsvImportScreen() {
  const nav = useNavigation<Nav>();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const pickFile = async () => {
    haptics.tap();
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      // expo-file-system v19+ replaced readAsStringAsync with the File class.
      const content = await new File(asset.uri).text();
      setText(content);
      runParse(content);
    } catch (err: any) {
      haptics.error();
      Alert.alert('Could not read file', err?.message ?? String(err));
    }
  };

  const runParse = (input: string) => {
    const result = parseCsv(input);
    setParsed(result);
    if (result.importable === 0 && result.skipped === 0) {
      setStatus('No rows detected.');
    } else {
      setStatus(`${result.importable} importable, ${result.skipped} skipped.`);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    haptics.success();
    setImporting(true);
    setStatus('Importing…');
    let written = 0;
    let failed = 0;
    for (const row of parsed.rows) {
      if (!row.patch) continue;
      try { await upsertDailyLog(row.patch); written += 1; }
      catch { failed += 1; }
    }
    setImporting(false);
    const summary = `Imported ${written} entries${failed ? `, ${failed} failed` : ''}.`;
    setStatus(summary);
    haptics.success();
    toast.success(summary);
  };

  const mappingLines: string[] = parsed ? [
    parsed.mapping.date         && `date         ← ${parsed.mapping.date}`,
    parsed.mapping.hrv          && `hrv          ← ${parsed.mapping.hrv}`,
    parsed.mapping.sleepHours   && `sleep hours  ← ${parsed.mapping.sleepHours}`,
    parsed.mapping.sleepMinutes && `sleep mins   ← ${parsed.mapping.sleepMinutes}`,
    parsed.mapping.sleepQuality && `sleep qual   ← ${parsed.mapping.sleepQuality}`,
    parsed.mapping.notes        && `notes        ← ${parsed.mapping.notes}`,
    ...Object.entries(parsed.mapping.supplements).map(([k, v]) => `${k.padEnd(13)}← ${v}`),
  ].filter(Boolean) as string[] : [];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section
        title="Pick a file"
        subtitle="CSV from Garmin Connect export, Whoop, Oura, Apple Health-export-converter, or hand-rolled."
      >
        <Pressable style={styles.primaryBtn} onPress={pickFile}>
          <Ionicons name="document-outline" size={16} color="#0B0F14" />
          <Text style={styles.primaryBtnText}>Choose CSV file</Text>
        </Pressable>
      </Section>

      <Section title="Or paste CSV here">
        <Card>
          <TextInput
            style={styles.csvInput}
            multiline
            value={text}
            onChangeText={setText}
            placeholder={'date,hrv,sleep_hours,sleep_quality,creatine,greens\n2026-05-20,55,7.5,82,1,1\n2026-05-21,62,8,90,1,0'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.secondaryBtn} onPress={() => runParse(text)}>
            <Ionicons name="scan" size={14} color={colors.text} />
            <Text style={styles.secondaryBtnText}>Parse</Text>
          </Pressable>
        </Card>
      </Section>

      {parsed && (
        <>
          <Section title="Detected column mapping">
            <Card>
              {mappingLines.length === 0
                ? <Text style={styles.dim}>No recognized columns. Check header row.</Text>
                : mappingLines.map((l) => <Text key={l} style={styles.mono}>{l}</Text>)
              }
            </Card>
          </Section>

          <Section title="Preview" subtitle={status ?? ''}>
            <Card>
              {parsed.rows.slice(0, 30).map((row, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewDate}>{row.date ?? '—'}</Text>
                  <Text style={[styles.previewStatus, row.error && { color: colors.danger }]}>
                    {row.error
                      ? row.error
                      : [
                          row.patch?.hrv != null ? `hrv ${row.patch.hrv}` : null,
                          row.patch?.sleepHours != null ? `sleep ${row.patch.sleepHours.toFixed(1)}h` : null,
                          row.patch?.sleepQuality != null ? `q${row.patch.sleepQuality}` : null,
                          Object.entries(row.patch?.supplements ?? {})
                            .filter(([, v]) => v)
                            .map(([k]) => k.slice(0, 3))
                            .join('/') || null,
                        ].filter(Boolean).join(' · ')
                    }
                  </Text>
                </View>
              ))}
              {parsed.rows.length > 30 && (
                <Text style={styles.dim}>+ {parsed.rows.length - 30} more rows…</Text>
              )}
            </Card>
          </Section>

          <Pressable
            style={[styles.importBtn, (importing || parsed.importable === 0) && { opacity: 0.5 }]}
            onPress={doImport}
            disabled={importing || parsed.importable === 0}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#0B0F14" />
            <Text style={styles.importBtnText}>
              Import {parsed.importable} entries
            </Text>
          </Pressable>
        </>
      )}

      <Pressable style={styles.doneBtn} onPress={() => nav.goBack()}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  dim: { color: colors.textDim, fontSize: fontSize.sm },
  mono: {
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    paddingVertical: 2,
  },

  csvInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    minHeight: 140,
    fontSize: fontSize.sm,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    textAlignVertical: 'top',
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: zelda.skyTeal,
    paddingVertical: 14, borderRadius: radius.pill,
  },
  primaryBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  secondaryBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },

  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: spacing.md },
  previewDate: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', minWidth: 88 },
  previewStatus: { color: colors.textDim, fontSize: fontSize.xs, flex: 1, textAlign: 'right' },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: zelda.triforceGold,
    paddingVertical: 14, borderRadius: radius.pill, marginTop: spacing.sm,
  },
  importBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  doneBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  doneBtnText: { color: colors.text, fontWeight: '700' },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import { importAllFromJson, ImportResult } from '../storage';
import { Section, Card } from '../components/Section';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'JsonImport'>;

/**
 * Restore a full JSON export (from "Export all data as JSON") into this install.
 * Built for the Expo-Go → dev-build migration, where AsyncStorage starts empty.
 * Non-destructive union (imported wins on id/date collisions).
 */
export default function JsonImportScreen() {
  const nav = useNavigation<Nav>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const pickFile = async () => {
    haptics.tap();
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const content = await new File(asset.uri).text();
      setText(content);
    } catch (err: any) {
      haptics.error();
      Alert.alert('Could not read file', err?.message ?? String(err));
    }
  };

  const doImport = async () => {
    if (!text.trim()) {
      Alert.alert('Nothing to import', 'Pick a JSON file or paste the export text first.');
      return;
    }
    Alert.alert(
      'Restore data?',
      'Imported records are merged in (existing data is kept; matching ids/dates are overwritten by the import).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', onPress: async () => {
            haptics.success();
            setBusy(true);
            try {
              const r = await importAllFromJson(text);
              setResult(r);
              toast.success(`Restored ${r.sessions} sessions, ${r.dailyLogs} daily logs`);
              haptics.success();
            } catch (err: any) {
              haptics.error();
              toast.error(err?.message ?? 'Import failed');
              Alert.alert('Import failed', err?.message ?? 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section
        title="Restore from JSON export"
        subtitle="Use the file from Settings → Export all data as JSON (e.g. from your old Expo Go install)."
      >
        <Pressable style={styles.primaryBtn} onPress={pickFile}>
          <Ionicons name="document-outline" size={16} color="#0B0F14" />
          <Text style={styles.primaryBtnText}>Choose JSON file</Text>
        </Pressable>
      </Section>

      <Section title="Or paste JSON here">
        <Card>
          <TextInput
            style={styles.input}
            multiline
            value={text}
            onChangeText={setText}
            placeholder='{ "schemaVersion": 1, "sessions": [...], "dailyLogs": [...] }'
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Card>
      </Section>

      <Pressable
        style={[styles.importBtn, (busy || !text.trim()) && { opacity: 0.5 }]}
        onPress={doImport}
        disabled={busy || !text.trim()}
      >
        <Ionicons name="cloud-upload-outline" size={16} color="#0B0F14" />
        <Text style={styles.importBtnText}>{busy ? 'Restoring…' : 'Restore data'}</Text>
      </Pressable>

      {result && (
        <Section title="Restored">
          <Card>
            <Text style={styles.line}>Sessions: {result.sessions}</Text>
            <Text style={styles.line}>Daily logs: {result.dailyLogs}</Text>
            <Text style={styles.line}>Templates: {result.templates}</Text>
            <Text style={styles.line}>Food entries: {result.foodEntries}</Text>
            <Text style={styles.line}>Recipes: {result.recipes}</Text>
            <Text style={styles.line}>Weekly checklists: {result.weeklyChecklists}</Text>
            <Text style={styles.line}>Daily insights: {result.dailyInsights}</Text>
            <Text style={styles.note}>API keys are not included in exports — re-enter them in Settings.</Text>
          </Card>
        </Section>
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
  input: {
    backgroundColor: colors.surfaceAlt, color: colors.text,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    minHeight: 160, fontSize: fontSize.sm, textAlignVertical: 'top',
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: zelda.skyTeal, paddingVertical: 14, borderRadius: radius.pill,
  },
  primaryBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: zelda.triforceGold, paddingVertical: 14, borderRadius: radius.pill,
  },
  importBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  line: { color: colors.text, fontSize: fontSize.sm, paddingVertical: 2 },
  note: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm },
  doneBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  doneBtnText: { color: colors.text, fontWeight: '700' },
});

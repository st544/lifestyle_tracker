import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../theme';
import { DailyLog, SupplementKey } from '../types';
import { SupplementsRow } from './SupplementsRow';
import { WellnessRing } from './WellnessRing';
import { DurationInput } from './DurationInput';
import * as haptics from '../haptics';

interface Props {
  log: DailyLog | undefined;
  wellness: number;
  onChange: (patch: Partial<DailyLog>) => Promise<void> | void;
  onOpenFull?: () => void;
  onOpenWellness?: () => void;
}

/**
 * Compact daily-log row for the Today screen. Inline editing for HRV /
 * sleep hours+minutes / sleep quality (0-100) + supplement toggles +
 * wellness ring.
 */
export function DailyLogRow({ log, wellness, onChange, onOpenFull, onOpenWellness }: Props) {
  const [hrv, setHrv] = useState<string>(log?.hrv != null ? String(log.hrv) : '');
  const [quality, setQuality] = useState<string>(log?.sleepQuality != null ? String(log.sleepQuality) : '');

  React.useEffect(() => {
    setHrv(log?.hrv != null ? String(log.hrv) : '');
    setQuality(log?.sleepQuality != null ? String(log.sleepQuality) : '');
  }, [log?.date]);

  const commitHrv = () => {
    const n = parseFloat(hrv);
    onChange({ hrv: isNaN(n) ? undefined : n });
  };
  const commitQuality = () => {
    const n = parseInt(quality, 10);
    onChange({ sleepQuality: isNaN(n) ? undefined : Math.max(1, Math.min(100, n)) });
  };

  const onSupp = (k: SupplementKey, next: boolean) => {
    onChange({ supplements: { ...(log?.supplements ?? {}), [k]: next } });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Today's log</Text>
          <Text style={styles.subtitle}>HRV · sleep · supplements</Text>
        </View>
        <View style={styles.headerActions}>
          {onOpenWellness && (
            <Pressable onPress={() => { haptics.tap(); onOpenWellness(); }} style={styles.fullBtn}>
              <Ionicons name="pulse" size={14} color={colors.text} />
              <Text style={styles.fullBtnText}>Trends</Text>
            </Pressable>
          )}
          {onOpenFull && (
            <Pressable onPress={() => { haptics.tap(); onOpenFull(); }} style={styles.fullBtn}>
              <Text style={styles.fullBtnText}>Edit</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.ringCol}>
          <Text style={styles.ringLabel}>WELLNESS SCORE</Text>
          <WellnessRing score={wellness} size={96} stroke={9} />
        </View>
        <View style={styles.inputs}>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>HRV</Text>
            <TextInput
              style={styles.input}
              value={hrv}
              onChangeText={setHrv}
              onBlur={commitHrv}
              keyboardType="number-pad"
              placeholder="ms"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Sleep</Text>
            <DurationInput
              hours={log?.sleepHours}
              onChange={(h) => onChange({ sleepHours: h })}
              variant="compact"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Quality</Text>
            <TextInput
              style={styles.input}
              value={quality}
              onChangeText={setQuality}
              onBlur={commitQuality}
              keyboardType="number-pad"
              placeholder="1-100"
              placeholderTextColor={colors.textFaint}
              maxLength={3}
            />
          </View>
        </View>
      </View>

      <View style={{ height: spacing.sm }} />
      <SupplementsRow values={log?.supplements ?? {}} onToggle={onSupp} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6 },
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
  },
  fullBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.xs },
  ringCol: { alignItems: 'center', gap: 4 },
  ringLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  body: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  inputs: { flex: 1, gap: spacing.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700', width: 56 },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    fontSize: fontSize.md, fontWeight: '700',
  },
});

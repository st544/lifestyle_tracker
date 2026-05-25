import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

interface Props {
  /** Total duration in decimal hours (e.g. 7.5 = 7h 30m). undefined if blank. */
  hours: number | undefined;
  onChange: (hours: number | undefined) => void;
  /** Visual variant. "compact" fits in DailyLogRow; "full" fills DailyLogScreen. */
  variant?: 'compact' | 'full';
}

/**
 * Two-input duration picker. Stores as decimal hours but lets the user enter
 * hours and minutes separately — easier than typing "7.5" or "7.583" on a
 * phone keyboard.
 *
 * Empty fields are tolerated: "" + "30" = 30 minutes (0.5h); "7" + "" = 7h.
 * Clearing BOTH fields sets the underlying value to undefined.
 */
export function DurationInput({ hours, onChange, variant = 'compact' }: Props) {
  const decompose = (h: number | undefined): { hStr: string; mStr: string } => {
    if (h == null || isNaN(h)) return { hStr: '', mStr: '' };
    const whole = Math.floor(h);
    const mins = Math.round((h - whole) * 60);
    // Handle overflow (e.g. 60 rounded minutes)
    if (mins === 60) return { hStr: String(whole + 1), mStr: '0' };
    return { hStr: String(whole), mStr: String(mins) };
  };

  const [hStr, setHStr] = useState<string>(() => decompose(hours).hStr);
  const [mStr, setMStr] = useState<string>(() => decompose(hours).mStr);

  // External value changes (e.g. switching dates in DailyLogScreen) should
  // refresh our two strings. We key on `hours` rather than running on every
  // render to preserve in-flight typing.
  useEffect(() => {
    const { hStr: nextH, mStr: nextM } = decompose(hours);
    setHStr(nextH);
    setMStr(nextM);
  }, [hours]);

  const commit = (h: string, m: string) => {
    const hNum = h.trim() === '' ? 0 : parseInt(h, 10);
    const mNum = m.trim() === '' ? 0 : parseInt(m, 10);
    if (h.trim() === '' && m.trim() === '') {
      onChange(undefined);
      return;
    }
    const safeH = isNaN(hNum) ? 0 : Math.max(0, Math.min(24, hNum));
    const safeM = isNaN(mNum) ? 0 : Math.max(0, Math.min(59, mNum));
    onChange(safeH + safeM / 60);
  };

  const inputStyle = variant === 'compact' ? styles.inputCompact : styles.inputFull;

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <TextInput
          style={inputStyle}
          value={hStr}
          onChangeText={setHStr}
          onBlur={() => commit(hStr, mStr)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          maxLength={2}
        />
        <Text style={styles.unit}>h</Text>
      </View>
      <View style={styles.field}>
        <TextInput
          style={inputStyle}
          value={mStr}
          onChangeText={setMStr}
          onBlur={() => commit(hStr, mStr)}
          keyboardType="number-pad"
          placeholder="00"
          placeholderTextColor={colors.textFaint}
          maxLength={2}
        />
        <Text style={styles.unit}>m</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flex: 1 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: spacing.sm,
  },
  inputCompact: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputFull: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  unit: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});

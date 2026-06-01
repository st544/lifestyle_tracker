import React, { useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, radius } from '../theme';
import * as haptics from '../haptics';

interface Props {
  /** Current duration in minutes. */
  valueMinutes: number;
  onChange: (minutes: number) => void;
  /** Largest hour option (inclusive). Default 16 — covers any realistic hike. */
  maxHours?: number;
  /** Minute granularity. Default 5 → 0, 5, 10 … 55. */
  minuteStep?: number;
  /** Accent color for the selected option (defaults to brand primary). */
  color?: string;
}

/**
 * Two-column duration picker built on a plain Modal + ScrollView (no native
 * picker dependency, so it works in Expo Go). Designed for activities like
 * hiking where duration spans a wide range and stepping by 5/15 min is tedious.
 *
 * Writes back a total in minutes (`hours × 60 + minutes`) so it's a drop-in for
 * any `durationMinutes` field.
 */
export function DurationDropdown({
  valueMinutes,
  onChange,
  maxHours = 16,
  minuteStep = 5,
  color = colors.primary,
}: Props) {
  const [open, setOpen] = useState<null | 'hours' | 'minutes'>(null);

  const hours = Math.floor(valueMinutes / 60);
  const minutes = valueMinutes % 60;

  const hourOptions = Array.from({ length: maxHours + 1 }, (_, i) => i);
  const minuteOptions = Array.from(
    { length: Math.ceil(60 / minuteStep) },
    (_, i) => i * minuteStep,
  );

  const pickHour = (h: number) => {
    haptics.tick();
    onChange(h * 60 + minutes);
    setOpen(null);
  };
  const pickMinute = (m: number) => {
    haptics.tick();
    onChange(hours * 60 + m);
    setOpen(null);
  };

  const openSheet = (which: 'hours' | 'minutes') => {
    haptics.tap();
    setOpen(which);
  };

  const isHours = open === 'hours';
  const options = isHours ? hourOptions : minuteOptions;
  const selected = isHours ? hours : minutes;
  const onPick = isHours ? pickHour : pickMinute;

  return (
    <View style={styles.row}>
      <SelectBox
        label="Hours"
        value={String(hours)}
        unit="h"
        onPress={() => openSheet('hours')}
      />
      <SelectBox
        label="Minutes"
        value={String(minutes).padStart(2, '0')}
        unit="m"
        onPress={() => openSheet('minutes')}
      />

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {isHours ? 'Hours' : 'Minutes'}
              </Text>
              <Pressable onPress={() => setOpen(null)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textDim} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {options.map((opt) => {
                const active = opt === selected;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => onPick(opt)}
                    style={[
                      styles.option,
                      active && { backgroundColor: color + '22', borderColor: color },
                    ]}
                  >
                    <Text style={[styles.optionText, active && { color, fontWeight: '800' }]}>
                      {isHours ? `${opt} h` : `${String(opt).padStart(2, '0')} min`}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={color} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SelectBox({
  label, value, unit, onPress,
}: { label: string; value: string; unit: string; onPress: () => void }) {
  return (
    <View style={styles.boxCol}>
      <Pressable style={styles.box} onPress={onPress}>
        <Text style={styles.boxValue}>{value}</Text>
        <Text style={styles.boxUnit}>{unit}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textDim} style={styles.chev} />
      </Pressable>
      <Text style={styles.boxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  boxCol: { flex: 1, gap: 4 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  boxValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  boxUnit: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '600' },
  chev: { marginLeft: 'auto' },
  boxLabel: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  backdrop: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  list: { paddingHorizontal: spacing.md },
  listContent: { paddingVertical: spacing.sm, gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionText: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
});

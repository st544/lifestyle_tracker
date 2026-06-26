import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, radius, typeColors, typeIcons } from '../theme';
import { Session, Settings } from '../types';
import { calculateWeeklyLoad, calculateLoadScore, getLoadZone } from '../load';
import { weekRange, isInRange, parseDateString, formatTime } from '../dates';
import { LoadBar } from './LoadBar';
import { SaveCheckmark } from './SaveCheckmark';
import { TriforceBurst } from './TriforceBurst';
import * as haptics from '../haptics';

interface Props {
  session: Session | null;
  allSessions: Session[];
  settings: Settings;
  onClose: () => void;
  onCompleted: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onMove: () => void;
  onDelete: () => void;
}

/**
 * Styled action sheet for a Planned session (replaces the native Alert). Shows
 * the session's load + the weekly-load jump completing it produces, and plays a
 * SaveCheckmark + TriforceBurst when Mark completed is tapped.
 */
export function PlannedSessionModal({
  session, allSessions, settings, onClose, onCompleted, onEdit, onSkip, onMove, onDelete,
}: Props) {
  const [completing, setCompleting] = useState(false);
  const [burst, setBurst] = useState(0);

  // Reset the morph state whenever a different session opens the sheet.
  useEffect(() => { setCompleting(false); }, [session?.id]);

  const calc = useMemo(() => {
    if (!session) return null;
    const bw = settings.bodyWeightKg;
    const target = settings.defaultWeeklyTargetLoad;
    const thisLoad = session.loadScore ?? calculateLoadScore(session, bw);

    const { startStr, endStr } = weekRange(parseDateString(session.date), settings.weekStartsOn);
    const weekSessions = allSessions.filter((s) => isInRange(s.date, startStr, endStr));
    const weekly = calculateWeeklyLoad(weekSessions, target, bw);

    const currentPct = weekly.percentCompleted;
    const afterPct = target > 0 ? ((weekly.completedLoad + thisLoad) / target) * 100 : 0;
    return { thisLoad, currentPct, afterPct, zone: getLoadZone(afterPct) };
  }, [session, allSessions, settings]);

  if (!session) return null;
  const color = typeColors[session.type];

  const meta: string[] = [];
  if (session.startTime) meta.push(formatTime(session.startTime));
  meta.push(`${session.durationMinutes} min`);
  if ((session.type === 'Run' || session.type === 'Hiking') && typeof session.miles === 'number') {
    meta.push(`${session.miles.toFixed(1)} mi`);
  }
  if (session.intensity && session.intensity > 0 && session.type !== 'Run' && session.type !== 'Hiking') {
    meta.push(`RPE ${session.intensity}`);
  }
  if (session.location) meta.push(session.location);

  const markCompleted = () => {
    if (completing) return;
    haptics.success();
    setBurst((k) => k + 1);
    setCompleting(true);
    setTimeout(() => onCompleted(), 750);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <LinearGradient
            colors={[color + '22', colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.grabber} />

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: color + '22', borderColor: color + '66' }]}>
                <Ionicons name={typeIcons[session.type] as any} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{session.type}</Text>
                {session.subtype || (session.type === 'Hiking' && session.hikingDifficulty) ? (
                  <Text style={styles.subtitle}>{session.subtype ?? session.hikingDifficulty}</Text>
                ) : null}
              </View>
              <View style={styles.plannedBadge}>
                <Text style={styles.plannedBadgeText}>PLANNED</Text>
              </View>
            </View>

            {meta.length > 0 && <Text style={styles.meta}>{meta.join('  ·  ')}</Text>}

            {/* Load impact */}
            {calc && (
              <View style={styles.loadCard}>
                <View style={styles.loadRow}>
                  <View>
                    <Text style={styles.loadLabel}>SESSION LOAD</Text>
                    <Text style={[styles.loadValue, { color }]}>{calc.thisLoad}</Text>
                  </View>
                  <View style={styles.loadRight}>
                    <Text style={styles.loadLabel}>WEEK → AFTER</Text>
                    <View style={styles.pctRow}>
                      <Text style={styles.pctNow}>{Math.round(calc.currentPct)}%</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.textDim} />
                      <Text style={[styles.pctAfter, { color: calc.zone.color }]}>{Math.round(calc.afterPct)}%</Text>
                    </View>
                  </View>
                </View>
                <View style={{ height: spacing.sm }} />
                <LoadBar completedPercent={calc.currentPct} projectedPercent={calc.afterPct} />
                <Text style={[styles.zoneLabel, { color: calc.zone.color }]}>
                  Completing brings the week to {calc.zone.label.toLowerCase()}
                </Text>
              </View>
            )}

            {/* Mark completed — animates on tap */}
            <View style={styles.completeWrap}>
              <Pressable
                style={[styles.completeBtn, completing && { backgroundColor: colors.success }]}
                onPress={markCompleted}
                disabled={completing}
              >
                {completing ? (
                  <SaveCheckmark size={26} trigger={burst} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#0B0F14" />
                    <Text style={styles.completeText}>Mark completed</Text>
                  </>
                )}
              </Pressable>
              {burst > 0 && (
                <View pointerEvents="none" style={styles.burstLayer}>
                  <TriforceBurst trigger={burst} count={22} radius={120} color={color} />
                </View>
              )}
            </View>

            {/* Secondary actions */}
            <View style={styles.actionRow}>
              <ActionBtn icon="create-outline" label="Edit" onPress={onEdit} disabled={completing} />
              <ActionBtn icon="calendar-outline" label="Move" onPress={onMove} disabled={completing} />
              <ActionBtn icon="play-skip-forward-outline" label="Skip" onPress={onSkip} disabled={completing} />
              <ActionBtn icon="trash-outline" label="Delete" tint={colors.danger} onPress={onDelete} disabled={completing} />
            </View>

            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={completing}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionBtn({
  icon, label, onPress, tint, disabled,
}: { icon: string; label: string; onPress: () => void; tint?: string; disabled?: boolean }) {
  return (
    <Pressable style={[styles.actionBtn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon as any} size={18} color={tint ?? colors.text} />
      <Text style={[styles.actionLabel, tint ? { color: tint } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  gradient: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: spacing.sm,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: fontSize.sm, marginTop: 1 },
  plannedBadge: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill,
  },
  plannedBadgeText: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  meta: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '600' },

  loadCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.xs,
  },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loadRight: { alignItems: 'flex-end' },
  loadLabel: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  loadValue: { fontSize: fontSize.xxl, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  pctNow: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  pctAfter: { fontSize: fontSize.lg, fontWeight: '900' },
  zoneLabel: { fontSize: fontSize.xs, fontWeight: '700', marginTop: spacing.sm },

  completeWrap: { position: 'relative', marginTop: spacing.sm },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.success, borderRadius: radius.pill,
    paddingVertical: 14, minHeight: 52,
  },
  completeText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  burstLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md,
  },
  actionLabel: { color: colors.text, fontSize: fontSize.xs, fontWeight: '700' },

  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { color: colors.textDim, fontWeight: '700', fontSize: fontSize.md },
});

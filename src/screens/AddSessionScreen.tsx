import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TriforceBurst } from '../components/TriforceBurst';
import { SaveCheckmark } from '../components/SaveCheckmark';
import * as haptics from '../haptics';

import { colors, spacing, fontSize, radius, typeColors } from '../theme';
import { Session, SessionStatus, SessionType, Settings, DEFAULT_SETTINGS } from '../types';
import {
  addSession, updateSession, deleteSession, getSessions, getSettings, addTemplate,
} from '../storage';
import { TYPE_DEFAULTS, ALL_TYPES } from '../defaults';
import { calculateLoadScore, calculateWeeklyLoad } from '../load';
import {
  todayString, parseDateString, toDateString, formatLong, parseTime, timeFromDate,
  weekRange, isInRange, formatTime,
} from '../dates';
import { projectedMessage } from '../messages';
import { Pill } from '../components/Pill';
import { Section, Card } from '../components/Section';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddSession'>;
type R = RouteProp<RootStackParamList, 'AddSession'>;

const STATUSES: SessionStatus[] = ['Planned', 'Completed', 'Partial', 'Skipped', 'Moved'];

export default function AddSessionScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const params = route.params ?? {};

  const initialType: SessionType = params.type ?? 'BJJ';
  const initialDefaults = TYPE_DEFAULTS[initialType];

  // Form state
  const [type, setType] = useState<SessionType>(initialType);
  const [date, setDate] = useState<string>(params.date ?? todayString());
  const [startTime, setStartTime] = useState<string | undefined>(undefined);
  const [duration, setDuration] = useState<number>(initialDefaults.durationMinutes);
  const [status, setStatus] = useState<SessionStatus>(params.startStatus ?? 'Completed');
  const [intensity, setIntensity] = useState<number>(initialDefaults.intensity);
  const [subtype, setSubtype] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saunaMin, setSaunaMin] = useState<number | undefined>(undefined);
  const [plungeMin, setPlungeMin] = useState<number | undefined>(undefined);
  const [miles, setMiles] = useState<string>('');

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [editingId, setEditingId] = useState<string | undefined>(params.sessionId);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [saveBurst, setSaveBurst] = useState(0);
  const [saving, setSaving] = useState(false);

  // Load settings + sessions
  useEffect(() => {
    (async () => {
      const [st, ss] = await Promise.all([getSettings(), getSessions()]);
      setSettings(st);
      setAllSessions(ss);

      if (params.sessionId) {
        const existing = ss.find((s) => s.id === params.sessionId);
        if (existing) {
          setType(existing.type);
          setDate(existing.date);
          setStartTime(existing.startTime);
          setDuration(existing.durationMinutes);
          setStatus(existing.status);
          setIntensity(existing.intensity ?? 0);
          setSubtype(existing.subtype);
          setLocation(existing.location ?? '');
          setNotes(existing.notes ?? '');
          setSaunaMin(existing.saunaMinutes);
          setPlungeMin(existing.coldPlungeMinutes);
          setMiles(existing.miles !== undefined ? String(existing.miles) : '');
        }
      }
    })();
  }, [params.sessionId]);

  // When type changes (and not editing), apply that type's defaults
  const applyTypeDefaults = useCallback((nextType: SessionType) => {
    const d = TYPE_DEFAULTS[nextType];
    setDuration(d.durationMinutes);
    setIntensity(d.intensity);
    setSubtype(undefined);
    if (nextType !== 'Sauna + Cold Plunge') {
      setSaunaMin(undefined);
      setPlungeMin(undefined);
    } else {
      setSaunaMin(40);
      setPlungeMin(5);
    }
  }, []);

  const onTypeChange = (next: SessionType) => {
    setType(next);
    if (!editingId) applyTypeDefaults(next);
  };

  // Live load preview
  const loadScore = useMemo(
    () => calculateLoadScore({ type, subtype, durationMinutes: duration, intensity }),
    [type, subtype, duration, intensity]
  );

  const { startStr, endStr } = weekRange(parseDateString(date), settings.weekStartsOn);
  const weekSessionsExceptThis = allSessions.filter(
    (s) => isInRange(s.date, startStr, endStr) && s.id !== editingId
  );
  const currentWeekly = calculateWeeklyLoad(weekSessionsExceptThis, settings.defaultWeeklyTargetLoad);
  const newWeekly = calculateWeeklyLoad(
    [
      ...weekSessionsExceptThis,
      // synthesize as if this session existed
      {
        id: 'preview', date, durationMinutes: duration, type, subtype,
        intensity, status, createdAt: '', updatedAt: '',
        loadScore,
      } as Session,
    ],
    settings.defaultWeeklyTargetLoad
  );
  const additionMsg = projectedMessage(currentWeekly.percentProjected, newWeekly.percentProjected);

  const subtypeOptions = TYPE_DEFAULTS[type].subtypes;
  const locationOptions = TYPE_DEFAULTS[type].locations ?? [];

  const onSave = async () => {
    const payload = {
      type, date,
      startTime,
      durationMinutes: duration,
      status,
      intensity: intensity || 0,
      subtype,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      saunaMinutes: type === 'Sauna + Cold Plunge' ? saunaMin : undefined,
      coldPlungeMinutes: type === 'Sauna + Cold Plunge' ? plungeMin : undefined,
      miles: type === 'Run' && miles.trim() !== '' ? parseFloat(miles) : undefined,
      loadScore,
    };

    setSaving(true);
    setSaveBurst((k) => k + 1);
    haptics.success();

    if (editingId) {
      await updateSession(editingId, payload);
    } else {
      await addSession(payload);
    }
    // Give the user ~700ms to enjoy the burst before navigating away
    setTimeout(() => {
      setSaving(false);
      nav.goBack();
    }, 700);
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteSession(editingId); nav.goBack(); },
      },
    ]);
  };

  const onSaveAsTemplate = async () => {
    Alert.prompt
      ? Alert.prompt('Template name', 'Save this as a reusable template?', async (name) => {
          if (!name) return;
          await addTemplate({
            name, type, subtype,
            durationMinutes: duration,
            intensity, location: location.trim() || undefined,
            startTime, notes: notes.trim() || undefined,
          });
          Alert.alert('Saved', `Template "${name}" saved.`);
        })
      : Alert.alert('Tip', 'Save-as-template prompt is iOS-only. Edit later from a future Templates screen.');
  };

  const intensityRow = (
    <View style={styles.intensityRow}>
      {Array.from({ length: 11 }).map((_, i) => {
        const active = intensity === i;
        return (
          <Pressable
            key={i}
            onPress={() => setIntensity(i)}
            style={[
              styles.intDot,
              { backgroundColor: active ? typeColors[type] : colors.surfaceAlt, borderColor: active ? typeColors[type] : colors.border },
            ]}
          >
            <Text style={[styles.intText, active && { color: '#0B0F14' }]}>{i}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title={editingId ? 'Edit session' : 'New session'} subtitle={formatLong(date)}>
        <Card>
          {/* Type */}
          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {ALL_TYPES.map((t) => (
              <Pill
                key={t}
                label={t}
                selected={type === t}
                color={typeColors[t]}
                onPress={() => onTypeChange(t)}
              />
            ))}
          </View>

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <View style={styles.chipRow}>
            {STATUSES.map((s) => (
              <Pill
                key={s}
                label={s}
                selected={status === s}
                onPress={() => setStatus(s)}
              />
            ))}
          </View>

          {/* Date + time */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>Date</Text>
              <Pressable style={styles.input} onPress={() => setShowDate(true)}>
                <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
                <Text style={styles.inputText}>{formatLong(date)}</Text>
              </Pressable>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Start time</Text>
              <Pressable style={styles.input} onPress={() => setShowTime(true)}>
                <Ionicons name="time-outline" size={16} color={colors.textDim} />
                <Text style={styles.inputText}>
                  {startTime ? formatTime(startTime) : 'Optional'}
                </Text>
              </Pressable>
            </View>
          </View>

          {showDate && (
            <DateTimePicker
              value={parseDateString(date)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, d) => {
                setShowDate(Platform.OS === 'ios');
                if (d) setDate(toDateString(d));
              }}
            />
          )}
          {showTime && (
            <DateTimePicker
              value={parseTime(startTime)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => {
                setShowTime(Platform.OS === 'ios');
                if (d) setStartTime(timeFromDate(d));
              }}
            />
          )}

          {/* Duration */}
          <Text style={styles.label}>Duration · {duration} min</Text>
          <View style={styles.stepRow}>
            <StepBtn label="-15" onPress={() => setDuration((d) => Math.max(0, d - 15))} />
            <StepBtn label="-5" onPress={() => setDuration((d) => Math.max(0, d - 5))} />
            <View style={styles.durBubble}>
              <Text style={styles.durValue}>{duration}</Text>
              <Text style={styles.durUnit}>min</Text>
            </View>
            <StepBtn label="+5" onPress={() => setDuration((d) => d + 5)} />
            <StepBtn label="+15" onPress={() => setDuration((d) => d + 15)} />
          </View>

          {/* Intensity */}
          <Text style={styles.label}>Intensity · RPE {intensity}</Text>
          {intensityRow}

          {/* Subtype */}
          {subtypeOptions.length > 0 && (
            <>
              <Text style={styles.label}>Subtype</Text>
              <View style={styles.chipRow}>
                {subtypeOptions.map((opt) => (
                  <Pill
                    key={opt}
                    label={opt}
                    selected={subtype === opt}
                    color={typeColors[type]}
                    onPress={() => setSubtype(subtype === opt ? undefined : opt)}
                  />
                ))}
              </View>
            </>
          )}

          {/* Run miles */}
          {type === 'Run' && (
            <>
              <Text style={styles.label}>Miles</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Optional · e.g. 3.2"
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                value={miles}
                onChangeText={setMiles}
              />
            </>
          )}

          {/* Sauna + Cold components */}
          {type === 'Sauna + Cold Plunge' && (
            <>
              <Text style={styles.label}>Sauna · {saunaMin ?? 0} min</Text>
              <View style={styles.stepRow}>
                <StepBtn label="-5" onPress={() => setSaunaMin((m) => Math.max(0, (m ?? 0) - 5))} />
                <View style={styles.durBubbleSm}><Text style={styles.durValue}>{saunaMin ?? 0}</Text></View>
                <StepBtn label="+5" onPress={() => setSaunaMin((m) => (m ?? 0) + 5)} />
              </View>
              <Text style={styles.label}>Cold Plunge · {plungeMin ?? 0} min</Text>
              <View style={styles.stepRow}>
                <StepBtn label="-1" onPress={() => setPlungeMin((m) => Math.max(0, (m ?? 0) - 1))} />
                <View style={styles.durBubbleSm}><Text style={styles.durValue}>{plungeMin ?? 0}</Text></View>
                <StepBtn label="+1" onPress={() => setPlungeMin((m) => (m ?? 0) + 1)} />
              </View>
            </>
          )}

          {/* Location */}
          {(locationOptions.length > 0 || type !== 'Rest') && (
            <>
              <Text style={styles.label}>Location</Text>
              {locationOptions.length > 0 && (
                <View style={styles.chipRow}>
                  {locationOptions.map((l) => (
                    <Pill
                      key={l}
                      label={l}
                      selected={location === l}
                      onPress={() => setLocation(location === l ? '' : l)}
                    />
                  ))}
                </View>
              )}
              <TextInput
                style={styles.textInput}
                placeholder="Optional location"
                placeholderTextColor={colors.textFaint}
                value={location}
                onChangeText={setLocation}
              />
            </>
          )}

          {/* Notes */}
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Optional notes"
            placeholderTextColor={colors.textFaint}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Card>
      </Section>

      <Section title="Load preview">
        <Card>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>This session load</Text>
            <Text style={[styles.previewValue, { color: typeColors[type] }]}>{loadScore}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Projected weekly</Text>
            <Text style={styles.previewValue}>
              {Math.round(newWeekly.percentProjected)}%
            </Text>
          </View>
          <Text style={[styles.previewMsg, { color: toneColor(additionMsg.tone) }]}>
            {additionMsg.label} · brings week to {Math.round(newWeekly.percentProjected)}% of target
          </Text>
        </Card>
      </Section>

      <View style={styles.actions}>
        <View style={styles.saveWrap}>
          <Pressable style={styles.saveBtn} onPress={onSave} disabled={saving}>
            {saving ? (
              <SaveCheckmark size={28} trigger={saveBurst} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#0B0F14" />
                <Text style={styles.saveText}>{editingId ? 'Save changes' : 'Save session'}</Text>
              </>
            )}
          </Pressable>
          {saveBurst > 0 && (
            <View pointerEvents="none" style={styles.burstLayer}>
              <TriforceBurst trigger={saveBurst} count={24} radius={130} color={typeColors[type]} />
            </View>
          )}
        </View>
        <Pressable style={styles.secondaryBtn} onPress={onSaveAsTemplate}>
          <Ionicons name="bookmark-outline" size={16} color={colors.text} />
          <Text style={styles.secondaryText}>Save as template</Text>
        </Pressable>
        {editingId && (
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.danger }]} onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.secondaryText, { color: colors.danger }]}>Delete</Text>
          </Pressable>
        )}
      </View>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.stepBtn} onPress={onPress}>
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

function toneColor(tone: 'light' | 'moderate' | 'heavy'): string {
  if (tone === 'light') return colors.success;
  if (tone === 'moderate') return colors.warn;
  return colors.danger;
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  label: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  twoCol: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  col: { flex: 1 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  inputText: { color: colors.text, fontSize: fontSize.md },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    fontSize: fontSize.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  stepBtn: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md,
  },
  stepBtnText: { color: colors.text, fontWeight: '700' },
  durBubble: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 4,
  },
  durBubbleSm: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  durValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  durUnit: { color: colors.textDim, fontSize: fontSize.sm },

  intensityRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  intDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  intText: { color: colors.text, fontSize: fontSize.xs, fontWeight: '700' },

  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  previewLabel: { color: colors.textDim, fontSize: fontSize.md },
  previewValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  previewMsg: { marginTop: spacing.sm, fontSize: fontSize.sm, fontWeight: '700' },

  actions: { gap: spacing.sm, marginTop: spacing.md },
  saveWrap: { position: 'relative' },
  burstLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
    minHeight: 52,
  },
  saveText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontWeight: '700' },
});

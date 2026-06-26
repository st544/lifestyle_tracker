import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius } from '../theme';
import { getSettings, saveSettings, getHealthConnectSyncState } from '../storage';
import {
  isAvailable, ensureInitialized, requestPermissions, getGrantedRecordTypes, openSettings,
  countRecentRecords,
} from '../api/health-connect';
import { syncHealthConnect } from '../api/health-connect-sync';
import { Section, Card } from '../components/Section';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'HealthConnect'>;

/**
 * Health Connect setup (Android). Mirrors StravaSetupScreen: availability
 * status, grant-permissions, sync-now, last-synced time, open-HC-settings, and
 * an auto-sync-on-open toggle (writes Settings.healthConnectEnabled).
 */
export default function HealthConnectSetupScreen() {
  const nav = useNavigation<Nav>();
  const isAndroid = Platform.OS === 'android';

  const [available, setAvailable] = useState<boolean | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [lastSynced, setLastSynced] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = async () => {
    const [s, state] = await Promise.all([getSettings(), getHealthConnectSyncState()]);
    setEnabled(!!s.healthConnectEnabled);
    setLastSynced(state.lastSyncedAt);
    if (isAndroid) {
      setAvailable(await isAvailable());
      setGranted(await getGrantedRecordTypes());
    } else {
      setAvailable(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const onGrant = async () => {
    haptics.tap();
    setBusy(true);
    setStatus('Requesting Health Connect permissions…');
    try {
      await ensureInitialized();
      const ok = await requestPermissions();
      setGranted(await getGrantedRecordTypes());
      setStatus(ok ? 'Permissions granted.' : 'No permissions granted — open Health Connect settings to allow access.');
      if (ok) haptics.success();
    } catch (err: any) {
      haptics.error();
      setStatus(err?.message ?? 'Permission request failed');
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    setStatus('Syncing…');
    try {
      const r = await syncHealthConnect();
      const state = await getHealthConnectSyncState();
      setLastSynced(state.lastSyncedAt);

      if (r.importedSessions === 0 && r.importedDailyLogs === 0) {
        // 0 imported is ambiguous — diagnose WHY so it's actionable.
        const diag = await countRecentRecords(30);
        if (diag.granted.length === 0) {
          const msg = 'No permissions granted — tap "Grant permissions", or grant manually via "Open Health Connect settings".';
          setStatus(msg);
          toast.warn('Health Connect: no permissions granted yet');
        } else if (diag.hrv + diag.sleep + diag.exercise + diag.restingHr === 0) {
          setStatus(
            `Permissions OK (${diag.granted.length} types). But Health Connect has NO data in the last 30 days — ` +
            `confirm Garmin Connect is writing to Health Connect (it only syncs NEW data going forward, ` +
            `workouts after ~5–60 min, sleep/HRV next morning).`,
          );
          toast.info('Health Connect is empty — check Garmin Connect → Health Connect');
        } else {
          // Records exist but none were new/mappable (already-synced or unsupported types).
          setStatus(
            `Nothing new to import. Health Connect (30d): HRV ${diag.hrv}, sleep ${diag.sleep}, ` +
            `workouts ${diag.exercise}, restingHR ${diag.restingHr} — all already synced or not a tracked type.`,
          );
          toast.info('Health Connect: nothing new to import');
        }
      } else {
        const summary = `Imported ${r.importedSessions} sessions, ${r.importedDailyLogs} daily logs · skipped ${r.skipped}`;
        setStatus(summary);
        haptics.success();
        toast.success(summary);
      }
    } catch (err: any) {
      haptics.error();
      const msg = err?.message ?? 'Sync failed';
      setStatus(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    haptics.tap();
    const next = !enabled;
    setEnabled(next);
    const s = await getSettings();
    await saveSettings({ ...s, healthConnectEnabled: next });
    toast.info(next ? 'Auto-sync on app open enabled' : 'Auto-sync disabled');
  };

  if (!isAndroid) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Section title="Health Connect">
          <Card>
            <Text style={styles.dim}>
              Health Connect sync is Android-only (Garmin → Health Connect → app). On iOS,
              use Strava sync or the CSV/JSON import for HRV and sleep.
            </Text>
          </Card>
        </Section>
        <Pressable style={styles.doneBtn} onPress={() => nav.goBack()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const hasPerms = granted.length > 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="Status">
        <Card>
          <View style={styles.statusRow}>
            <Ionicons
              name={available ? 'checkmark-circle' : 'close-circle-outline'}
              size={22}
              color={available ? colors.success : colors.textDim}
            />
            <Text style={styles.statusText}>
              {available == null ? 'Checking…' : available ? 'Health Connect available' : 'Health Connect unavailable'}
            </Text>
          </View>
          <Text style={styles.statusDetail}>
            {available
              ? hasPerms
                ? `Permissions granted for: ${granted.join(', ')}`
                : 'No permissions granted yet.'
              : 'Install/enable Health Connect on this device (Android 14+ has it built in), then grant Garmin write access in Garmin Connect → Connected Apps.'}
          </Text>
          {lastSynced > 0 && (
            <Text style={styles.statusDetail}>Last synced: {new Date(lastSynced).toLocaleString()}</Text>
          )}
          {status ? <Text style={styles.statusDetail}>{status}</Text> : null}
        </Card>
      </Section>

      <Section
        title="1 · Grant permissions"
        subtitle="Allows this app to READ HRV, sleep, exercise, calories, distance, and resting HR from Health Connect."
      >
        <Pressable
          style={[styles.primaryBtn, (!available || busy) && { opacity: 0.5 }]}
          onPress={onGrant}
          disabled={!available || busy}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color="#0B0F14" />
          <Text style={styles.primaryBtnText}>Grant permissions</Text>
        </Pressable>
      </Section>

      <Section title="2 · Auto-sync on app open">
        <Pressable style={styles.toggleRow} onPress={toggleEnabled}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Sync when I open the app</Text>
            <Text style={styles.toggleSub}>Best-effort, like Strava. No background service.</Text>
          </View>
          <View style={[styles.toggle, enabled && { backgroundColor: colors.success + '33', borderColor: colors.success }]}>
            <Ionicons
              name={enabled ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={enabled ? colors.success : colors.textDim}
            />
            <Text style={[styles.toggleState, enabled && { color: colors.success }]}>{enabled ? 'On' : 'Off'}</Text>
          </View>
        </Pressable>
      </Section>

      <Section title="Manage">
        <Pressable style={[styles.secondaryBtn, busy && { opacity: 0.5 }]} onPress={onSync} disabled={busy}>
          <Ionicons name="refresh" size={16} color={colors.text} />
          <Text style={styles.secondaryBtnText}>Sync now</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => { haptics.tap(); openSettings(); }}>
          <Ionicons name="open-outline" size={16} color={colors.text} />
          <Text style={styles.secondaryBtnText}>Open Health Connect settings</Text>
        </Pressable>
      </Section>

      <Text style={styles.note}>
        Garmin → Health Connect has latency: workouts appear in 5–60 min, sleep/HRV usually
        the next morning.
      </Text>

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
  dim: { color: colors.textDim, fontSize: fontSize.md, lineHeight: 20 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  statusDetail: { color: colors.textDim, fontSize: fontSize.sm, marginTop: spacing.sm, lineHeight: 18 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#34D399',
    paddingVertical: 14, borderRadius: radius.pill,
  },
  primaryBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  toggleTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  toggleSub: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  toggleState: { color: colors.textDim, fontWeight: '800', fontSize: fontSize.sm },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },

  note: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16 },

  doneBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  doneBtnText: { color: colors.text, fontWeight: '700' },
});

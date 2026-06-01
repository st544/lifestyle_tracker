import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Linking, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius, zelda } from '../theme';
import {
  getSettings, saveSettings, getStravaTokens, saveStravaTokens, clearStravaTokens,
} from '../storage';
import {
  buildAuthorizeUrl, exchangeCodeForTokens, extractAuthCode, REDIRECT_URI,
} from '../api/strava';
import { syncStravaActivities } from '../api/strava-sync';
import { Section, Card } from '../components/Section';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';
import { StravaTokens } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'StravaSetup'>;

/**
 * One-time Strava OAuth setup using the manual-paste flow (no deep links).
 *
 *   1. User pastes client_id + client_secret from their Strava app dashboard
 *   2. Taps "Open Strava login" → system browser opens authorize URL
 *   3. After approving, Strava redirects to https://localhost/exchange_token?code=...
 *      which fails to load — user copies the URL from the address bar
 *   4. User pastes that URL (or just the code) into the input field
 *   5. App exchanges code for access + refresh tokens, persists them
 */
export default function StravaSetupScreen() {
  const nav = useNavigation<Nav>();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [code, setCode] = useState('');
  const [tokens, setTokens] = useState<StravaTokens | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, t] = await Promise.all([getSettings(), getStravaTokens()]);
      if (s.stravaClientId) setClientId(s.stravaClientId);
      if (s.stravaClientSecret) setClientSecret(s.stravaClientSecret);
      setTokens(t);
    })();
  }, []);

  const persistCredentials = async () => {
    const s = await getSettings();
    await saveSettings({
      ...s,
      stravaClientId: clientId.trim() || undefined,
      stravaClientSecret: clientSecret.trim() || undefined,
    });
  };

  const openStravaAuth = async () => {
    if (!clientId.trim()) {
      Alert.alert('Missing client ID', 'Enter your Strava Client ID first.');
      return;
    }
    haptics.tap();
    await persistCredentials();
    const url = buildAuthorizeUrl(clientId.trim());
    try {
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Could not open browser', err?.message ?? String(err));
    }
  };

  const onExchange = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      Alert.alert('Missing credentials', 'Enter both Client ID and Client Secret.');
      return;
    }
    const extracted = extractAuthCode(code);
    if (!extracted) {
      Alert.alert('No code found', 'Paste either the authorization code or the full redirect URL.');
      return;
    }

    setBusy(true);
    setStatus('Exchanging code for tokens…');
    try {
      await persistCredentials();
      const newTokens = await exchangeCodeForTokens(
        clientId.trim(), clientSecret.trim(), extracted,
      );
      await saveStravaTokens(newTokens);
      setTokens(newTokens);
      setCode('');
      setStatus('Connected. Running first sync…');
      haptics.success();

      const result = await syncStravaActivities();
      setStatus(
        `Connected as ${newTokens.athleteName ?? 'athlete #' + newTokens.athleteId} · ` +
        `imported ${result.imported}, skipped ${result.skipped}` +
        (result.errored ? `, ${result.errored} errored` : ''),
      );
      toast.success(`Connected · imported ${result.imported}`);
    } catch (err: any) {
      haptics.error();
      const msg = err?.message ?? 'Failed to exchange code';
      setStatus(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onResync = async () => {
    setBusy(true);
    setStatus('Syncing…');
    try {
      const result = await syncStravaActivities();
      const summary =
        `Imported ${result.imported}, skipped ${result.skipped}` +
        (result.errored ? `, ${result.errored} errored` : '');
      setStatus(summary);
      haptics.success();
      toast.success(summary);
    } catch (err: any) {
      haptics.error();
      const msg = err?.message ?? 'Sync failed';
      setStatus(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = () => {
    Alert.alert(
      'Disconnect Strava?',
      'Tokens will be cleared. Existing imported sessions stay; future activities will not auto-import until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive', onPress: async () => {
            await clearStravaTokens();
            setTokens(undefined);
            setStatus('Disconnected.');
            haptics.success();
            toast.info('Strava disconnected');
          },
        },
      ],
    );
  };

  const connected = !!tokens;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="Status">
        <Card>
          <View style={styles.statusRow}>
            <Ionicons
              name={connected ? 'checkmark-circle' : 'close-circle-outline'}
              size={22}
              color={connected ? colors.success : colors.textDim}
            />
            <Text style={styles.statusText}>
              {connected
                ? `Connected${tokens?.athleteName ? ` as ${tokens.athleteName}` : ''}`
                : 'Not connected'}
            </Text>
          </View>
          {status ? <Text style={styles.statusDetail}>{status}</Text> : null}
        </Card>
      </Section>

      <Section
        title="1 · Strava app credentials"
        subtitle="Create one at strava.com/api. Use any Authorization Callback Domain (e.g. localhost)."
      >
        <Card>
          <Text style={styles.label}>Client ID</Text>
          <TextInput
            style={styles.textInput}
            value={clientId}
            onChangeText={setClientId}
            placeholder="e.g. 12345"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>Client Secret</Text>
          <View style={styles.secretRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={clientSecret}
              onChangeText={setClientSecret}
              placeholder="40-char secret"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showSecret}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => setShowSecret((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textDim} />
            </Pressable>
          </View>
        </Card>
      </Section>

      <Section
        title="2 · Authorize"
        subtitle={`Approves access for your Strava account. Redirects to ${REDIRECT_URI} — that page will fail to load; that's expected. Copy the URL from the browser.`}
      >
        <Pressable
          style={[styles.primaryBtn, !clientId.trim() && { opacity: 0.5 }]}
          onPress={openStravaAuth}
          disabled={!clientId.trim()}
        >
          <Ionicons name="open-outline" size={16} color="#0B0F14" />
          <Text style={styles.primaryBtnText}>Open Strava login</Text>
        </Pressable>
      </Section>

      <Section title="3 · Paste the code (or full redirect URL)">
        <Card>
          <TextInput
            style={[styles.textInput, { minHeight: 60 }]}
            value={code}
            onChangeText={setCode}
            placeholder="https://localhost/exchange_token?code=abc123..."
            placeholderTextColor={colors.textFaint}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.primaryBtn, { marginTop: spacing.md }, busy && { opacity: 0.5 }]}
            onPress={onExchange}
            disabled={busy}
          >
            <Ionicons name="link" size={16} color="#0B0F14" />
            <Text style={styles.primaryBtnText}>Exchange & sync</Text>
          </Pressable>
        </Card>
      </Section>

      {connected && (
        <Section title="Manage">
          <Pressable style={[styles.secondaryBtn, busy && { opacity: 0.5 }]} onPress={onResync} disabled={busy}>
            <Ionicons name="refresh" size={16} color={colors.text} />
            <Text style={styles.secondaryBtnText}>Sync now</Text>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.danger }]} onPress={onDisconnect}>
            <Ionicons name="unlink-outline" size={16} color={colors.danger} />
            <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>Disconnect</Text>
          </Pressable>
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

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  statusDetail: { color: colors.textDim, fontSize: fontSize.sm, marginTop: spacing.sm, lineHeight: 18 },

  label: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    fontSize: fontSize.md,
  },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FC4C02', // Strava orange
    paddingVertical: 14, borderRadius: radius.pill,
  },
  primaryBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },

  doneBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md,
  },
  doneBtnText: { color: colors.text, fontWeight: '700' },
});

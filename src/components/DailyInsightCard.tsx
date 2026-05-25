import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, fontSize, spacing, zelda } from '../theme';
import { DailyInsight, InsightFocus } from '../types';
import { TypewriterText } from './TypewriterText';
import * as haptics from '../haptics';

interface Props {
  insight?: DailyInsight | null;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onOpenSettings?: () => void;
}

const FOCUS_META: Record<InsightFocus, { icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; color: string; label: string }> = {
  recovery:    { icon: 'leaf',           color: '#2DD4BF',           label: 'RECOVERY' },
  training:    { icon: 'flame',          color: '#FF6B3D',           label: 'TRAINING' },
  rest:        { icon: 'bed',            color: '#64748B',           label: 'REST' },
  maintenance: { icon: 'fitness',        color: '#4F8CFF',           label: 'MAINTENANCE' },
};

export function DailyInsightCard({ insight, loading, error, onRefresh, onOpenSettings }: Props) {
  const focus = insight ? FOCUS_META[insight.focus] : null;

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={[zelda.triforceGold + '22', colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <Ionicons name="sparkles" size={18} color={zelda.triforceGold} />
            <Text style={styles.title}>Daily insight</Text>
          </View>
          <Pressable
            onPress={() => { haptics.tap(); onRefresh(); }}
            disabled={loading}
            style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color={zelda.triforceGold} />
              : <Ionicons name="refresh" size={16} color={zelda.triforceGold} />}
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            {/Missing|No Anthropic|API key/i.test(error) && onOpenSettings && (
              <Pressable style={styles.settingsBtn} onPress={() => { haptics.tap(); onOpenSettings(); }}>
                <Ionicons name="key" size={14} color="#0B0F14" />
                <Text style={styles.settingsBtnText}>Set API key</Text>
              </Pressable>
            )}
          </View>
        ) : insight ? (
          <>
            <View style={styles.focusRow}>
              {focus && (
                <View style={[styles.focusPill, { borderColor: focus.color }]}>
                  <Ionicons name={focus.icon} size={12} color={focus.color} />
                  <Text style={[styles.focusText, { color: focus.color }]}>{focus.label}</Text>
                </View>
              )}
            </View>
            <TypewriterText
              text={insight.recommendation}
              style={styles.recommendation}
              speed={14}
            />
            <Text style={styles.reasoning}>{insight.reasoning}</Text>
          </>
        ) : loading ? (
          <Text style={styles.loadingText}>Analyzing the last 14 days…</Text>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Tap refresh to ask Claude for tomorrow's recommendation based on your last 14 days.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => { haptics.tick(); onRefresh(); }}
            >
              <Ionicons name="sparkles" size={14} color="#0B0F14" />
              <Text style={styles.primaryBtnText}>Generate insight</Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: zelda.triforceGold + '55',
  },
  gradient: { padding: spacing.md, gap: 6 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: zelda.triforceGold, fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  refreshBtn: {
    padding: 6, borderRadius: radius.pill,
    borderWidth: 1, borderColor: zelda.triforceGold + '55',
  },

  focusRow: { flexDirection: 'row', marginBottom: spacing.xs },
  focusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1,
  },
  focusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  recommendation: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  reasoning: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },

  loadingText: { color: colors.textDim, fontSize: fontSize.md, fontStyle: 'italic', marginTop: spacing.sm },

  errorWrap: { gap: spacing.sm, marginTop: spacing.sm },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  settingsBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: zelda.triforceGold,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  settingsBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.sm },

  emptyWrap: { gap: spacing.sm, marginTop: spacing.sm },
  emptyText: { color: colors.textDim, fontSize: fontSize.sm, lineHeight: 20 },
  primaryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: zelda.triforceGold,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  primaryBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.sm },
});

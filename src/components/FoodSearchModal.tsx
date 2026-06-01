import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, radius } from '../theme';
import { FoodMacros } from '../types';
import { searchFoods, scaleMacros, UsdaFood, MissingUsdaKeyError } from '../api/usda';
import * as haptics from '../haptics';
import { toast } from '../toast';

export interface PickedFood {
  name: string;
  fdcId?: number;
  grams: number;
  servingDescription: string;
  macros: FoodMacros;
}

interface Props {
  visible: boolean;
  apiKey: string | undefined;
  onClose: () => void;
  /** Called when the user confirms a food + amount. */
  onPick: (food: PickedFood) => void;
  /** Heading shown at the top of the sheet. */
  title?: string;
  onMissingKey?: () => void;
}

const GRAM_PRESETS = [50, 100, 150, 200];

/**
 * USDA food search + amount picker, presented as a modal sheet. Two steps:
 *   1. Search → tap a result.
 *   2. Set grams → confirm. Calories/macros scale live from the per-100g values.
 */
export function FoodSearchModal({ visible, apiKey, onClose, onPick, title = 'Add food', onMissingKey }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UsdaFood[]>([]);
  const [selected, setSelected] = useState<UsdaFood | null>(null);
  const [grams, setGrams] = useState('100');
  const [searched, setSearched] = useState(false);

  const reset = () => {
    setQuery(''); setResults([]); setSelected(null); setGrams('100'); setSearched(false);
  };
  const close = () => { reset(); onClose(); };

  const runSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    haptics.tap();
    setLoading(true);
    setSearched(true);
    setSelected(null);
    try {
      const found = await searchFoods(query, apiKey ?? '');
      setResults(found);
      if (found.length === 0) toast.info('No matches — try a simpler term');
    } catch (err: any) {
      if (err instanceof MissingUsdaKeyError) {
        toast.error('Add a USDA API key in Goals & Settings');
        onMissingKey?.();
        close();
      } else {
        toast.error(err?.message ?? 'Search failed');
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const gramsNum = (() => {
    const n = parseFloat(grams);
    return isNaN(n) || n <= 0 ? 0 : n;
  })();
  const scaled = selected ? scaleMacros(selected.per100, gramsNum) : null;

  const confirm = () => {
    if (!selected || gramsNum <= 0 || !scaled) return;
    haptics.success();
    onPick({
      name: selected.description,
      fdcId: selected.fdcId,
      grams: gramsNum,
      servingDescription: `${gramsNum} g`,
      macros: scaled,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{selected ? 'Amount' : title}</Text>
            <Pressable onPress={selected ? () => setSelected(null) : close} hitSlop={10}>
              <Ionicons name={selected ? 'arrow-back' : 'close'} size={22} color={colors.textDim} />
            </Pressable>
          </View>

          {!selected ? (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods — e.g. banana, chicken breast"
                  placeholderTextColor={colors.textFaint}
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                  autoFocus
                />
                <Pressable style={styles.searchBtn} onPress={runSearch}>
                  <Ionicons name="search" size={18} color="#0B0F14" />
                </Pressable>
              </View>

              {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
              ) : (
                <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                  {results.map((f) => (
                    <Pressable
                      key={f.fdcId}
                      style={styles.resultRow}
                      onPress={() => { haptics.tick(); setSelected(f); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName} numberOfLines={2}>{f.description}</Text>
                        {f.brandName ? <Text style={styles.resultBrand} numberOfLines={1}>{f.brandName}</Text> : null}
                      </View>
                      <Text style={styles.resultKcal}>{f.per100.calories}<Text style={styles.per100}> /100g</Text></Text>
                    </Pressable>
                  ))}
                  {searched && !loading && results.length === 0 && (
                    <Text style={styles.empty}>No results. Try a simpler search term.</Text>
                  )}
                  {!searched && (
                    <Text style={styles.empty}>Search the USDA food database to add an item.</Text>
                  )}
                </ScrollView>
              )}
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.selName}>{selected.description}</Text>
              {selected.brandName ? <Text style={styles.resultBrand}>{selected.brandName}</Text> : null}

              <Text style={styles.label}>Amount · grams</Text>
              <TextInput
                style={styles.gramsInput}
                value={grams}
                onChangeText={setGrams}
                keyboardType="decimal-pad"
                placeholder="100"
                placeholderTextColor={colors.textFaint}
              />
              <View style={styles.presetRow}>
                {GRAM_PRESETS.map((g) => (
                  <Pressable key={g} style={styles.preset} onPress={() => { haptics.tick(); setGrams(String(g)); }}>
                    <Text style={styles.presetText}>{g}g</Text>
                  </Pressable>
                ))}
                {selected.servingSize ? (
                  <Pressable
                    style={styles.preset}
                    onPress={() => { haptics.tick(); setGrams(String(Math.round(selected.servingSize!))); }}
                  >
                    <Text style={styles.presetText}>
                      1 serv ({Math.round(selected.servingSize)}{selected.servingSizeUnit ?? 'g'})
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {scaled && (
                <View style={styles.macroCard}>
                  <Text style={styles.macroKcal}>{scaled.calories} <Text style={styles.macroKcalUnit}>kcal</Text></Text>
                  <View style={styles.macroRow}>
                    <Macro label="Protein" value={scaled.proteinG} />
                    <Macro label="Carbs" value={scaled.carbsG} />
                    <Macro label="Fat" value={scaled.fatG} />
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.confirmBtn, gramsNum <= 0 && { opacity: 0.5 }]}
                onPress={confirm}
                disabled={gramsNum <= 0}
              >
                <Ionicons name="add" size={18} color="#0B0F14" />
                <Text style={styles.confirmText}>Add</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Macro({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroVal}>{value != null ? `${value}g` : '—'}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },

  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: {
    flex: 1, backgroundColor: colors.surfaceAlt, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.md,
  },
  searchBtn: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  list: { maxHeight: 380 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  resultName: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  resultBrand: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },
  resultKcal: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  per100: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600' },
  empty: { color: colors.textDim, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.lg },

  selName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  label: {
    color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700',
    marginTop: spacing.lg, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  gramsInput: {
    backgroundColor: colors.surfaceAlt, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    fontSize: fontSize.lg, fontWeight: '800',
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  preset: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
  },
  presetText: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },

  macroCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.lg, alignItems: 'center',
  },
  macroKcal: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900' },
  macroKcalUnit: { color: colors.textDim, fontSize: fontSize.md, fontWeight: '700' },
  macroRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  macro: { alignItems: 'center' },
  macroVal: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  macroLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, marginTop: spacing.lg,
  },
  confirmText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
});

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius } from '../theme';
import { RecipeIngredient, Settings, DEFAULT_SETTINGS } from '../types';
import { addRecipe, getSettings } from '../storage';
import { Section, Card } from '../components/Section';
import { FoodSearchModal, PickedFood } from '../components/FoodSearchModal';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RecipeBuilder'>;

export default function RecipeBuilderScreen() {
  const nav = useNavigation<Nav>();
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => { getSettings().then(setSettings); }, []);

  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      proteinG: acc.proteinG + (i.proteinG || 0),
      carbsG: acc.carbsG + (i.carbsG || 0),
      fatG: acc.fatG + (i.fatG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const onPick = (food: PickedFood) => {
    setIngredients((prev) => [
      ...prev,
      {
        name: food.name,
        fdcId: food.fdcId,
        servingDescription: food.servingDescription,
        calories: food.macros.calories,
        proteinG: food.macros.proteinG,
        carbsG: food.macros.carbsG,
        fatG: food.macros.fatG,
      },
    ]);
  };

  const removeIngredient = (idx: number) => {
    haptics.tap();
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSave = name.trim() !== '' && ingredients.length > 0;

  const save = async () => {
    if (!canSave) return;
    haptics.success();
    await addRecipe({
      name: name.trim(),
      ingredients,
      calories: Math.round(totals.calories),
      proteinG: round1(totals.proteinG),
      carbsG: round1(totals.carbsG),
      fatG: round1(totals.fatG),
    });
    toast.success(`Recipe "${name.trim()}" saved`);
    nav.goBack();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="New recipe" subtitle="Add ingredients — calories sum automatically">
        <Card>
          <Text style={styles.label}>Recipe name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Overnight oats"
            placeholderTextColor={colors.textFaint}
          />
        </Card>
      </Section>

      <View style={styles.totalCard}>
        <Text style={styles.totalKcal}>{Math.round(totals.calories)} <Text style={styles.totalUnit}>kcal</Text></Text>
        <View style={styles.macroRow}>
          <Macro label="Protein" value={round1(totals.proteinG)} />
          <Macro label="Carbs" value={round1(totals.carbsG)} />
          <Macro label="Fat" value={round1(totals.fatG)} />
        </View>
      </View>

      <Pressable style={styles.addBtn} onPress={() => { haptics.tap(); setSearchOpen(true); }}>
        <Ionicons name="add" size={18} color="#0B0F14" />
        <Text style={styles.addBtnText}>Add ingredient</Text>
      </Pressable>

      <Section title={`Ingredients (${ingredients.length})`}>
        {ingredients.length === 0 ? (
          <Card><Text style={styles.dim}>No ingredients yet. Add foods from the USDA database.</Text></Card>
        ) : (
          ingredients.map((i, idx) => (
            <Card key={`${i.fdcId ?? 'x'}-${idx}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ingName} numberOfLines={2}>{i.name}</Text>
                <Text style={styles.ingMeta}>
                  {i.servingDescription ? `${i.servingDescription} · ` : ''}{i.calories} kcal
                </Text>
              </View>
              <Pressable onPress={() => removeIngredient(idx)} style={styles.trash} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              </Pressable>
            </Card>
          ))
        )}
      </Section>

      <Pressable style={[styles.saveBtn, !canSave && { opacity: 0.5 }]} onPress={save} disabled={!canSave}>
        <Ionicons name="checkmark" size={18} color="#0B0F14" />
        <Text style={styles.saveText}>Save recipe</Text>
      </Pressable>

      <View style={{ height: spacing.xxl }} />

      <FoodSearchModal
        visible={searchOpen}
        apiKey={settings.usdaApiKey}
        onClose={() => setSearchOpen(false)}
        onPick={onPick}
        title="Add ingredient"
        onMissingKey={() => nav.navigate('Goals')}
      />
    </ScrollView>
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

function round1(v: number): number { return Math.round(v * 10) / 10; }

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  dim: { color: colors.textDim, fontSize: fontSize.md },
  label: {
    color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700',
    marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceAlt, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, fontSize: fontSize.md,
  },

  totalCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center',
  },
  totalKcal: { color: colors.text, fontSize: fontSize.display, fontWeight: '900', letterSpacing: -1 },
  totalUnit: { color: colors.textDim, fontSize: fontSize.md, fontWeight: '700' },
  macroRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  macro: { alignItems: 'center' },
  macroVal: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  macroLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14,
  },
  addBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ingName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  ingMeta: { color: colors.textDim, fontSize: fontSize.sm, marginTop: 2 },
  trash: { padding: 2 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, marginTop: spacing.md,
  },
  saveText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
});

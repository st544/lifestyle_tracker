import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, radius } from '../theme';
import { FoodEntry, Recipe, Session, Settings, DEFAULT_SETTINGS } from '../types';
import {
  getFoodEntriesForDate, addFoodEntry, deleteFoodEntry,
  getRecipes, deleteRecipe, getSettings, getSessionsForDate,
} from '../storage';
import { todayString, formatLong } from '../dates';
import { Section, Card } from '../components/Section';
import { FoodSearchModal, PickedFood } from '../components/FoodSearchModal';
import * as haptics from '../haptics';
import { toast } from '../toast';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Nutrition'>;
type R = RouteProp<RootStackParamList, 'Nutrition'>;

export default function NutritionScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();
  const date = route.params?.date ?? todayString();

  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    const [e, r, st, s] = await Promise.all([
      getFoodEntriesForDate(date), getRecipes(), getSettings(), getSessionsForDate(date),
    ]);
    setEntries(e); setRecipes(r); setSettings(st); setSessions(s);
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    nav.setOptions({ title: 'Nutrition' });
  }, [nav]);

  const consumed = Math.round(entries.reduce((sum, e) => sum + (e.calories || 0), 0));
  const protein = round0(entries.reduce((sum, e) => sum + (e.proteinG || 0), 0));
  const carbs = round0(entries.reduce((sum, e) => sum + (e.carbsG || 0), 0));
  const fat = round0(entries.reduce((sum, e) => sum + (e.fatG || 0), 0));
  const burned = Math.round(
    sessions
      .filter((s) => s.status === 'Completed' || s.status === 'Partial')
      .reduce((sum, s) => sum + (s.activeCalories || 0), 0),
  );
  const goal = settings.dailyCalorieGoal;
  const pct = goal && goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  const remaining = goal ? goal - consumed : undefined;

  const onPickFood = async (food: PickedFood) => {
    await addFoodEntry({
      date,
      name: food.name,
      fdcId: food.fdcId,
      servingDescription: food.servingDescription,
      calories: food.macros.calories,
      proteinG: food.macros.proteinG,
      carbsG: food.macros.carbsG,
      fatG: food.macros.fatG,
    });
    toast.success(`Added ${food.macros.calories} kcal`);
    load();
  };

  const addRecipeToDay = async (r: Recipe) => {
    haptics.success();
    await addFoodEntry({
      date,
      name: r.name,
      recipeId: r.id,
      servingDescription: `Recipe · ${r.ingredients.length} ${r.ingredients.length === 1 ? 'item' : 'items'}`,
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
    });
    toast.success(`Logged ${r.name}`);
    load();
  };

  const onDeleteEntry = async (id: string) => {
    haptics.tap();
    await deleteFoodEntry(id);
    load();
  };

  const onDeleteRecipe = (r: Recipe) => {
    Alert.alert('Delete recipe?', `Remove "${r.name}"? This won't affect already-logged days.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRecipe(r.id); toast.info('Recipe deleted'); load(); } },
    ]);
  };

  const hasKey = !!settings.usdaApiKey?.trim();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Day summary */}
      <Section title="Today" subtitle={formatLong(date)}>
        <Card>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.bigKcal}>{consumed}</Text>
              <Text style={styles.bigKcalLabel}>
                kcal eaten{goal ? ` of ${goal}` : ''}
              </Text>
            </View>
            <View style={styles.netCol}>
              <NetStat label="Burned" value={burned > 0 ? `${burned}` : '—'} />
              {goal ? (
                <NetStat
                  label={remaining! >= 0 ? 'Remaining' : 'Over'}
                  value={`${Math.abs(remaining!)}`}
                  color={remaining! >= 0 ? colors.success : colors.danger}
                />
              ) : (
                <NetStat label="Net" value={`${consumed - burned}`} />
              )}
            </View>
          </View>

          {goal ? (
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? colors.warn : colors.success }]} />
            </View>
          ) : null}

          <View style={styles.macroRow}>
            <Macro label="Protein" value={protein} />
            <Macro label="Carbs" value={carbs} />
            <Macro label="Fat" value={fat} />
          </View>
        </Card>
      </Section>

      {/* Add actions */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            if (!hasKey) {
              Alert.alert(
                'USDA key needed',
                'Add a free USDA FoodData Central API key in Goals & Settings to search foods.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => nav.navigate('Goals') },
                ],
              );
              return;
            }
            haptics.tap();
            setSearchOpen(true);
          }}
        >
          <Ionicons name="search" size={18} color="#0B0F14" />
          <Text style={styles.addBtnText}>Search food</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => { haptics.tap(); nav.navigate('RecipeBuilder'); }}
        >
          <Ionicons name="restaurant-outline" size={18} color={colors.text} />
          <Text style={styles.secondaryBtnText}>New recipe</Text>
        </Pressable>
      </View>

      {/* Saved recipes — one tap to log */}
      {recipes.length > 0 && (
        <Section title="Recipes" subtitle="Tap to log · long-press to delete">
          <View style={styles.recipeWrap}>
            {recipes.map((r) => (
              <Pressable
                key={r.id}
                style={styles.recipeChip}
                onPress={() => addRecipeToDay(r)}
                onLongPress={() => onDeleteRecipe(r)}
              >
                <Ionicons name="add-circle" size={16} color={colors.primary} />
                <Text style={styles.recipeName} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.recipeKcal}>{r.calories} kcal</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      )}

      {/* Today's entries */}
      <Section title={`Logged (${entries.length})`}>
        {entries.length === 0 ? (
          <Card>
            <Text style={styles.dim}>Nothing logged yet. Search a food or tap a recipe above.</Text>
          </Card>
        ) : (
          entries.map((e) => (
            <Card key={e.id} style={styles.entryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName} numberOfLines={2}>{e.name}</Text>
                <Text style={styles.entryMeta}>
                  {e.servingDescription ? `${e.servingDescription} · ` : ''}
                  {e.calories} kcal
                  {e.proteinG != null ? ` · P${round0(e.proteinG)}` : ''}
                  {e.carbsG != null ? ` C${round0(e.carbsG)}` : ''}
                  {e.fatG != null ? ` F${round0(e.fatG)}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onDeleteEntry(e.id)} style={styles.trash} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </Card>
          ))
        )}
      </Section>

      <View style={{ height: spacing.xxl }} />

      <FoodSearchModal
        visible={searchOpen}
        apiKey={settings.usdaApiKey}
        onClose={() => setSearchOpen(false)}
        onPick={onPickFood}
        onMissingKey={() => nav.navigate('Goals')}
      />
    </ScrollView>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroVal}>{value}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function NetStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.netStat}>
      <Text style={[styles.netVal, color ? { color } : null]}>{value}</Text>
      <Text style={styles.netLabel}>{label}</Text>
    </View>
  );
}

function round0(v: number): number { return Math.round(v); }

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.md },
  dim: { color: colors.textDim, fontSize: fontSize.md },

  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bigKcal: { color: colors.text, fontSize: fontSize.display, fontWeight: '900', letterSpacing: -1 },
  bigKcalLabel: { color: colors.textDim, fontSize: fontSize.sm, marginTop: -2 },
  netCol: { gap: spacing.sm, alignItems: 'flex-end' },
  netStat: { alignItems: 'flex-end' },
  netVal: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  netLabel: { color: colors.textDim, fontSize: fontSize.xs, letterSpacing: 0.4 },

  barTrack: {
    height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    overflow: 'hidden', marginTop: spacing.md,
  },
  barFill: { height: '100%', borderRadius: radius.pill },

  macroRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md },
  macro: { alignItems: 'center' },
  macroVal: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  macroLabel: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14,
  },
  addBtnText: { color: '#0B0F14', fontWeight: '800', fontSize: fontSize.md },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.md },

  recipeWrap: { gap: spacing.sm },
  recipeChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  recipeName: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  recipeKcal: { color: colors.textDim, fontSize: fontSize.sm, fontWeight: '700' },

  entryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  entryName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  entryMeta: { color: colors.textDim, fontSize: fontSize.sm, marginTop: 2 },
  trash: { padding: 4 },
});

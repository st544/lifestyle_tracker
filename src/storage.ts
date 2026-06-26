import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Session, SessionInput, Template, Settings, DEFAULT_SETTINGS,
  DailyLog, WeeklyChecklist, DailyInsight,
  StravaTokens, StravaSyncState, HealthConnectSyncState,
  FoodEntry, Recipe,
} from './types';
import { calculateLoadScore, calculateWeeklyLoad, WeeklyLoad } from './load';
import { weekRange, isInRange, toDateString } from './dates';

const KEYS = {
  sessions: 'training_sessions',
  templates: 'training_templates',
  settings: 'training_settings',
  dailyLogs: 'training_daily_logs',
  weeklyChecklists: 'training_weekly_checklists',
  dailyInsights: 'training_daily_insights',
  stravaTokens: 'training_strava_tokens',
  stravaSyncState: 'training_strava_sync_state',
  healthConnectSyncState: 'training_health_connect_sync_state',
  // last-seen snapshots used to detect when we've crossed a milestone
  // since the user last opened a particular screen
  lastSeenStreaks: 'training_last_seen_streaks',
  lastSeenWeeklyPercent: 'training_last_seen_weekly_pct',
  // Nutrition
  foodEntries: 'training_food_entries',
  recipes: 'training_recipes',
};

function uid(): string {
  return (
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 10)
  );
}

// --- Sessions ---

export async function getSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(KEYS.sessions);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Session[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
}

export async function addSession(input: SessionInput): Promise<Session> {
  const now = new Date().toISOString();
  const bodyWeightKg = (await getSettings()).bodyWeightKg;
  const session: Session = {
    ...input,
    id: uid(),
    loadScore: input.loadScore ?? calculateLoadScore(input, bodyWeightKg),
    createdAt: now,
    updatedAt: now,
  };
  const existing = await getSessions();
  await saveSessions([...existing, session]);
  return session;
}

export async function updateSession(
  id: string,
  patch: Partial<Session>
): Promise<Session | null> {
  const existing = await getSessions();
  const bodyWeightKg = (await getSettings()).bodyWeightKg;
  let updated: Session | null = null;
  const next = existing.map((s) => {
    if (s.id !== id) return s;
    const merged: Session = {
      ...s,
      ...patch,
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: new Date().toISOString(),
    };
    // Recompute load if any load-relevant field changed.
    if (
      patch.type !== undefined ||
      patch.subtype !== undefined ||
      patch.durationMinutes !== undefined ||
      patch.intensity !== undefined ||
      patch.activeCalories !== undefined ||
      patch.hikingDifficulty !== undefined ||
      patch.packWeightLbs !== undefined ||
      patch.elevationGainFeet !== undefined ||
      patch.miles !== undefined ||
      patch.loadScore === undefined
    ) {
      merged.loadScore = calculateLoadScore(merged, bodyWeightKg);
    }
    updated = merged;
    return merged;
  });
  await saveSessions(next);
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  const existing = await getSessions();
  await saveSessions(existing.filter((s) => s.id !== id));
}

export async function getSessionsForDate(date: string): Promise<Session[]> {
  const all = await getSessions();
  return all.filter((s) => s.date === date);
}

export async function getSessionsForWeek(
  reference: Date,
  weekStartsOn: 'monday' | 'sunday' = 'monday'
): Promise<Session[]> {
  const all = await getSessions();
  const { startStr, endStr } = weekRange(reference, weekStartsOn);
  return all.filter((s) => isInRange(s.date, startStr, endStr));
}

export async function calculateProjectedWeeklyLoad(
  reference: Date = new Date()
): Promise<WeeklyLoad> {
  const settings = await getSettings();
  const weekSessions = await getSessionsForWeek(reference, settings.weekStartsOn);
  return calculateWeeklyLoad(weekSessions, settings.defaultWeeklyTargetLoad, settings.bodyWeightKg);
}

// --- Templates ---

export async function getTemplates(): Promise<Template[]> {
  const raw = await AsyncStorage.getItem(KEYS.templates);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Template[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTemplates(templates: Template[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.templates, JSON.stringify(templates));
}

export async function addTemplate(
  input: Omit<Template, 'id' | 'createdAt'>
): Promise<Template> {
  const tpl: Template = {
    ...input,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  const all = await getTemplates();
  await saveTemplates([...all, tpl]);
  return tpl;
}

export async function deleteTemplate(id: string): Promise<void> {
  const all = await getTemplates();
  await saveTemplates(all.filter((t) => t.id !== id));
}

// --- Settings ---

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(s));
}

// --- Last-seen snapshots (for celebration triggers) ---

export async function getLastSeenStreaks(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(KEYS.lastSeenStreaks);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function saveLastSeenStreaks(map: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastSeenStreaks, JSON.stringify(map));
}

export async function getLastSeenWeeklyPercent(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEYS.lastSeenWeeklyPercent);
  if (!raw) return 0;
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

export async function saveLastSeenWeeklyPercent(pct: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastSeenWeeklyPercent, String(pct));
}

// --- Daily logs (HRV / sleep / supplements) ---

export async function getDailyLogs(): Promise<DailyLog[]> {
  const raw = await AsyncStorage.getItem(KEYS.dailyLogs);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DailyLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveDailyLogs(logs: DailyLog[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.dailyLogs, JSON.stringify(logs));
}

export async function getDailyLog(date: string): Promise<DailyLog | undefined> {
  const all = await getDailyLogs();
  return all.find((l) => l.date === date);
}

/** Upsert: if a log exists for `patch.date`, merge into it; otherwise create. */
export async function upsertDailyLog(patch: Partial<DailyLog> & { date: string }): Promise<DailyLog> {
  const all = await getDailyLogs();
  const idx = all.findIndex((l) => l.date === patch.date);
  const now = new Date().toISOString();
  let updated: DailyLog;
  if (idx >= 0) {
    updated = {
      ...all[idx],
      ...patch,
      supplements: { ...(all[idx].supplements ?? {}), ...(patch.supplements ?? {}) },
      updatedAt: now,
    };
    all[idx] = updated;
  } else {
    updated = {
      supplements: {},
      ...patch,
      createdAt: now,
      updatedAt: now,
    } as DailyLog;
    all.push(updated);
  }
  await saveDailyLogs(all);
  return updated;
}

// --- Weekly checklists (meal prep) ---

export async function getWeeklyChecklists(): Promise<WeeklyChecklist[]> {
  const raw = await AsyncStorage.getItem(KEYS.weeklyChecklists);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WeeklyChecklist[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveWeeklyChecklists(items: WeeklyChecklist[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.weeklyChecklists, JSON.stringify(items));
}

export async function getWeeklyChecklist(weekStart: string): Promise<WeeklyChecklist | undefined> {
  const all = await getWeeklyChecklists();
  return all.find((c) => c.weekStart === weekStart);
}

export async function setMealPrepDone(weekStart: string, done: boolean): Promise<WeeklyChecklist> {
  const all = await getWeeklyChecklists();
  const idx = all.findIndex((c) => c.weekStart === weekStart);
  const now = new Date().toISOString();
  let updated: WeeklyChecklist;
  if (idx >= 0) {
    updated = { ...all[idx], mealPrepDone: done, updatedAt: now };
    all[idx] = updated;
  } else {
    updated = { weekStart, mealPrepDone: done, createdAt: now, updatedAt: now };
    all.push(updated);
  }
  await saveWeeklyChecklists(all);
  return updated;
}

// --- Daily insights (AI recommendation, cached by target date) ---

export async function getDailyInsights(): Promise<DailyInsight[]> {
  const raw = await AsyncStorage.getItem(KEYS.dailyInsights);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DailyInsight[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveDailyInsights(items: DailyInsight[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.dailyInsights, JSON.stringify(items));
}

export async function getDailyInsight(date: string): Promise<DailyInsight | undefined> {
  const all = await getDailyInsights();
  return all.find((i) => i.date === date);
}

export async function upsertDailyInsight(insight: DailyInsight): Promise<DailyInsight> {
  const all = await getDailyInsights();
  const idx = all.findIndex((i) => i.date === insight.date);
  if (idx >= 0) all[idx] = insight;
  else all.push(insight);
  // Keep the last 60 insights — bound storage growth
  all.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = all.slice(-60);
  await saveDailyInsights(trimmed);
  return insight;
}

// --- Strava tokens + sync state ---

export async function getStravaTokens(): Promise<StravaTokens | undefined> {
  const raw = await AsyncStorage.getItem(KEYS.stravaTokens);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as StravaTokens; } catch { return undefined; }
}

export async function saveStravaTokens(t: StravaTokens): Promise<void> {
  await AsyncStorage.setItem(KEYS.stravaTokens, JSON.stringify(t));
}

export async function clearStravaTokens(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.stravaTokens);
  await AsyncStorage.removeItem(KEYS.stravaSyncState);
}

export async function getStravaSyncState(): Promise<StravaSyncState> {
  const raw = await AsyncStorage.getItem(KEYS.stravaSyncState);
  if (!raw) return { syncedIds: [], lastSyncedAt: 0 };
  try {
    const parsed = JSON.parse(raw) as StravaSyncState;
    return {
      syncedIds: Array.isArray(parsed.syncedIds) ? parsed.syncedIds : [],
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : 0,
    };
  } catch { return { syncedIds: [], lastSyncedAt: 0 }; }
}

export async function saveStravaSyncState(s: StravaSyncState): Promise<void> {
  // Cap synced IDs at 5000 to bound storage growth (~50KB)
  const trimmed: StravaSyncState = {
    syncedIds: s.syncedIds.slice(-5000),
    lastSyncedAt: s.lastSyncedAt,
  };
  await AsyncStorage.setItem(KEYS.stravaSyncState, JSON.stringify(trimmed));
}

// --- Health Connect sync state (mirror the Strava helpers) -------------

export async function getHealthConnectSyncState(): Promise<HealthConnectSyncState> {
  const raw = await AsyncStorage.getItem(KEYS.healthConnectSyncState);
  if (!raw) return { syncedRecordIds: [], lastSyncedAt: 0 };
  try {
    const parsed = JSON.parse(raw) as HealthConnectSyncState;
    return {
      syncedRecordIds: Array.isArray(parsed.syncedRecordIds) ? parsed.syncedRecordIds : [],
      lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : 0,
    };
  } catch { return { syncedRecordIds: [], lastSyncedAt: 0 }; }
}

export async function saveHealthConnectSyncState(s: HealthConnectSyncState): Promise<void> {
  // Cap synced record IDs at 5000 to bound storage growth, like Strava.
  const trimmed: HealthConnectSyncState = {
    syncedRecordIds: s.syncedRecordIds.slice(-5000),
    lastSyncedAt: s.lastSyncedAt,
  };
  await AsyncStorage.setItem(KEYS.healthConnectSyncState, JSON.stringify(trimmed));
}

// --- Nutrition: food entries + recipes ---------------------------------

export async function getFoodEntries(): Promise<FoodEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.foodEntries);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FoodEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveFoodEntries(entries: FoodEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.foodEntries, JSON.stringify(entries));
}

export async function getFoodEntriesForDate(date: string): Promise<FoodEntry[]> {
  const all = await getFoodEntries();
  return all
    .filter((e) => e.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addFoodEntry(
  input: Omit<FoodEntry, 'id' | 'createdAt'>,
): Promise<FoodEntry> {
  const entry: FoodEntry = { ...input, id: uid(), createdAt: new Date().toISOString() };
  const all = await getFoodEntries();
  await saveFoodEntries([...all, entry]);
  return entry;
}

export async function deleteFoodEntry(id: string): Promise<void> {
  const all = await getFoodEntries();
  await saveFoodEntries(all.filter((e) => e.id !== id));
}

/** Sum of calories logged on a given date. */
export async function getCaloriesForDate(date: string): Promise<number> {
  const entries = await getFoodEntriesForDate(date);
  return Math.round(entries.reduce((sum, e) => sum + (e.calories || 0), 0));
}

export async function getRecipes(): Promise<Recipe[]> {
  const raw = await AsyncStorage.getItem(KEYS.recipes);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Recipe[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveRecipes(recipes: Recipe[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.recipes, JSON.stringify(recipes));
}

export async function addRecipe(
  input: Omit<Recipe, 'id' | 'createdAt'>,
): Promise<Recipe> {
  const recipe: Recipe = { ...input, id: uid(), createdAt: new Date().toISOString() };
  const all = await getRecipes();
  await saveRecipes([...all, recipe]);
  return recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const all = await getRecipes();
  await saveRecipes(all.filter((r) => r.id !== id));
}

/**
 * Build a single JSON payload representing the user's entire training data.
 * Strips Strava tokens, Strava client secret, and the Anthropic API key — the
 * export is for backup / portability, not credential leakage.
 */
export async function exportAllAsJson(): Promise<string> {
  const [
    sessions, templates, dailyLogs, weeklyChecklists, dailyInsights, settings, syncState,
    foodEntries, recipes,
  ] = await Promise.all([
    getSessions(),
    getTemplates(),
    getDailyLogs(),
    getWeeklyChecklists(),
    getDailyInsights(),
    getSettings(),
    getStravaSyncState(),
    getFoodEntries(),
    getRecipes(),
  ]);
  // Strip sensitive fields
  const {
    anthropicApiKey: _a, stravaClientSecret: _b, stravaClientId: _c, usdaApiKey: _d,
    ...safeSettings
  } = settings;
  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    sessions,
    templates,
    dailyLogs,
    weeklyChecklists,
    dailyInsights,
    foodEntries,
    recipes,
    settings: safeSettings,
    stravaSyncStateMeta: {
      syncedCount: syncState.syncedIds.length,
      lastSyncedAt: syncState.lastSyncedAt,
    },
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  sessions: number;
  dailyLogs: number;
  templates: number;
  foodEntries: number;
  recipes: number;
  weeklyChecklists: number;
  dailyInsights: number;
}

/**
 * Restore a JSON dump produced by `exportAllAsJson` (e.g. from the old Expo Go
 * install) into this install. Non-destructive union: imported records win on
 * id/date collisions, existing records are kept otherwise. Settings merge with
 * the imported values overlaid on existing — locally-entered API keys survive
 * because the export strips them (they're simply absent from the payload).
 */
export async function importAllFromJson(json: string): Promise<ImportResult> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('Unexpected JSON shape.');

  const mergeById = <T extends { id: string }>(existing: T[], incoming: unknown): T[] => {
    if (!Array.isArray(incoming)) return existing;
    const map = new Map<string, T>();
    for (const e of existing) map.set(e.id, e);
    for (const r of incoming as T[]) if (r && r.id) map.set(r.id, r);
    return Array.from(map.values());
  };
  const mergeByKey = <T>(existing: T[], incoming: unknown, key: (t: T) => string): T[] => {
    if (!Array.isArray(incoming)) return existing;
    const map = new Map<string, T>();
    for (const e of existing) map.set(key(e), e);
    for (const r of incoming as T[]) if (r) map.set(key(r), r);
    return Array.from(map.values());
  };

  const [
    curSessions, curTemplates, curLogs, curChecklists, curInsights, curSettings,
    curFood, curRecipes,
  ] = await Promise.all([
    getSessions(), getTemplates(), getDailyLogs(), getWeeklyChecklists(),
    getDailyInsights(), getSettings(), getFoodEntries(), getRecipes(),
  ]);

  const nextSessions = mergeById(curSessions, data.sessions);
  const nextTemplates = mergeById(curTemplates, data.templates);
  const nextFood = mergeById(curFood, data.foodEntries);
  const nextRecipes = mergeById(curRecipes, data.recipes);
  const nextLogs = mergeByKey<DailyLog>(curLogs, data.dailyLogs, (l) => l.date);
  const nextChecklists = mergeByKey<WeeklyChecklist>(curChecklists, data.weeklyChecklists, (c) => c.weekStart);
  const nextInsights = mergeByKey<DailyInsight>(curInsights, data.dailyInsights, (i) => i.date);

  await Promise.all([
    saveSessions(nextSessions),
    saveTemplates(nextTemplates),
    saveDailyLogs(nextLogs),
    saveWeeklyChecklists(nextChecklists),
    saveDailyInsights(nextInsights),
    saveFoodEntries(nextFood),
    saveRecipes(nextRecipes),
  ]);

  if (data.settings && typeof data.settings === 'object') {
    // Imported settings overlay existing; existing API keys survive (export strips them).
    await saveSettings({ ...curSettings, ...data.settings });
  }

  return {
    sessions: Array.isArray(data.sessions) ? data.sessions.length : 0,
    dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs.length : 0,
    templates: Array.isArray(data.templates) ? data.templates.length : 0,
    foodEntries: Array.isArray(data.foodEntries) ? data.foodEntries.length : 0,
    recipes: Array.isArray(data.recipes) ? data.recipes.length : 0,
    weeklyChecklists: Array.isArray(data.weeklyChecklists) ? data.weeklyChecklists.length : 0,
    dailyInsights: Array.isArray(data.dailyInsights) ? data.dailyInsights.length : 0,
  };
}

/**
 * One-time migration: sleep quality scale changed from 1-10 to 1-100.
 * Multiplies any pre-existing quality value (≤ 10) by 10. Idempotent via a
 * settings flag so we never double-migrate.
 */
export async function migrateSleepQualityIfNeeded(): Promise<void> {
  const settings = await getSettings();
  if (settings.sleepQualityMigratedToHundred) return;
  const logs = await getDailyLogs();
  let changed = false;
  const now = new Date().toISOString();
  for (const log of logs) {
    if (typeof log.sleepQuality === 'number' && log.sleepQuality > 0 && log.sleepQuality <= 10) {
      log.sleepQuality = Math.round(log.sleepQuality * 10);
      log.updatedAt = now;
      changed = true;
    }
  }
  if (changed) await saveDailyLogs(logs);
  await saveSettings({ ...settings, sleepQualityMigratedToHundred: true });
}

/**
 * Current load-model version. Bump this whenever the per-activity load formulas
 * in `load.ts` change so historical `loadScore`s get recomputed onto the new
 * scale. v1 = initial calorie/MET model; v2 = hiking additive-bonus model,
 * expanded run types, lifting RPE adjustment.
 */
export const CURRENT_LOAD_MODEL_VERSION = 2;

/**
 * Recompute every session's `loadScore` under the current load model whenever
 * the stored version is behind, so historical trends/ACWR stay on one
 * consistent scale. Non-destructive (`loadScore` is derived) and idempotent via
 * the `loadModelVersion` settings flag.
 */
export async function migrateLoadScoresIfNeeded(): Promise<void> {
  const settings = await getSettings();
  // Treat the old boolean flag as "v1 done" for users who migrated before
  // versioning existed.
  const storedVersion = settings.loadModelVersion
    ?? (settings.loadModelMigratedToCalorie ? 1 : 0);
  if (storedVersion >= CURRENT_LOAD_MODEL_VERSION) return;

  const sessions = await getSessions();
  if (sessions.length > 0) {
    const bodyWeightKg = settings.bodyWeightKg;
    const recomputed = sessions.map((s) => ({
      ...s,
      loadScore: calculateLoadScore(s, bodyWeightKg),
    }));
    await saveSessions(recomputed);
  }
  await saveSettings({
    ...settings,
    loadModelVersion: CURRENT_LOAD_MODEL_VERSION,
    loadModelMigratedToCalorie: true,
  });
}

// Seed default templates on first run
export async function seedDefaultsIfEmpty(): Promise<void> {
  const tpls = await getTemplates();
  if (tpls.length > 0) return;
  const now = new Date().toISOString();
  const defaults: Template[] = [
    {
      id: uid(), createdAt: now,
      name: 'Princeton BJJ Tuesday',
      type: 'BJJ', startTime: '18:30', durationMinutes: 120, intensity: 7,
      location: 'Princeton BJJ', subtype: 'Normal class',
    },
    {
      id: uid(), createdAt: now,
      name: 'Logic BJJ',
      type: 'BJJ', durationMinutes: 90, intensity: 7,
      location: 'Logic', subtype: 'Normal class',
    },
    {
      id: uid(), createdAt: now,
      name: 'Morning Lift',
      type: 'Lift', durationMinutes: 45, intensity: 6, subtype: 'Normal lift',
    },
    {
      id: uid(), createdAt: now,
      name: 'Zone 2 Run',
      type: 'Run', durationMinutes: 30, intensity: 4, subtype: 'Easy / Zone 2',
    },
    {
      id: uid(), createdAt: now,
      name: 'Sauna + Cold Plunge',
      type: 'Sauna + Cold Plunge', durationMinutes: 60, intensity: 3,
    },
  ];
  await saveTemplates(defaults);
}

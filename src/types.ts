export type SessionType =
  | 'BJJ'
  | 'Lift'
  | 'Run'
  | 'Rock Climb'
  | 'Hiking'
  | 'Sauna'
  | 'Cold Plunge'
  | 'Sauna + Cold Plunge'
  | 'Rest'
  | 'Mobility / Recovery';

/** Difficulty bands for Hiking — drive the hiking load multiplier. */
export type HikingDifficulty =
  | 'Easy / flat'
  | 'Moderate'
  | 'Hilly'
  | 'Hard / steep'
  | 'Very hard / mountain';

export type SessionStatus =
  | 'Planned'
  | 'Completed'
  | 'Skipped'
  | 'Moved'
  | 'Partial';

export interface Session {
  id: string;
  // YYYY-MM-DD (local)
  date: string;
  // HH:mm (local, optional)
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  type: SessionType;
  subtype?: string;
  status: SessionStatus;
  intensity?: number; // 0-10 (RPE)
  location?: string;
  notes?: string;
  loadScore?: number;
  // Sauna + Cold Plunge optional components
  saunaMinutes?: number;
  coldPlungeMinutes?: number;
  // Distance in miles. Run AND Hiking both use this (was Run-only `miles`,
  // kept under that name for backward compatibility with stored sessions).
  miles?: number;
  // --- Calorie/MET load-model fields (all optional) ---
  // Actual active calories burned (from a watch / Strava). When present this is
  // the preferred `baseEnergyEquivalent`; otherwise we estimate per activity.
  activeCalories?: number;
  // Hiking context (stored/displayed, NOT added directly to load).
  elevationGainFeet?: number;
  hikingDifficulty?: HikingDifficulty;
  packWeightLbs?: number;
  trailName?: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionInput = Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'loadScore'> & {
  loadScore?: number;
};

export interface Template {
  id: string;
  name: string;
  type: SessionType;
  subtype?: string;
  durationMinutes: number;
  intensity?: number;
  location?: string;
  startTime?: string;
  notes?: string;
  createdAt: string;
}

export interface Settings {
  defaultWeeklyTargetLoad: number;
  weekStartsOn: 'monday' | 'sunday';
  // Per-activity weekly session minimums. Missing = no goal for that type.
  goals: Partial<Record<SessionType, number>>;
  // Anthropic API key (stored locally only — never leaves the device except to api.anthropic.com).
  anthropicApiKey?: string;
  // User heart-rate bounds (used by RPE estimator). Defaults: 190 / 60.
  maxHeartRate?: number;
  restingHeartRate?: number;
  // Body weight in kg — used for MET-based calorie estimates (Lift / Rock Climb
  // / Hiking fallback) when active calories aren't known. Optional; falls back
  // to DEFAULT_BODY_WEIGHT_KG in load.ts.
  bodyWeightKg?: number;
  // Strava OAuth app credentials (user-created at strava.com/api).
  stravaClientId?: string;
  stravaClientSecret?: string;
  // USDA FoodData Central API key (free at fdc.nal.usda.gov). Stored locally
  // only; used for the nutrition food search.
  usdaApiKey?: string;
  // Daily calorie intake goal (kcal). Optional — drives the nutrition progress bar.
  dailyCalorieGoal?: number;
  // One-time migration flag: sleep quality scale changed 1-10 → 1-100.
  sleepQualityMigratedToHundred?: boolean;
  // One-time migration flag: per-session loadScore recomputed under the
  // calorie/MET-equivalent model (replacing the old RPE×duration×mult model).
  // Superseded by `loadModelVersion` but kept so old stored settings still parse.
  loadModelMigratedToCalorie?: boolean;
  // Version of the load model the stored `loadScore`s were last computed under.
  // Bumped whenever the per-activity formulas change so a migration recomputes
  // historical sessions onto the current scale.
  loadModelVersion?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultWeeklyTargetLoad: 4000,
  weekStartsOn: 'sunday',
  goals: {
    BJJ: 3,
    Lift: 2,
    Run: 2,
  },
  maxHeartRate: 190,
  restingHeartRate: 60,
  bodyWeightKg: 80,
};

// --- Strava tokens (stored separately from settings so we never log them) ---

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch SECONDS (matches Strava's expires_at field). */
  expiresAt: number;
  athleteId?: number;
  athleteName?: string;
}

export interface StravaSyncState {
  /** Strava activity IDs we have already imported as Sessions. */
  syncedIds: number[];
  /** Unix epoch SECONDS of the most recently synced activity start time. */
  lastSyncedAt: number;
}

// --- Daily wellness / supplement log -----------------------------------

export type SupplementKey = 'creatine' | 'greens' | 'electrolytes' | 'protein';

export const SUPPLEMENTS: { key: SupplementKey; label: string }[] = [
  { key: 'creatine',     label: 'Creatine' },
  { key: 'greens',       label: 'Greens' },
  { key: 'electrolytes', label: 'Electrolytes' },
  { key: 'protein',      label: 'Protein' },
];

export interface DailyLog {
  date: string;            // YYYY-MM-DD (one record per date)
  hrv?: number;            // ms — overnight HRV score
  sleepHours?: number;     // hours slept
  sleepQuality?: number;   // 1-100 (was 1-10 in v1 — migrated automatically on first run)
  supplements: Partial<Record<SupplementKey, boolean>>;
  notes?: string;
  wellnessScore?: number;  // cached composite 0-100
  createdAt: string;
  updatedAt: string;
}

// --- Weekly meal prep checklist ----------------------------------------

export interface WeeklyChecklist {
  weekStart: string;       // YYYY-MM-DD of the week-start (per settings.weekStartsOn)
  mealPrepDone: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- AI daily insight (cached so we only call the API once/day) --------

export type InsightFocus = 'recovery' | 'training' | 'rest' | 'maintenance';

export interface DailyInsight {
  // The date the insight is FOR (typically tomorrow's date).
  date: string;
  generatedAt: string;
  recommendation: string;   // one specific actionable line
  reasoning: string;        // 1-2 sentence why
  focus: InsightFocus;
  model: string;            // claude model used
}

// --- Nutrition / calorie tracking --------------------------------------

/** Energy + macros for a food, serving, or recipe (all optional except calories). */
export interface FoodMacros {
  calories: number;     // kcal
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

/** A single logged food on a given day. */
export interface FoodEntry extends FoodMacros {
  id: string;
  date: string;                 // YYYY-MM-DD
  name: string;
  fdcId?: number;               // USDA FoodData Central id, if from search
  /** Human label for the amount eaten, e.g. "150 g" or "1 × Overnight oats". */
  servingDescription?: string;
  /** Recipe this entry was added from, if any. */
  recipeId?: string;
  createdAt: string;
}

/** One ingredient inside a saved recipe (already scaled to its amount). */
export interface RecipeIngredient extends FoodMacros {
  name: string;
  fdcId?: number;
  servingDescription?: string;
}

/** A reusable named recipe. Top-level macros are the summed totals. */
export interface Recipe extends FoodMacros {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  createdAt: string;
}

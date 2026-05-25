export type SessionType =
  | 'BJJ'
  | 'Lift'
  | 'Run'
  | 'Rock Climb'
  | 'Sauna'
  | 'Cold Plunge'
  | 'Sauna + Cold Plunge'
  | 'Rest'
  | 'Mobility / Recovery';

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
  intensity?: number; // 0-10
  location?: string;
  notes?: string;
  loadScore?: number;
  // Sauna + Cold Plunge optional components
  saunaMinutes?: number;
  coldPlungeMinutes?: number;
  // Run-only
  miles?: number;
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
  // Strava OAuth app credentials (user-created at strava.com/api).
  stravaClientId?: string;
  stravaClientSecret?: string;
  // One-time migration flag: sleep quality scale changed 1-10 → 1-100.
  sleepQualityMigratedToHundred?: boolean;
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

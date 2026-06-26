/**
 * Health Connect → app sync runner (Android). Structural twin of
 * `strava-sync.ts`: read since a high-water mark, dedup on stable record IDs,
 * map exercise sessions to `Session` via the SAME `estimateRpe` +
 * `calculateLoadScore` path, and upsert HRV / sleep / resting-HR into daily
 * logs through the existing `upsertDailyLog`.
 *
 * Safe to call on every TodayScreen focus: no-ops on iOS, when Health Connect
 * is unavailable, or when permissions aren't granted. Never throws to the UI.
 */

import { Platform } from 'react-native';
import { Session, SessionStatus, SessionType, Settings, DEFAULT_SETTINGS } from '../types';
import {
  addSession, getSettings, upsertDailyLog,
  getHealthConnectSyncState, saveHealthConnectSyncState,
} from '../storage';
import { toDateString } from '../dates';
import { calculateLoadScore } from '../load';
import { estimateRpe, inferRunSubtype } from '../rpe';
import {
  isAvailable, ensureInitialized, getGrantedRecordTypes,
  readHrv, readSleep, readRestingHr, readExerciseSessions, readActiveCalories,
  readDistance, readHeartRate, TimeRange,
} from './health-connect';

export interface HealthConnectSyncResult {
  importedSessions: number;
  importedDailyLogs: number;
  skipped: number;
  ranAt: string;
}

const INITIAL_BACKFILL_DAYS = 30;

const empty = (): HealthConnectSyncResult => ({
  importedSessions: 0, importedDailyLogs: 0, skipped: 0, ranAt: new Date().toISOString(),
});

/**
 * Run a Health Connect sync. Returns a summary; never throws for the
 * unavailable / denied case (returns zeros). Caller (TodayScreen) additionally
 * gates on Platform + Settings.healthConnectEnabled.
 */
export async function syncHealthConnect(): Promise<HealthConnectSyncResult> {
  if (Platform.OS !== 'android') return empty();
  if (!(await isAvailable())) return empty();
  if (!(await ensureInitialized())) return empty();

  // Don't pop a permission sheet during a background-ish app-open sync; only
  // proceed if the user already granted at least the recovery permissions.
  const granted = await getGrantedRecordTypes();
  if (granted.length === 0) return empty();

  const settings = await getSettings();
  const state = await getHealthConnectSyncState();

  const nowMs = Date.now();
  const startMs = state.lastSyncedAt > 0
    ? state.lastSyncedAt
    : nowMs - INITIAL_BACKFILL_DAYS * 86_400_000;
  const range: TimeRange = {
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(nowMs).toISOString(),
  };

  const seen = new Set(state.syncedRecordIds);
  let importedSessions = 0;
  let importedDailyLogs = 0;
  let skipped = 0;
  let newLastSyncedAt = state.lastSyncedAt;
  const newIds: string[] = [];

  const bumpHWM = (iso?: string) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (!isNaN(t) && t > newLastSyncedAt) newLastSyncedAt = t;
  };

  // --- Read everything in the window (each read is individually guarded) ---
  const [
    exercises, calories, distances, heartRates, hrvRecords, sleepRecords, restingRecords,
  ] = await Promise.all([
    readExerciseSessions(range), readActiveCalories(range), readDistance(range),
    readHeartRate(range), readHrv(range), readSleep(range), readRestingHr(range),
  ]);

  // --- Exercise sessions → Session ---
  for (const ex of exercises) {
    const id: string | undefined = ex?.metadata?.id;
    if (id && seen.has(id)) { skipped += 1; continue; }
    try {
      const session = exerciseToSession(ex, calories, distances, heartRates, settings);
      if (session) { await addSession(session); importedSessions += 1; }
      else skipped += 1;
    } catch { skipped += 1; }
    if (id) { seen.add(id); newIds.push(id); }
    bumpHWM(ex?.startTime);
  }

  // --- HRV → DailyLog.hrv (latest value per local date) ---
  for (const rec of hrvRecords) {
    const id: string | undefined = rec?.metadata?.id;
    if (id && seen.has(id)) { skipped += 1; continue; }
    const ms = numberish(rec?.heartRateVariabilityMillis);
    const when = rec?.time ?? rec?.startTime;
    if (ms != null && when) {
      await upsertDailyLog({ date: toDateString(new Date(when)), hrv: Math.round(ms) });
      importedDailyLogs += 1;
    }
    if (id) { seen.add(id); newIds.push(id); }
    bumpHWM(when);
  }

  // --- Resting HR → DailyLog.restingHr ---
  for (const rec of restingRecords) {
    const id: string | undefined = rec?.metadata?.id;
    if (id && seen.has(id)) { skipped += 1; continue; }
    const bpm = numberish(rec?.beatsPerMinute);
    const when = rec?.time ?? rec?.startTime;
    if (bpm != null && when) {
      await upsertDailyLog({ date: toDateString(new Date(when)), restingHr: Math.round(bpm) });
      importedDailyLogs += 1;
    }
    if (id) { seen.add(id); newIds.push(id); }
    bumpHWM(when);
  }

  // --- Sleep → DailyLog.sleepHours (+ derived sleepQuality from stages) ---
  for (const rec of sleepRecords) {
    const id: string | undefined = rec?.metadata?.id;
    if (id && seen.has(id)) { skipped += 1; continue; }
    const start = rec?.startTime ? Date.parse(rec.startTime) : NaN;
    const end = rec?.endTime ? Date.parse(rec.endTime) : NaN;
    if (!isNaN(start) && !isNaN(end) && end > start) {
      const hours = +(((end - start) / 3_600_000)).toFixed(2);
      const quality = deriveSleepQuality(rec.stages, end - start);
      // Garmin sleep belongs to the morning you wake → use the end (wake) date.
      await upsertDailyLog({
        date: toDateString(new Date(end)),
        sleepHours: hours,
        ...(quality != null ? { sleepQuality: quality } : {}),
      });
      importedDailyLogs += 1;
    }
    if (id) { seen.add(id); newIds.push(id); }
    bumpHWM(rec?.startTime);
  }

  await saveHealthConnectSyncState({
    syncedRecordIds: [...state.syncedRecordIds, ...newIds],
    lastSyncedAt: newLastSyncedAt,
  });

  return { importedSessions, importedDailyLogs, skipped, ranAt: new Date().toISOString() };
}

// --- Mapping ---------------------------------------------------------------

/**
 * Health Connect ExerciseSession → Session payload. Returns null for activity
 * types we don't track. Mirrors `activityToSession` in strava-sync.ts.
 */
function exerciseToSession(
  ex: any,
  calories: any[],
  distances: any[],
  heartRates: any[],
  settings: Settings,
): Omit<Session, 'id' | 'createdAt' | 'updatedAt'> | null {
  const title: string = ex?.title ?? ex?.notes ?? '';
  const type = mapHealthConnectType(ex?.exerciseType, title);
  if (!type) return null;

  const start = ex?.startTime ? Date.parse(ex.startTime) : NaN;
  const end = ex?.endTime ? Date.parse(ex.endTime) : NaN;
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const durationMinutes = Math.max(1, Math.round((end - start) / 60_000));

  const maxHr = settings.maxHeartRate ?? DEFAULT_SETTINGS.maxHeartRate!;
  const { avg, max } = heartRateStats(heartRates, start, end);
  const rpe = estimateRpe({
    durationMinutes,
    averageHeartRate: avg,
    maxHeartRateInActivity: max,
    userMaxHeartRate: maxHr,
  });
  const intensity = rpe ?? defaultIntensityForType(type);

  let subtype: string | undefined;
  if (type === 'Run') {
    subtype = inferRunSubtype({
      durationMinutes,
      averageHeartRate: avg,
      maxHeartRateInActivity: max,
      userMaxHeartRate: maxHr,
    });
  }

  // Active calories overlapping the session window (kcal).
  const activeCalories = sumOverlap(calories, start, end, kcalOf);
  // Distance overlapping the window (meters → miles) for Run / Hiking.
  const meters = sumOverlap(distances, start, end, metersOf);
  const miles = (type === 'Run' || type === 'Hiking') && meters > 0
    ? +(meters / 1609.344).toFixed(2)
    : undefined;

  const date = toDateString(new Date(start));
  const startTime = hhmm(new Date(start));
  const status: SessionStatus = 'Completed';

  return {
    date,
    startTime,
    durationMinutes,
    type,
    subtype,
    intensity,
    status,
    miles,
    activeCalories: activeCalories > 0 ? Math.round(activeCalories) : undefined,
    notes: title.trim() ? `Health Connect: ${title.trim()}` : 'Imported from Health Connect',
    loadScore: calculateLoadScore(
      { type, subtype, durationMinutes, intensity, activeCalories: activeCalories > 0 ? Math.round(activeCalories) : undefined, miles },
      settings.bodyWeightKg,
    ),
  };
}

/**
 * Health Connect numeric ExerciseType (+ title) → our SessionType.
 * Numeric codes from androidx.health.connect ExerciseSessionRecord.
 */
function mapHealthConnectType(exerciseType: unknown, title: string): SessionType | null {
  const name = (title ?? '').toLowerCase();
  // Name-based overrides first (Garmin often records BJJ as "Workout"/"Other").
  if (/\b(bjj|jiu[\s-]?jitsu|grappling|nogi|no[\s-]?gi|wrestl)\b/i.test(name)) return 'BJJ';
  if (/\b(climb|boulder|crag)\b/i.test(name)) return 'Rock Climb';
  if (/\bsauna\b/i.test(name) && /(plunge|cold)/i.test(name)) return 'Sauna + Cold Plunge';
  if (/\bsauna\b/i.test(name)) return 'Sauna';
  if (/\b(cold plunge|ice bath|cold tub)\b/i.test(name)) return 'Cold Plunge';
  if (/\b(mobility|stretch|foam roll)\b/i.test(name)) return 'Mobility / Recovery';
  if (/\bhik(e|ing)\b/i.test(name)) return 'Hiking';

  const t = typeof exerciseType === 'number' ? exerciseType : NaN;
  switch (t) {
    case 56: case 57:           return 'Run';          // RUNNING, RUNNING_TREADMILL
    case 37:                    return 'Hiking';       // HIKING
    case 70: case 78: case 13:  return 'Lift';         // STRENGTH_TRAINING, WEIGHTLIFTING, CALISTHENICS
    case 55:                    return 'Rock Climb';   // ROCK_CLIMBING
    case 44:                    return 'BJJ';          // MARTIAL_ARTS
    case 83: case 48:           return 'Mobility / Recovery'; // YOGA, PILATES
    default:                    return null;           // walking, biking, swimming, other — skip
  }
}

function defaultIntensityForType(type: SessionType): number {
  switch (type) {
    case 'BJJ': return 7;
    case 'Lift': return 6;
    case 'Run': return 5;
    case 'Rock Climb': return 6;
    case 'Hiking': return 5;
    case 'Sauna':
    case 'Cold Plunge':
    case 'Sauna + Cold Plunge': return 2;
    case 'Mobility / Recovery': return 2;
    case 'Rest': return 0;
  }
}

// --- record-shape helpers (defensive about HC quantity units) --------------

function numberish(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v && typeof v === 'object') {
    if (typeof v.inMilliseconds === 'number') return v.inMilliseconds;
    if (typeof v.value === 'number') return v.value;
  }
  return null;
}

function kcalOf(rec: any): number {
  const e = rec?.energy;
  if (typeof e?.inKilocalories === 'number') return e.inKilocalories;
  if (typeof e?.inCalories === 'number') return e.inCalories / 1000;
  if (typeof e?.inJoules === 'number') return e.inJoules / 4184;
  if (typeof rec?.energy === 'number') return rec.energy; // assume kcal
  return 0;
}

function metersOf(rec: any): number {
  const d = rec?.distance;
  if (typeof d?.inMeters === 'number') return d.inMeters;
  if (typeof d?.inKilometers === 'number') return d.inKilometers * 1000;
  if (typeof rec?.distance === 'number') return rec.distance;
  return 0;
}

/** Sum a quantity over records whose [startTime,endTime] overlaps [s,e]. */
function sumOverlap(records: any[], s: number, e: number, valueOf: (r: any) => number): number {
  let total = 0;
  for (const r of records) {
    const rs = r?.startTime ? Date.parse(r.startTime) : NaN;
    const re = r?.endTime ? Date.parse(r.endTime) : rs;
    if (isNaN(rs)) continue;
    if (re >= s && rs <= e) total += valueOf(r) || 0;
  }
  return total;
}

/** Average + max bpm from HeartRate records' samples within [s,e]. */
function heartRateStats(records: any[], s: number, e: number): { avg?: number; max?: number } {
  let sum = 0;
  let count = 0;
  let max = 0;
  for (const r of records) {
    const samples = Array.isArray(r?.samples) ? r.samples : [];
    for (const sample of samples) {
      const t = sample?.time ? Date.parse(sample.time) : NaN;
      const bpm = numberish(sample?.beatsPerMinute);
      if (isNaN(t) || bpm == null) continue;
      if (t >= s && t <= e) {
        sum += bpm; count += 1;
        if (bpm > max) max = bpm;
      }
    }
  }
  if (count === 0) return {};
  return { avg: Math.round(sum / count), max: max || undefined };
}

/**
 * Health Connect has no "sleep score", but it exposes sleep STAGES. Derive a
 * 0-100 quality estimate from stage composition — blending the share of
 * restorative sleep (deep + REM, healthy target ~45%) with sleep efficiency
 * (time asleep ÷ time in session). Returns undefined when no stage data exists
 * (so we just keep the duration). Stage codes per HC SleepSessionRecord:
 *   1 awake · 2 sleeping · 3 out-of-bed · 4 light · 5 deep · 6 REM · 7 awake-in-bed
 */
function deriveSleepQuality(stages: any, sessionMs: number): number | undefined {
  if (!Array.isArray(stages) || stages.length === 0 || sessionMs <= 0) return undefined;
  let asleepMs = 0;
  let restorativeMs = 0;
  for (const s of stages) {
    const a = s?.startTime ? Date.parse(s.startTime) : NaN;
    const b = s?.endTime ? Date.parse(s.endTime) : NaN;
    if (isNaN(a) || isNaN(b) || b <= a) continue;
    const dur = b - a;
    const stage = Math.round(numberish(s?.stage) ?? -1);
    if (stage === 2 || stage === 4 || stage === 5 || stage === 6) asleepMs += dur; // asleep
    if (stage === 5 || stage === 6) restorativeMs += dur;                          // deep + REM
  }
  if (asleepMs <= 0) return undefined;
  const efficiency = Math.min(1, asleepMs / sessionMs);
  const restorativePct = restorativeMs / asleepMs;
  const restorativeScore = Math.max(0, Math.min(100, (restorativePct / 0.45) * 100));
  const efficiencyScore = Math.max(0, Math.min(100, efficiency * 100));
  return Math.max(1, Math.min(100, Math.round(0.6 * restorativeScore + 0.4 * efficiencyScore)));
}

function hhmm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

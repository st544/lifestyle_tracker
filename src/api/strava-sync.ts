/**
 * Strava → Session sync runner. Pulls activities the user has not yet
 * imported, maps each to a `Session` (with RPE estimated from HR + duration),
 * and writes the new sessions to AsyncStorage.
 *
 * Designed to be safe to call on every TodayScreen focus: deduplicates by
 * Strava activity ID, refreshes the access token when needed, no-ops if
 * the user hasn't connected Strava yet.
 */

import {
  Session, SessionStatus, SessionType, StravaTokens, Settings, DEFAULT_SETTINGS,
  HikingDifficulty,
} from '../types';
import {
  addSession, getSettings, getStravaTokens, saveStravaTokens,
  getStravaSyncState, saveStravaSyncState,
} from '../storage';
import { toDateString } from '../dates';
import { calculateLoadScore } from '../load';
import { estimateRpe, inferRunSubtype } from '../rpe';
import {
  StravaActivity, ensureFreshTokens, listActivitiesAfter, StravaError,
} from './strava';

export interface SyncResult {
  imported: number;
  skipped: number;
  errored: number;
  /** ISO time of the run, useful to surface to the user. */
  ranAt: string;
}

/** Default initial backfill window when there is no `lastSyncedAt` yet. */
const INITIAL_BACKFILL_DAYS = 30;

/**
 * Run a Strava sync. Returns a result summary. Throws StravaError only on
 * unauthenticated / auth errors; transient activity-conversion errors are
 * counted and continued past.
 *
 * Safe to await on screen focus — short-circuits if Strava isn't configured.
 */
export async function syncStravaActivities(): Promise<SyncResult> {
  const settings = await getSettings();
  const tokens = await getStravaTokens();
  if (!tokens || !settings.stravaClientId || !settings.stravaClientSecret) {
    return { imported: 0, skipped: 0, errored: 0, ranAt: new Date().toISOString() };
  }

  // Refresh if near expiry
  let activeTokens: StravaTokens;
  try {
    activeTokens = await ensureFreshTokens(
      settings.stravaClientId,
      settings.stravaClientSecret,
      tokens,
    );
    if (activeTokens.accessToken !== tokens.accessToken) {
      await saveStravaTokens(activeTokens);
    }
  } catch (err) {
    throw err instanceof Error
      ? err
      : new StravaError('Unknown error refreshing Strava token');
  }

  const syncState = await getStravaSyncState();
  const afterUnix =
    syncState.lastSyncedAt > 0
      ? syncState.lastSyncedAt
      : Math.floor(Date.now() / 1000) - INITIAL_BACKFILL_DAYS * 86400;

  const activities = await listActivitiesAfter(activeTokens.accessToken, afterUnix);

  const seen = new Set(syncState.syncedIds);
  let imported = 0;
  let skipped = 0;
  let errored = 0;
  let newLastSyncedAt = syncState.lastSyncedAt;

  for (const act of activities) {
    if (seen.has(act.id)) { skipped += 1; continue; }
    try {
      const session = activityToSession(act, settings);
      if (!session) { skipped += 1; }
      else {
        await addSession(session);
        imported += 1;
      }
      seen.add(act.id);
      // Track high-water mark for next sync (start_date is ISO Z)
      const startUnix = Math.floor(new Date(act.start_date).getTime() / 1000);
      if (startUnix > newLastSyncedAt) newLastSyncedAt = startUnix;
    } catch {
      errored += 1;
    }
  }

  await saveStravaSyncState({
    syncedIds: Array.from(seen),
    lastSyncedAt: newLastSyncedAt,
  });

  return { imported, skipped, errored, ranAt: new Date().toISOString() };
}

// --- Activity → Session mapping --------------------------------------------

/**
 * Map a Strava activity to a Session payload. Returns `null` if the activity
 * doesn't have a sensible mapping in our session type taxonomy (e.g., swim,
 * cycling — we don't track those yet).
 */
function activityToSession(
  act: StravaActivity,
  settings: Settings,
): Omit<Session, 'id' | 'createdAt' | 'updatedAt'> | null {
  const type = mapActivityType(act);
  if (!type) return null;

  // Strava reports moving_time and elapsed_time in seconds. moving_time is
  // a closer proxy to "training time" since it excludes pauses.
  const durationMinutes = Math.max(1, Math.round(act.moving_time / 60));

  const maxHr = settings.maxHeartRate ?? DEFAULT_SETTINGS.maxHeartRate!;
  const rpe = estimateRpe({
    durationMinutes,
    averageHeartRate: act.average_heartrate,
    maxHeartRateInActivity: act.max_heartrate,
    userMaxHeartRate: maxHr,
  });
  const intensity = rpe ?? defaultIntensityForType(type);

  let subtype: string | undefined;
  if (type === 'Run') {
    subtype = inferRunSubtype({
      durationMinutes,
      averageHeartRate: act.average_heartrate,
      maxHeartRateInActivity: act.max_heartrate,
      userMaxHeartRate: maxHr,
    });
  }

  // Local date the activity started on
  const date = toDateString(parseLocalDate(act.start_date_local));
  const startTime = parseLocalTime(act.start_date_local);

  // Strava distance is meters → miles for Run AND Hiking.
  const miles = (type === 'Run' || type === 'Hiking') && act.distance > 0
    ? +(act.distance / 1609.344).toFixed(2)
    : undefined;

  // Active calories when Strava provides them (kcal). kilojoules ≈ kcal × 4.184
  // for work-based activities; fall back to that only if `calories` is absent.
  const activeCalories =
    typeof act.calories === 'number' && act.calories > 0
      ? Math.round(act.calories)
      : typeof act.kilojoules === 'number' && act.kilojoules > 0
        ? Math.round(act.kilojoules / 4.184)
        : undefined;

  // Hiking-specific context.
  let elevationGainFeet: number | undefined;
  let hikingDifficulty: HikingDifficulty | undefined;
  if (type === 'Hiking') {
    if (typeof act.total_elevation_gain === 'number' && act.total_elevation_gain > 0) {
      elevationGainFeet = Math.round(act.total_elevation_gain * 3.28084);
    }
    hikingDifficulty = inferHikingDifficulty(miles, elevationGainFeet);
  }

  const status: SessionStatus = 'Completed';
  const bodyWeightKg = settings.bodyWeightKg;
  const session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> = {
    date,
    startTime,
    durationMinutes,
    type,
    subtype,
    intensity,
    status,
    miles,
    activeCalories,
    elevationGainFeet,
    hikingDifficulty,
    notes: act.name?.trim() ? `Strava: ${act.name.trim()}` : 'Imported from Strava',
    loadScore: calculateLoadScore(
      {
        type, subtype, durationMinutes, intensity, activeCalories,
        hikingDifficulty, miles, elevationGainFeet,
      },
      bodyWeightKg,
    ),
  };
  return session;
}

/**
 * Rough hiking difficulty from elevation gain per mile. Used only when
 * importing from Strava (manual hikes set difficulty in the form).
 *   < 150 ft/mi → Easy/flat · < 350 → Moderate · < 600 → Hilly ·
 *   < 900 → Hard/steep · else Very hard/mountain.
 */
function inferHikingDifficulty(
  miles?: number,
  elevationGainFeet?: number,
): HikingDifficulty {
  if (!miles || miles <= 0 || !elevationGainFeet) return 'Moderate';
  const perMile = elevationGainFeet / miles;
  if (perMile < 150) return 'Easy / flat';
  if (perMile < 350) return 'Moderate';
  if (perMile < 600) return 'Hilly';
  if (perMile < 900) return 'Hard / steep';
  return 'Very hard / mountain';
}

/** Strava sport_type → our SessionType. Returns null if we don't map it. */
function mapActivityType(act: StravaActivity): SessionType | null {
  const name = (act.name ?? '').toLowerCase();
  // Name-based override: martial arts often recorded as "Workout" on watches
  if (/\b(bjj|jiu[\s-]?jitsu|grappling|nogi|no[\s-]?gi)\b/i.test(name)) return 'BJJ';
  if (/\b(climb|bouldering|crag)\b/i.test(name)) return 'Rock Climb';
  if (/\bsauna\b/i.test(name) && /(plunge|cold)/i.test(name)) return 'Sauna + Cold Plunge';
  if (/\bsauna\b/i.test(name)) return 'Sauna';
  if (/\b(cold plunge|ice bath|cold tub)\b/i.test(name)) return 'Cold Plunge';
  if (/\b(mobility|stretch|foam roll)\b/i.test(name)) return 'Mobility / Recovery';

  const t = (act.sport_type || act.type || '').toLowerCase();
  if (['run', 'trailrun', 'virtualrun'].includes(t)) return 'Run';
  if (['hike'].includes(t)) return 'Hiking';
  if (['weighttraining', 'workout', 'crossfit', 'kettlebell'].includes(t)) return 'Lift';
  if (['yoga', 'pilates'].includes(t)) return 'Mobility / Recovery';
  if (['rockclimbing'].includes(t)) return 'Rock Climb';
  // Unmapped: Ride, MountainBikeRide, Swim, Walk, Soccer, etc.
  return null;
}

/** Reasonable default intensity if HR was missing — picks from TYPE_DEFAULTS-ish values. */
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

/** Parse Strava's start_date_local (e.g. "2026-05-23T18:30:00Z") as LOCAL time. */
function parseLocalDate(iso: string): Date {
  // start_date_local is the activity's local wall-clock time but written with
  // a trailing 'Z'. Strip the Z so JS parses it as local rather than UTC.
  const clean = iso.endsWith('Z') ? iso.slice(0, -1) : iso;
  const [datePart, timePart = '00:00:00'] = clean.split('T');
  const [y, m, d] = datePart.split('-').map((x) => parseInt(x, 10));
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d, hh, mm, ss);
}

function parseLocalTime(iso: string): string {
  const d = parseLocalDate(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

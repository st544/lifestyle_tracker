/**
 * Thin, fully-guarded wrapper over `react-native-health-connect`.
 *
 * Health Connect is Android-only and may be unavailable (older Android without
 * the HC app installed) or permission-denied. EVERY function here:
 *   - no-ops and returns a safe empty value on iOS,
 *   - lazily requires the native module inside a try/catch so a missing module
 *     (e.g. running before the dev build is rebuilt) never crashes import,
 *   - never throws to callers for "unavailable / denied" — only the sync runner
 *     decides what to surface.
 *
 * Mirrors the role of `src/api/strava.ts` (a thin client) — the runner lives in
 * `health-connect-sync.ts`.
 */

import { Platform } from 'react-native';

// Lazy module handle. `undefined` = not yet resolved; `null` = unavailable.
let mod: any | null | undefined;
function hc(): any | null {
  if (mod !== undefined) return mod;
  if (Platform.OS !== 'android') { mod = null; return mod; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('react-native-health-connect');
  } catch {
    mod = null;
  }
  return mod;
}

/** Health Connect record types we read. */
export type HCRecordType =
  | 'HeartRateVariabilityRmssd'
  | 'SleepSession'
  | 'RestingHeartRate'
  | 'ExerciseSession'
  | 'ActiveCaloriesBurned'
  | 'Distance'
  | 'HeartRate';

/** read-access permission objects for every record type we consume. */
export const HC_READ_PERMISSIONS: { accessType: 'read'; recordType: HCRecordType }[] = [
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'HeartRate' },
];

export interface TimeRange {
  /** ISO 8601 instant. */
  startISO: string;
  endISO: string;
}

/** True only on Android with the Health Connect SDK present + available. */
export async function isAvailable(): Promise<boolean> {
  const m = hc();
  if (!m) return false;
  try {
    const status = await m.getSdkStatus();
    return status === m.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/** Initialize the client. Returns false if unavailable / failed. */
export async function ensureInitialized(): Promise<boolean> {
  const m = hc();
  if (!m) return false;
  try {
    return await m.initialize();
  } catch {
    return false;
  }
}

/**
 * Request read permissions for all record types. Returns true if at least the
 * core recovery permissions (HRV or Sleep) ended up granted.
 */
export async function requestPermissions(): Promise<boolean> {
  const m = hc();
  if (!m) return false;
  try {
    const granted = await m.requestPermission(HC_READ_PERMISSIONS);
    return Array.isArray(granted) && granted.length > 0;
  } catch {
    return false;
  }
}

/** Currently-granted read permissions (record type names). */
export async function getGrantedRecordTypes(): Promise<string[]> {
  const m = hc();
  if (!m) return [];
  try {
    const granted = await m.getGrantedPermissions();
    if (!Array.isArray(granted)) return [];
    return granted
      .filter((p: any) => p?.accessType === 'read')
      .map((p: any) => p?.recordType)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Open Health Connect so the user can grant access manually (the reliable
 * escape hatch when the in-app permission prompt is rate-limited by Android).
 * Prefers the data-management screen (lists per-app permissions); falls back to
 * the general HC settings.
 */
export async function openSettings(): Promise<void> {
  const m = hc();
  if (!m) return;
  try {
    if (typeof m.openHealthConnectDataManagement === 'function') {
      await m.openHealthConnectDataManagement();
    } else if (typeof m.openHealthConnectSettings === 'function') {
      await m.openHealthConnectSettings();
    }
  } catch {
    try {
      if (typeof m.openHealthConnectSettings === 'function') await m.openHealthConnectSettings();
    } catch { /* ignore */ }
  }
}

// --- Typed reads -----------------------------------------------------------

async function read(recordType: HCRecordType, range: TimeRange): Promise<any[]> {
  const m = hc();
  if (!m) return [];
  try {
    const res = await m.readRecords(recordType, {
      timeRangeFilter: {
        operator: 'between',
        startTime: range.startISO,
        endTime: range.endISO,
      },
    });
    // v3 returns { records, pageToken }; older shapes return the array directly.
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.records) ? res.records : [];
  } catch {
    return [];
  }
}

export const readHrv = (r: TimeRange) => read('HeartRateVariabilityRmssd', r);
export const readSleep = (r: TimeRange) => read('SleepSession', r);
export const readRestingHr = (r: TimeRange) => read('RestingHeartRate', r);
export const readExerciseSessions = (r: TimeRange) => read('ExerciseSession', r);
export const readActiveCalories = (r: TimeRange) => read('ActiveCaloriesBurned', r);
export const readDistance = (r: TimeRange) => read('Distance', r);
export const readHeartRate = (r: TimeRange) => read('HeartRate', r);

/**
 * Diagnostic: how many of each record type Health Connect actually returns over
 * the last `days`, plus the currently-granted read types. Lets the setup screen
 * tell "no permission" apart from "permission OK but Health Connect is empty".
 */
export async function countRecentRecords(days = 30): Promise<{
  granted: string[];
  hrv: number;
  sleep: number;
  exercise: number;
  restingHr: number;
}> {
  const granted = await getGrantedRecordTypes();
  const range: TimeRange = {
    startISO: new Date(Date.now() - days * 86_400_000).toISOString(),
    endISO: new Date().toISOString(),
  };
  const [hrv, sleep, exercise, restingHr] = await Promise.all([
    readHrv(range), readSleep(range), readExerciseSessions(range), readRestingHr(range),
  ]);
  return {
    granted,
    hrv: hrv.length,
    sleep: sleep.length,
    exercise: exercise.length,
    restingHr: restingHr.length,
  };
}

import { Session, SessionType, HikingDifficulty } from './types';

export interface LoadZone {
  key: 'light' | 'moderate' | 'productive' | 'high' | 'overreaching';
  label: string;
  color: string;
}

/**
 * Unified calorie/MET-equivalent training-load model.
 *
 *   activityLoad = baseEnergyEquivalent × stressMultiplier
 *
 * `baseEnergyEquivalent` is actual active calories when known; otherwise an
 * activity-specific calorie-equivalent estimate (RPE-energy for BJJ, MET ×
 * body-weight × hours for Lift / Rock Climb / Hiking fallback). We deliberately
 * do NOT use raw `RPE × duration` as the final score, and we do NOT add run /
 * hike distance or elevation directly to load — active calories already reflect
 * most of that cost, and distance/elevation are stored for display only.
 *
 * This replaces the old `durationMinutes × intensity × typeMultiplier` model.
 */

/** Fallback body weight (kg) when the user hasn't set one in Settings. */
export const DEFAULT_BODY_WEIGHT_KG = 80;

/** Shape the load calculator needs — a subset of Session. */
export interface LoadInput {
  type: SessionType;
  subtype?: string;
  durationMinutes: number;
  intensity?: number;          // RPE 0-10
  activeCalories?: number;
  // Hiking inputs (also used for the elevation bonus).
  hikingDifficulty?: HikingDifficulty;
  packWeightLbs?: number;
  elevationGainFeet?: number;
  // Distance in miles (Run + Hiking). Used by the hiking elevation bonus; NOT
  // added to load directly for either activity.
  miles?: number;
}

// --- Per-activity tables ---------------------------------------------------

/** BJJ stress multiplier by subtype (new names + legacy-name fallthrough). */
function bjjMultiplier(subtype?: string): number {
  switch (subtype) {
    case 'Technique only':
    case 'Technique':           return 1.00;
    case 'Hard sparring':
    case 'Hard Sparring':       return 1.20;
    case 'Open mat':
    case 'Open Mat':            return 1.20;
    case 'Competition class':
    case 'Competition Class':   return 1.30;
    case 'Normal class':
    case 'Normal Class':
    default:                    return 1.10;
  }
}

/** Run impact/intensity multiplier by subtype (new names + legacy fallthrough). Capped at 1.40. */
function runMultiplier(subtype?: string): number {
  switch (subtype) {
    case 'Easy / Zone 2':
    case 'Zone 2':              return 0.90;
    case 'Long easy run':
    case 'Long Run':            return 1.00;
    case 'Tempo':               return 1.10;
    case 'Intervals':           return 1.20;
    case 'Race / time trial':   return 1.30;
    case 'Trail run':           return 1.10;
    case 'Hilly run':           return 1.15;
    case 'Downhill-heavy run':  return 1.20;
    default:                    return 1.00;
  }
}

/** MET estimate for a run when active calories are unknown (by subtype). */
function runFallbackMet(subtype?: string): number {
  switch (subtype) {
    case 'Easy / Zone 2':
    case 'Zone 2':              return 8.0;
    case 'Long easy run':
    case 'Long Run':            return 8.5;
    case 'Tempo':               return 10.0;
    case 'Intervals':           return 11.0;
    case 'Race / time trial':   return 11.0;
    case 'Trail run':           return 9.0;
    case 'Hilly run':           return 9.5;
    case 'Downhill-heavy run':  return 9.0;
    default:                    return 9.0;
  }
}

/** Lift: [MET, stressMultiplier] by subtype (new names + legacy fallthrough). */
function liftMetAndMultiplier(subtype?: string): [number, number] {
  switch (subtype) {
    case 'Maintenance / easy':
    case 'Maintenance':                 return [3.5, 1.05];
    case 'Heavy upper':
    case 'Upper':                       return [5.0, 1.20];
    case 'Heavy lower':
    case 'Lower':                       return [5.5, 1.30];
    case 'Heavy full body':
    case 'Full Body':                   return [5.5, 1.25];
    case 'Circuit / conditioning lift': return [5.8, 1.10];
    case 'Kettlebell':                  return [5.5, 1.15];
    case 'Normal lift':
    case 'Lift A':
    case 'Lift B':
    default:                            return [4.5, 1.15];
  }
}

/**
 * Lifting multiplier adjustment from RPE — a distinct value per RPE point
 * (monotonic), so RPE 7≠8 and 9≠10. 6 is neutral; harder sessions add more.
 * (0 = unset → no adjustment.)
 */
function liftRpeAdjustment(rpe: number): number {
  switch (Math.round(rpe)) {
    case 10: return 0.16;
    case 9:  return 0.12;
    case 8:  return 0.08;
    case 7:  return 0.05;
    case 6:  return 0.00;
    case 5:  return -0.02;
    case 4:  return -0.05;
    case 3:  return -0.08;
    case 2:  return -0.10;
    case 1:  return -0.12;
    default: return 0; // unset / 0
  }
}

/** Rock Climb: [session-adjusted MET, stressMultiplier] by subtype. */
function climbMetAndMultiplier(subtype?: string): [number, number] {
  switch (subtype) {
    case 'Casual climbing':
    case 'Casual':                  return [3.5, 1.00];
    case 'Bouldering':              return [5.0, 1.20];
    case 'Hard bouldering':         return [5.5, 1.30];
    case 'Limit session':           return [6.0, 1.35];
    case 'Top rope / moderate':
    case 'Top Rope':
    case 'Lead':
    default:                        return [4.0, 1.05];
  }
}

/** Hiking difficulty bonus (additive component of the impact multiplier). */
function hikingDifficultyBonus(d?: HikingDifficulty): number {
  switch (d) {
    case 'Hilly':                  return 0.20;
    case 'Hard / steep':           return 0.30;
    case 'Very hard / mountain':   return 0.40;
    case 'Moderate':               return 0.10;
    case 'Easy / flat':
    default:                       return 0.00;
  }
}

/** Elevation bonus from elevation-gain-per-mile (needs distance + elevation). */
function hikingElevationBonus(miles?: number, elevationGainFeet?: number): number {
  if (!miles || miles <= 0 || !elevationGainFeet || elevationGainFeet <= 0) return 0;
  const perMile = elevationGainFeet / miles;
  if (perMile >= 750) return 0.20;
  if (perMile >= 500) return 0.15;
  if (perMile >= 250) return 0.10;
  if (perMile >= 100) return 0.05;
  return 0.00;
}

/** Duration bonus by total hike length. */
function hikingDurationBonus(durationMinutes: number): number {
  const hours = durationMinutes / 60;
  if (hours >= 6) return 0.15;
  if (hours >= 4) return 0.10;
  if (hours >= 2) return 0.05;
  return 0.00;
}

/** Pack-weight bonus. */
function hikingPackBonus(packWeightLbs?: number): number {
  const w = packWeightLbs ?? 0;
  if (w >= 25) return 0.10;
  if (w >= 10) return 0.05;
  return 0.00;
}

/**
 * Hiking structural-fatigue multiplier — additive bonuses for difficulty,
 * elevation/mile, total duration, and pack weight. Starts at 1, capped at 1.75.
 */
function hikeImpactMultiplier(s: LoadInput): number {
  const mult =
    1 +
    hikingDifficultyBonus(s.hikingDifficulty) +
    hikingElevationBonus(s.miles, s.elevationGainFeet) +
    hikingDurationBonus(s.durationMinutes) +
    hikingPackBonus(s.packWeightLbs);
  return Math.min(1.75, mult);
}

/** Conservative MET estimate for a hike when active calories are unknown. */
function hikingFallbackMet(d?: HikingDifficulty): number {
  switch (d) {
    case 'Easy / flat':            return 4.5;
    case 'Hilly':                  return 7.0;
    case 'Hard / steep':           return 8.0;
    case 'Very hard / mountain':   return 9.0;
    case 'Moderate':
    default:                       return 6.0;
  }
}

/** [MET, stressMultiplier] for the low-load recovery types. */
function recoveryMetAndMultiplier(type: SessionType): [number, number] {
  switch (type) {
    case 'Mobility / Recovery':     return [2.5, 1.00];
    case 'Sauna':                   return [1.5, 0.50];
    case 'Cold Plunge':             return [1.2, 0.30];
    case 'Sauna + Cold Plunge':     return [1.5, 0.50];
    default:                        return [1.0, 0.00];
  }
}

/**
 * Pack-weight adjustment added to the hiking difficulty multiplier:
 *   0-10 lb → +0 · 10-25 lb → +0.05 · 25+ lb → +0.10. Final multiplier capped at 1.35.
 */
function packWeightBump(packWeightLbs?: number): number {
  const w = packWeightLbs ?? 0;
  if (w >= 25) return 0.10;
  if (w >= 10) return 0.05;
  return 0;
}

// --- Core calculator -------------------------------------------------------

export function calculateLoadScore(
  s: LoadInput,
  bodyWeightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  const durationHours = s.durationMinutes / 60;
  const rpe = s.intensity ?? 0;
  const cals = typeof s.activeCalories === 'number' && s.activeCalories > 0
    ? s.activeCalories
    : undefined;
  const bw = bodyWeightKg > 0 ? bodyWeightKg : DEFAULT_BODY_WEIGHT_KG;

  switch (s.type) {
    case 'BJJ': {
      const mult = bjjMultiplier(s.subtype);
      const base = cals ?? s.durationMinutes * rpe * 0.85;
      return Math.round(base * mult);
    }
    case 'Run': {
      const mult = Math.min(1.40, runMultiplier(s.subtype));
      // Prefer active calories; otherwise estimate energy from MET × body
      // weight × hours (NOT raw RPE × minutes). Round the estimate to whole
      // calories before applying the multiplier.
      const base = cals ?? Math.round(bw * runFallbackMet(s.subtype) * durationHours);
      return Math.round(base * mult);
    }
    case 'Lift': {
      const [met, baseMult] = liftMetAndMultiplier(s.subtype);
      // Lifting rarely has a calorie reading — estimate from MET when absent.
      const base = cals ?? Math.round(bw * met * durationHours);
      const finalMult = Math.min(1.45, baseMult + liftRpeAdjustment(rpe));
      return Math.round(base * finalMult);
    }
    case 'Rock Climb': {
      const [met, mult] = climbMetAndMultiplier(s.subtype);
      const base = cals ?? bw * met * durationHours;
      return Math.round(base * mult);
    }
    case 'Hiking': {
      // Active calories are the primary base; only estimate when missing.
      const base = cals ?? Math.round(bw * hikingFallbackMet(s.hikingDifficulty) * durationHours);
      return Math.round(base * hikeImpactMultiplier(s));
    }
    case 'Rest':
      return 0;
    case 'Sauna':
    case 'Cold Plunge':
    case 'Sauna + Cold Plunge':
    case 'Mobility / Recovery':
    default: {
      const [met, mult] = recoveryMetAndMultiplier(s.type);
      const base = cals ?? bw * met * durationHours;
      return Math.round(base * mult);
    }
  }
}

export interface WeeklyLoad {
  completedLoad: number;
  plannedLoad: number;
  totalProjected: number;
  percentCompleted: number;
  percentProjected: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  byType: Partial<Record<SessionType, number>>;
  // minutes (completed only)
  workoutMinutes: number;
  recoveryMinutes: number;
  // miles (completed only)
  milesRun: number;
  milesHiked: number;
  // feet of elevation gained on hikes (completed only)
  elevationGainFeet: number;
}

const RECOVERY_TYPES: SessionType[] = [
  'Sauna',
  'Cold Plunge',
  'Sauna + Cold Plunge',
  'Mobility / Recovery',
  'Rest',
];

export function isRecoveryType(t: SessionType): boolean {
  return RECOVERY_TYPES.includes(t);
}

export function calculateWeeklyLoad(
  sessions: Session[],
  weeklyTarget: number,
  bodyWeightKg: number = DEFAULT_BODY_WEIGHT_KG,
): WeeklyLoad {
  let completedLoad = 0;
  let plannedLoad = 0;
  let sessionsCompleted = 0;
  let sessionsPlanned = 0;
  let workoutMinutes = 0;
  let recoveryMinutes = 0;
  let milesRun = 0;
  let milesHiked = 0;
  let elevationGainFeet = 0;
  const byType: Partial<Record<SessionType, number>> = {};

  for (const s of sessions) {
    const score = s.loadScore ?? calculateLoadScore(s, bodyWeightKg);
    byType[s.type] = (byType[s.type] ?? 0) + 1;
    if (s.status === 'Completed' || s.status === 'Partial') {
      completedLoad += score;
      sessionsCompleted += 1;
      if (isRecoveryType(s.type)) {
        recoveryMinutes += s.durationMinutes;
      } else {
        workoutMinutes += s.durationMinutes;
      }
      if (s.type === 'Run' && typeof s.miles === 'number') {
        milesRun += s.miles;
      }
      if (s.type === 'Hiking') {
        if (typeof s.miles === 'number') milesHiked += s.miles;
        if (typeof s.elevationGainFeet === 'number') elevationGainFeet += s.elevationGainFeet;
      }
    } else if (s.status === 'Planned') {
      plannedLoad += score;
      sessionsPlanned += 1;
    }
  }

  const totalProjected = completedLoad + plannedLoad;
  return {
    completedLoad,
    plannedLoad,
    totalProjected,
    percentCompleted: weeklyTarget > 0 ? (completedLoad / weeklyTarget) * 100 : 0,
    percentProjected: weeklyTarget > 0 ? (totalProjected / weeklyTarget) * 100 : 0,
    sessionsCompleted,
    sessionsPlanned,
    byType,
    workoutMinutes,
    recoveryMinutes,
    milesRun,
    milesHiked,
    elevationGainFeet,
  };
}

export function getLoadZone(percent: number): LoadZone {
  if (percent < 40) {
    return { key: 'light', label: 'Light week', color: '#22D3EE' };
  }
  if (percent < 70) {
    return { key: 'moderate', label: 'Moderate', color: '#34D399' };
  }
  if (percent < 90) {
    return { key: 'productive', label: 'Productive', color: '#4F8CFF' };
  }
  if (percent < 110) {
    return { key: 'high', label: 'High but acceptable', color: '#F59E0B' };
  }
  return { key: 'overreaching', label: 'Overreaching', color: '#EF4444' };
}

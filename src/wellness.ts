import { DailyLog, Session } from './types';
import { calculateWeeklyLoad } from './load';
import { weekRange, isInRange, toDateString, parseDateString } from './dates';
import { subDays } from 'date-fns';

/**
 * Composite wellness score (0-100) blending HRV, sleep, and training-load balance.
 *
 *   wellness = 0.40 * hrvScore
 *            + 0.40 * sleepScore
 *            + 0.20 * loadBalance
 *
 * Each component returns 0-100. Missing inputs simply drop that weight (we
 * renormalize across the components we DO have, so an early-day log with only
 * HRV doesn't crater your score).
 */

export interface WellnessBreakdown {
  score: number;            // 0-100 (or null if no inputs at all)
  hrv: number | null;       // 0-100
  sleep: number | null;     // 0-100
  load: number | null;      // 0-100
  hrvBaseline?: number;     // ms, rolling 14-day mean
  notes?: string;
}

const SLEEP_OPTIMAL_LOW  = 7;
const SLEEP_OPTIMAL_HIGH = 9;

/** Hours-of-sleep component (0-100). Optimal band 7-9h; drops smoothly outside. */
function sleepHoursScore(hours?: number): number | null {
  if (hours == null) return null;
  if (hours >= SLEEP_OPTIMAL_LOW && hours <= SLEEP_OPTIMAL_HIGH) return 100;
  if (hours < SLEEP_OPTIMAL_LOW) {
    // 4h → 30, 5h → 50, 6h → 75, 7h → 100
    return Math.max(0, 100 - (SLEEP_OPTIMAL_LOW - hours) * 25);
  }
  // 10h → 90, 11h → 75, 12h → 55 — over-sleep is mildly penalized
  return Math.max(0, 100 - (hours - SLEEP_OPTIMAL_HIGH) * 15);
}

/** Sleep quality component (1-100 → 0-100, identity-clamped). */
function sleepQualityScore(quality?: number): number | null {
  if (quality == null) return null;
  return Math.min(100, Math.max(0, quality));
}

/** Combined sleep score: 60% hours, 40% quality (use whichever is present). */
function sleepScore(hours?: number, quality?: number): number | null {
  const h = sleepHoursScore(hours);
  const q = sleepQualityScore(quality);
  if (h == null && q == null) return null;
  if (h == null) return q;
  if (q == null) return h;
  return 0.6 * h + 0.4 * q;
}

/**
 * HRV relative to user's rolling 14-day baseline.
 *   100 = at or above baseline
 *    50 = 25% below baseline
 *     0 = 50%+ below baseline
 * Without a baseline (first few logs) we treat raw HRV as a coarse fitness band.
 */
function hrvScore(hrv: number | undefined, baseline: number | undefined): number | null {
  if (hrv == null || hrv <= 0) return null;
  if (baseline && baseline > 0) {
    const ratio = hrv / baseline;
    // Map ratio 0.5 → 0, 1.0 → 100, ≥ 1.1 → 110-capped-to-100 (no extra credit)
    const raw = 100 * Math.max(0, Math.min(1, (ratio - 0.5) / 0.5));
    return raw;
  }
  // No baseline yet — rough mapping. 20 → 30, 50 → 75, 80+ → 95+
  return Math.max(0, Math.min(100, (hrv - 10) * 1.3));
}

/**
 * Load-balance score. Both undertraining and overreaching reduce wellness.
 * Sweet spot: 60-90% of weekly target.
 */
function loadBalanceScore(weeklyPercent: number): number {
  if (weeklyPercent <= 0) return 50; // unknown / pure rest
  if (weeklyPercent >= 60 && weeklyPercent <= 90) return 100;
  if (weeklyPercent < 60) {
    // 0% → 60, 60% → 100  (linear)
    return 60 + (weeklyPercent / 60) * 40;
  }
  if (weeklyPercent <= 110) {
    // 90 → 100, 110 → 75
    return 100 - ((weeklyPercent - 90) / 20) * 25;
  }
  // 110 → 75, 140 → 35, 170+ → ~5
  return Math.max(5, 75 - (weeklyPercent - 110) * 1.5);
}

/** Mean of the last N days' HRV values from the daily logs (excluding today). */
export function rollingHrvBaseline(logs: DailyLog[], today: string, days = 14): number | undefined {
  const cutoff = toDateString(subDays(parseDateString(today), days));
  const inWindow = logs
    .filter((l) => l.date < today && l.date >= cutoff && typeof l.hrv === 'number' && (l.hrv as number) > 0)
    .map((l) => l.hrv as number);
  if (inWindow.length === 0) return undefined;
  const sum = inWindow.reduce((a, b) => a + b, 0);
  return sum / inWindow.length;
}

/**
 * Compute wellness for `date` given the user's full session + daily-log history
 * and the active weekly target.
 */
export function calculateWellness(
  date: string,
  daily: DailyLog | undefined,
  allDailyLogs: DailyLog[],
  allSessions: Session[],
  weeklyTarget: number,
  weekStartsOn: 'monday' | 'sunday' = 'sunday'
): WellnessBreakdown {
  const baseline = rollingHrvBaseline(allDailyLogs, date);
  const h = hrvScore(daily?.hrv, baseline);
  const s = sleepScore(daily?.sleepHours, daily?.sleepQuality);

  // Load uses the week containing `date` (projected — completed + planned)
  const { startStr, endStr } = weekRange(parseDateString(date), weekStartsOn);
  const weekSessions = allSessions.filter((x) => isInRange(x.date, startStr, endStr));
  const weekly = calculateWeeklyLoad(weekSessions, weeklyTarget);
  const l = loadBalanceScore(weekly.percentProjected);

  // Weighted average with renormalization for missing components
  const weights = [
    { v: h, w: 0.4 },
    { v: s, w: 0.4 },
    { v: l, w: 0.2 },
  ];
  let weightSum = 0;
  let scoreSum = 0;
  for (const c of weights) {
    if (c.v == null) continue;
    weightSum += c.w;
    scoreSum += c.v * c.w;
  }
  const score = weightSum > 0 ? Math.round(scoreSum / weightSum) : 0;

  return { score, hrv: h, sleep: s, load: l, hrvBaseline: baseline };
}

/** Color band for a wellness score (matches Zelda palette intuition). */
export function wellnessBand(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Primed',    color: '#34D399' };
  if (score >= 70) return { label: 'Ready',     color: '#4F8CFF' };
  if (score >= 55) return { label: 'Steady',    color: '#FFD23F' };
  if (score >= 40) return { label: 'Drained',   color: '#F59E0B' };
  return                 { label: 'Recover',   color: '#EF4444' };
}

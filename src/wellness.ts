import { DailyLog, Session } from './types';
import { calculateLoadForm } from './load-form';
import { parseDateString } from './dates';
import { rollingHrvBaseline } from './hrv';

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
  // 0-100, or null when there's no recovery data (no HRV AND no sleep) — in
  // that case we deliberately do NOT fall back to a load-only score, since
  // "wellness" with no recovery signal isn't meaningful.
  score: number | null;
  hrv: number | null;       // 0-100
  sleep: number | null;     // 0-100
  load: number | null;      // 0-100
  hrvBaseline?: number;     // ms, rolling 14-day mean
  notes?: string;
}

/**
 * Hours-of-sleep component (0-100). Full 100 ONLY in the ideal 8–9h window.
 * 7→8h ramps up to it; under 7h is penalized; over 9h is mildly penalized.
 *   <7h → penalized (7→85, 6→63, 5→41, 4→19, ≤3.1→0)
 *   7–8h → ramps 85 → 100
 *   8–9h → 100
 *   ≥9h → mild over-sleep penalty (9→95, 10→80, capped ≥50)
 */
function sleepHoursScore(hours?: number): number | null {
  if (hours == null) return null;
  if (hours > 8 && hours < 9) return 100;                          // ideal window
  if (hours >= 7) {
    if (hours <= 8) return Math.round(85 + (hours - 7) * 15);      // 7→85 … 8→100
    return Math.max(50, Math.round(95 - (hours - 9) * 15));        // ≥9h over-sleep
  }
  return Math.max(0, Math.round(85 - (7 - hours) * 22));           // <7h penalty
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
 * Load-balance component derived from the **ACWR** (acute:chronic workload
 * ratio) — a more physiologically realistic "am I in a productive load zone"
 * signal than raw % of weekly target. The optimal ACWR band (0.8–1.3) scores
 * 100; being fresh/detrained is mildly reduced; overreaching/spiking is
 * penalized progressively. Returns null when there's no chronic baseline yet
 * (so the component drops out and wellness uses HRV + sleep only).
 *
 *   ratio  < 0.8        Fresh        → 75 … 100   (recovered, slightly under)
 *   ratio  0.8 – 1.3    Optimal      → 100        (productive sweet spot)
 *   ratio  1.3 – 1.5    High         → 100 … 80
 *   ratio  1.5 – 2.0    Overreaching → 80 … 40
 *   ratio  > 2.0        Spike        → ≤ 40 (floored at 10)
 */
function loadBalanceFromAcwr(ratio: number, hasBaseline: boolean): number | null {
  if (!hasBaseline || ratio <= 0) return null;
  if (ratio >= 0.8 && ratio <= 1.3) return 100;
  if (ratio < 0.8)  return Math.round(75 + (ratio / 0.8) * 25);
  if (ratio <= 1.5) return Math.round(100 - ((ratio - 1.3) / 0.2) * 20);
  if (ratio <= 2.0) return Math.round(80 - ((ratio - 1.5) / 0.5) * 40);
  return Math.max(10, Math.round(40 - (ratio - 2.0) * 30));
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

  // Load balance from the ACWR as of `date` (acute 7d : chronic 28d), the same
  // ratio shown on the This Week tab. Recovery-adjusted ratio when available.
  const form = calculateLoadForm(allSessions, allDailyLogs, parseDateString(date));
  const hasBaseline = form.band !== 'unknown' && form.chronicLoad > 0;
  const acwr = form.adjustedRatio > 0 ? form.adjustedRatio : form.ratio;
  const l = loadBalanceFromAcwr(acwr, hasBaseline);

  // Require at least one recovery signal (HRV or sleep). Without one, we don't
  // emit a score at all — load balance alone isn't "wellness", and on planned
  // future days it would otherwise read as a misleadingly high number.
  if (h == null && s == null) {
    return { score: null, hrv: h, sleep: s, load: l, hrvBaseline: baseline };
  }

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
  const score = weightSum > 0 ? Math.round(scoreSum / weightSum) : null;

  return { score, hrv: h, sleep: s, load: l, hrvBaseline: baseline };
}

/** Color band for a wellness score — neon palette (also used for calendar tint). */
export function wellnessBand(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Primed',    color: '#39FF6A' }; // neon green
  if (score >= 70) return { label: 'Ready',     color: '#2FE6FF' }; // neon cyan
  if (score >= 55) return { label: 'Steady',    color: '#FFE93D' }; // neon yellow
  if (score >= 40) return { label: 'Drained',   color: '#FF9A2E' }; // neon orange
  return                 { label: 'Recover',   color: '#FF2D6B' }; // neon pink-red
}

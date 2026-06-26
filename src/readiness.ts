/**
 * Training Readiness — a forward-looking score (0-100) for "should I train hard
 * today?". Distinct from the wellness score:
 *
 *   - Wellness  : today snapshot of recovery state (HRV/sleep/load balance).
 *   - Readiness : trend-aware, weighted heavily toward HRV + sleep, with
 *                 training load acting as a smaller modifier.
 *
 * Weighting (per user request):
 *     0.50 * hrvTrend   — biggest signal; uses 14-day baseline
 *     0.35 * sleepTrend — second; uses last 3 nights vs ideal 8h
 *     0.15 * loadBalance — small; mostly penalizes overreaching
 *
 * Missing components renormalize across whatever data IS present.
 */

import { DailyLog, Session } from './types';
import { rollingHrvBaseline } from './hrv';
import { calculateWeeklyLoad } from './load';
import {
  weekRange, isInRange, parseDateString, toDateString,
} from './dates';
import { subDays } from 'date-fns';

export interface ReadinessBreakdown {
  /** Composite 0-100. */
  score: number;
  /** Component scores (null if input missing). */
  hrv: number | null;
  sleep: number | null;
  load: number | null;
  /** Trend direction indicators for UI display ("↑", "↓", "→"). */
  hrvTrend: TrendDirection;
  sleepTrend: TrendDirection;
  loadTrend: TrendDirection;
  /** Supporting context. */
  hrvBaseline?: number;
  sleepAvg3d?: number;
  weeklyLoadPercent?: number;
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

const SLEEP_IDEAL = 8;

/**
 * HRV-trend component: compares last-night HRV to the 14-day baseline AND
 * the 3-night trend slope. A single great night above baseline ≈ 90;
 * a great night riding an upward trend can score 95+.
 */
function hrvTrendScore(
  todaysHrv: number | undefined,
  baseline: number | undefined,
  recent3: number[],
): { score: number | null; trend: TrendDirection } {
  if (!todaysHrv) return { score: null, trend: 'unknown' };
  if (!baseline || baseline <= 0) {
    // No baseline yet — coarse mapping
    const raw = Math.max(0, Math.min(100, (todaysHrv - 10) * 1.3));
    return { score: raw, trend: 'unknown' };
  }

  const ratio = todaysHrv / baseline;
  // Map 0.5 → 0, 1.0 → 85, 1.15 → 100 (cap)
  const base = Math.max(0, Math.min(100, ((ratio - 0.5) / 0.65) * 100));

  // Trend kicker from last-3 average vs baseline
  let trend: TrendDirection = 'flat';
  let trendAdj = 0;
  if (recent3.length >= 2) {
    const mean3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
    const trendRatio = mean3 / baseline;
    if (trendRatio > 1.04) { trend = 'up'; trendAdj = 5; }
    else if (trendRatio < 0.96) { trend = 'down'; trendAdj = -8; }
  }

  return { score: clamp(base + trendAdj, 0, 100), trend };
}

/**
 * Sleep-trend component: uses last 3 nights' average hours and quality.
 * One bad night isn't crushing; two in a row is.
 */
function sleepTrendScore(
  hoursSeq: number[],
  qualitySeq: number[],
): { score: number | null; trend: TrendDirection; avg3?: number } {
  if (hoursSeq.length === 0 && qualitySeq.length === 0) {
    return { score: null, trend: 'unknown' };
  }

  let hoursScore: number | null = null;
  let avg3: number | undefined;
  if (hoursSeq.length > 0) {
    const avg = hoursSeq.reduce((a, b) => a + b, 0) / hoursSeq.length;
    avg3 = avg;
    if (avg >= 7 && avg <= 9.5) hoursScore = 100;
    else if (avg < 7) hoursScore = Math.max(0, 100 - (7 - avg) * 30);
    else hoursScore = Math.max(0, 100 - (avg - 9.5) * 15);
  }

  let qualityScore: number | null = null;
  if (qualitySeq.length > 0) {
    const avgQ = qualitySeq.reduce((a, b) => a + b, 0) / qualitySeq.length;
    qualityScore = Math.min(100, Math.max(0, avgQ));
  }

  let combined: number | null;
  if (hoursScore == null) combined = qualityScore;
  else if (qualityScore == null) combined = hoursScore;
  else combined = 0.6 * hoursScore + 0.4 * qualityScore;

  // Trend: compare most recent night to the rest
  let trend: TrendDirection = 'flat';
  if (hoursSeq.length >= 2) {
    const last = hoursSeq[hoursSeq.length - 1];
    const earlier = hoursSeq.slice(0, -1).reduce((a, b) => a + b, 0) / (hoursSeq.length - 1);
    if (last - earlier > 0.5) trend = 'up';
    else if (earlier - last > 0.5) trend = 'down';
  }

  return { score: combined, trend, avg3 };
}

/** Load balance — penalizes over-reaching, slight penalty for severe under-training. */
function loadBalanceScore(weeklyPercent: number): { score: number; trend: TrendDirection } {
  if (weeklyPercent <= 0) return { score: 70, trend: 'unknown' };
  if (weeklyPercent < 40)  return { score: 75, trend: 'down' };
  if (weeklyPercent < 60)  return { score: 90, trend: 'flat' };
  if (weeklyPercent <= 90) return { score: 100, trend: 'flat' };
  if (weeklyPercent <= 110) return { score: 80, trend: 'up' };
  if (weeklyPercent <= 140) return { score: 50, trend: 'up' };
  return { score: 20, trend: 'up' };
}

/**
 * Main entry: compute readiness for `date` (defaults to today) using the user's
 * full daily-log + session history and weekly load target.
 */
export function calculateReadiness(
  date: string,
  dailyLogs: DailyLog[],
  sessions: Session[],
  weeklyTarget: number,
  weekStartsOn: 'monday' | 'sunday' = 'sunday',
): ReadinessBreakdown {
  const today = dailyLogs.find((l) => l.date === date);

  // HRV baseline + recent 3 days
  const baseline = rollingHrvBaseline(dailyLogs, date);
  const recent3Dates = [1, 2, 3].map((n) =>
    toDateString(subDays(parseDateString(date), n)),
  );
  const recent3Hrv = recent3Dates
    .map((d) => dailyLogs.find((l) => l.date === d)?.hrv)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const hrv = hrvTrendScore(today?.hrv, baseline, recent3Hrv);

  // Sleep: last 3 nights (including today's log if present)
  const last3Dates = [0, 1, 2].map((n) =>
    toDateString(subDays(parseDateString(date), n)),
  );
  const sleepHoursSeq = last3Dates
    .map((d) => dailyLogs.find((l) => l.date === d)?.sleepHours)
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .reverse(); // oldest → newest for trend calc
  const sleepQualSeq = last3Dates
    .map((d) => dailyLogs.find((l) => l.date === d)?.sleepQuality)
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .reverse();
  const sleep = sleepTrendScore(sleepHoursSeq, sleepQualSeq);

  // Load: this week's projected % of target
  const { startStr, endStr } = weekRange(parseDateString(date), weekStartsOn);
  const weekSessions = sessions.filter((s) => isInRange(s.date, startStr, endStr));
  const weekly = calculateWeeklyLoad(weekSessions, weeklyTarget);
  const load = loadBalanceScore(weekly.percentProjected);

  // Weighted composite, renormalize across present components
  const weights = [
    { v: hrv.score, w: 0.50 },
    { v: sleep.score, w: 0.35 },
    { v: load.score, w: 0.15 },
  ];
  let weightSum = 0;
  let scoreSum = 0;
  for (const c of weights) {
    if (c.v == null) continue;
    weightSum += c.w;
    scoreSum += c.v * c.w;
  }
  const score = weightSum > 0 ? Math.round(scoreSum / weightSum) : 0;

  return {
    score,
    hrv: hrv.score,
    sleep: sleep.score,
    load: load.score,
    hrvTrend: hrv.trend,
    sleepTrend: sleep.trend,
    loadTrend: load.trend,
    hrvBaseline: baseline,
    sleepAvg3d: sleep.avg3,
    weeklyLoadPercent: weekly.percentProjected,
  };
}

export function readinessBand(score: number): { label: string; color: string; verdict: string } {
  if (score >= 85) return { label: 'Primed',     color: '#34D399', verdict: 'Go hard.' };
  if (score >= 70) return { label: 'Ready',      color: '#4F8CFF', verdict: 'Solid training day.' };
  if (score >= 55) return { label: 'Caution',    color: '#FFD23F', verdict: 'Train, but keep it controlled.' };
  if (score >= 40) return { label: 'Drained',    color: '#F59E0B', verdict: 'Light or technical only.' };
  return                 { label: 'Recover',    color: '#EF4444', verdict: 'Rest or active recovery.' };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

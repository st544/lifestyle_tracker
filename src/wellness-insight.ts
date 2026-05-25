/**
 * Rule-based wellness insight generator. Local, no API call — uses the same
 * inputs already in memory on the Wellness screen. Designed for the "past 7
 * days" view: averages, trends, and a single actionable headline.
 *
 * Returns { headline, body, tone } so the UI can pick a color and pick the
 * right level of attention. The body is 1-2 short sentences with specific
 * numbers (never vague "you should rest more" platitudes).
 */

import { DailyLog } from './types';

export type InsightTone = 'good' | 'neutral' | 'caution' | 'warn';

export interface WellnessInsight {
  headline: string;
  body: string;
  tone: InsightTone;
  /** Averages for caller to surface alongside the insight if useful. */
  stats: {
    avgHrv: number | null;
    avgSleepHours: number | null;
    avgSleepQuality: number | null;
    avgWellness: number | null;
    daysLogged: number;
    hrvBaseline: number | null;
    hrvDeltaPct: number | null;   // (avgHrv / baseline - 1) * 100
    hrvTrend: TrendDir;
    sleepTrend: TrendDir;
    qualityTrend: TrendDir;
  };
}

export type TrendDir = 'up' | 'down' | 'flat' | 'unknown';

export interface WellnessInsightInput {
  /** Last 7 daily logs ending TODAY, oldest → newest. May contain undefined entries for missing days. */
  last7: (DailyLog | undefined)[];
  /** Rolling 14-day HRV baseline (excluding the 7-day window). */
  hrvBaseline: number | null;
  /** Per-day wellness scores aligned with last7 (number or null if no log). */
  wellnessScores: (number | null)[];
}

export function generateWellnessInsight(input: WellnessInsightInput): WellnessInsight {
  const { last7, hrvBaseline, wellnessScores } = input;

  const hrvVals = last7
    .map((l) => l?.hrv)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const sleepHoursVals = last7
    .map((l) => l?.sleepHours)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const sleepQualityVals = last7
    .map((l) => l?.sleepQuality)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const wellnessVals = wellnessScores.filter((v): v is number => typeof v === 'number' && v > 0);

  const daysLogged = last7.filter((l): l is DailyLog => !!l).length;

  const avgHrv = avg(hrvVals);
  const avgSleepHours = avg(sleepHoursVals);
  const avgSleepQuality = avg(sleepQualityVals);
  const avgWellness = avg(wellnessVals);

  const hrvDeltaPct =
    avgHrv != null && hrvBaseline && hrvBaseline > 0
      ? ((avgHrv / hrvBaseline) - 1) * 100
      : null;

  const hrvTrend = trendDirection(hrvVals);
  const sleepTrend = trendDirection(sleepHoursVals);
  const qualityTrend = trendDirection(sleepQualityVals);

  const stats = {
    avgHrv, avgSleepHours, avgSleepQuality, avgWellness, daysLogged,
    hrvBaseline, hrvDeltaPct, hrvTrend, sleepTrend, qualityTrend,
  };

  // --- Headline + body rules (priority order) ----------------------------

  // 0. Empty / sparse data
  if (daysLogged === 0) {
    return {
      headline: 'No data this week',
      body: 'Log HRV, sleep, and supplements daily to start seeing trends.',
      tone: 'neutral',
      stats,
    };
  }
  if (daysLogged < 3) {
    return {
      headline: 'Not enough data yet',
      body: `Only ${daysLogged} ${daysLogged === 1 ? 'day' : 'days'} logged. ` +
            `Log a few more to get a meaningful trend read.`,
      tone: 'neutral',
      stats,
    };
  }

  // 1. Severe HRV drop — top priority warning
  if (hrvDeltaPct != null && hrvDeltaPct <= -10) {
    return {
      headline: 'HRV well below baseline',
      body:
        `Avg HRV ${roundN(avgHrv!)}ms is ${absRound(hrvDeltaPct)}% under your ${roundN(hrvBaseline!)}ms baseline. ` +
        `Body is signaling load — bias toward Zone 2, sleep, and skill work for a few days.`,
      tone: 'warn',
      stats,
    };
  }

  // 2. Sustained short sleep
  if (avgSleepHours != null && avgSleepHours < 6.5) {
    return {
      headline: 'Sleep debt accumulating',
      body:
        `Averaged ${avgSleepHours.toFixed(1)}h/night this week. ` +
        `Performance and HRV will both follow if it keeps up — protect bedtime tonight.`,
      tone: 'warn',
      stats,
    };
  }

  // 3. Quality collapse
  if (avgSleepQuality != null && avgSleepQuality < 60 && qualityTrend !== 'up') {
    return {
      headline: 'Sleep quality is down',
      body:
        `Avg quality ${roundN(avgSleepQuality)}/100${qualityTrend === 'down' ? ' and trending down' : ''}. ` +
        `Look at screens-off time, alcohol, late caffeine, room temp — they all show up here first.`,
      tone: 'caution',
      stats,
    };
  }

  // 4. Mixed: HRV up but sleep short (masking)
  if (
    hrvDeltaPct != null && hrvDeltaPct > 3 &&
    avgSleepHours != null && avgSleepHours < 7
  ) {
    return {
      headline: 'Mixed signals',
      body:
        `HRV is ${absRound(hrvDeltaPct)}% above baseline (${roundN(avgHrv!)}ms) but sleep averaged only ` +
        `${avgSleepHours.toFixed(1)}h. Short sleep can mask underlying fatigue — sleep more before trusting HRV.`,
      tone: 'caution',
      stats,
    };
  }

  // 5. HRV trending down (early warning)
  if (hrvTrend === 'down' && hrvDeltaPct != null && hrvDeltaPct < -3) {
    return {
      headline: 'HRV trending down',
      body:
        `Avg ${roundN(avgHrv!)}ms vs baseline ${roundN(hrvBaseline!)}ms (${absRound(hrvDeltaPct)}% lower) and ` +
        `falling across the week. One easy day or full rest day this week would pay off.`,
      tone: 'caution',
      stats,
    };
  }

  // 6. Recovery improving (positive feedback)
  if (
    hrvTrend === 'up' && hrvDeltaPct != null && hrvDeltaPct >= 3 &&
    avgSleepHours != null && avgSleepHours >= 7
  ) {
    return {
      headline: 'Recovered and rested',
      body:
        `HRV avg ${roundN(avgHrv!)}ms (+${absRound(hrvDeltaPct)}% vs baseline) and sleep solid at ` +
        `${avgSleepHours.toFixed(1)}h. Green light for hard training this week.`,
      tone: 'good',
      stats,
    };
  }

  // 7. Solid baseline week
  if (
    hrvDeltaPct != null && hrvDeltaPct > -3 && hrvDeltaPct < 3 &&
    avgSleepHours != null && avgSleepHours >= 7
  ) {
    return {
      headline: 'Steady',
      body:
        `HRV ${roundN(avgHrv!)}ms is right around baseline, sleep ${avgSleepHours.toFixed(1)}h. ` +
        `Body in maintenance mode — train as planned.`,
      tone: 'neutral',
      stats,
    };
  }

  // 8. Default: summarize whatever we have
  return {
    headline: 'This week at a glance',
    body: assembleSummary(stats),
    tone: 'neutral',
    stats,
  };
}

// --- helpers ---------------------------------------------------------------

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function roundN(v: number): number { return Math.round(v); }
function absRound(v: number): number { return Math.abs(Math.round(v)); }

/**
 * Linear-trend direction over a small sample. Compare the first-half mean to
 * the second-half mean; small relative difference = flat.
 */
function trendDirection(values: number[]): TrendDir {
  if (values.length < 3) return 'unknown';
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(values.length - mid);
  const a = first.reduce((s, x) => s + x, 0) / first.length;
  const b = second.reduce((s, x) => s + x, 0) / second.length;
  if (a === 0) return 'unknown';
  const delta = (b - a) / a;
  if (delta > 0.04) return 'up';
  if (delta < -0.04) return 'down';
  return 'flat';
}

function assembleSummary(s: WellnessInsight['stats']): string {
  const parts: string[] = [];
  if (s.avgHrv != null && s.hrvBaseline) {
    const pct = s.hrvDeltaPct ?? 0;
    parts.push(`HRV ${roundN(s.avgHrv)}ms (${pct >= 0 ? '+' : ''}${Math.round(pct)}% vs baseline)`);
  } else if (s.avgHrv != null) {
    parts.push(`HRV ${roundN(s.avgHrv)}ms`);
  }
  if (s.avgSleepHours != null) parts.push(`sleep ${s.avgSleepHours.toFixed(1)}h`);
  if (s.avgSleepQuality != null) parts.push(`quality ${roundN(s.avgSleepQuality)}/100`);
  return parts.join(' · ') + '.';
}

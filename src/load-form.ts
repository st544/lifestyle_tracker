/**
 * Load Form — Acute:Chronic Workload Ratio (ACWR), the sport-science
 * standard for "are you doing too much vs your recent baseline?"
 *
 * We DO NOT change the per-session `loadScore` formula (that's user-spec'd):
 *   loadScore = durationMinutes × intensity × typeMultiplier
 *
 * This is a *derived* aggregate that uses the same loadScore values to
 * answer a different question:
 *
 *   acute   = sum of the last 7 days of loadScores
 *   chronic = sum of the last 28 days of loadScores, scaled to a 7-day equivalent
 *   ratio   = acute / chronic
 *
 * Why ACWR matters: research (Gabbett et al.) consistently associates
 * sudden spikes in acute load relative to chronic capacity with
 * non-contact injury risk. The "sweet spot" is ratio 0.8-1.3 — you're
 * pushing slightly above your baseline without spiking.
 *
 * Bands:
 *   < 0.8        Fresh / detrained
 *   0.8 - 1.3    Optimal — productive overload
 *   1.3 - 1.5    High — proceed with care, monitor recovery
 *   1.5 - 2.0    Overreaching — injury risk elevated
 *   > 2.0        Spike — pull back this week
 *
 * Recovery-aware modulation (forward-looking): we also expose a
 * recovery-adjusted ratio that adds 10% to the acute load when recent
 * HRV is below baseline AND sleep is short — same physical load feels
 * heavier when undercooked. This is an editorial nudge, not part of the
 * canonical ACWR; it's surfaced as `adjustedRatio`.
 */

import { Session, DailyLog } from './types';
import { parseDateString, toDateString } from './dates';
import { subDays } from 'date-fns';
import { rollingHrvBaseline } from './wellness';

export type LoadFormBand =
  | 'unknown' | 'fresh' | 'optimal' | 'high' | 'overreach' | 'spike';

export interface LoadForm {
  acuteLoad: number;        // sum, last 7 days
  chronicLoad: number;      // 28-day sum / 4 (i.e., 7-day-equivalent average)
  ratio: number;            // acute / chronic
  adjustedRatio: number;    // ratio modulated by recent HRV+sleep
  band: LoadFormBand;
  bandLabel: string;
  bandColor: string;
  verdict: string;
  recoveryPenaltyPct: number;  // how much we bumped the acute load (0-15%)
}

export function calculateLoadForm(
  sessions: Session[],
  dailyLogs: DailyLog[],
  reference: Date = new Date(),
): LoadForm {
  const refStr = toDateString(reference);

  let acute = 0;
  let chronic28 = 0;

  for (const s of sessions) {
    if (s.status !== 'Completed' && s.status !== 'Partial') continue;
    const ageDays = daysBetween(s.date, refStr);
    if (ageDays < 0) continue;             // future-dated
    const score = s.loadScore ?? 0;
    if (ageDays < 7)  acute += score;
    if (ageDays < 28) chronic28 += score;
  }
  const chronic = chronic28 / 4;

  // Recovery-aware bump: if avg HRV last 7d is < 95% of baseline AND avg sleep
  // < 7h, treat the same acute load as harder by up to +15%.
  const last7 = lastNDailyLogs(dailyLogs, refStr, 7);
  const hrvVals = last7.map((l) => l.hrv).filter(isPosNum);
  const sleepVals = last7.map((l) => l.sleepHours).filter(isPosNum);
  const baseline = rollingHrvBaseline(dailyLogs, refStr) ?? 0;
  const avgHrv = mean(hrvVals);
  const avgSleep = mean(sleepVals);
  let penalty = 0;
  if (avgHrv != null && baseline > 0 && avgHrv / baseline < 0.95) penalty += 7;
  if (avgSleep != null && avgSleep < 7) penalty += 8;
  penalty = Math.min(15, penalty);

  const adjustedAcute = acute * (1 + penalty / 100);
  const adjustedRatio = chronic > 0 ? adjustedAcute / chronic : 0;
  const ratio = chronic > 0 ? acute / chronic : 0;

  // Band classification uses the adjusted ratio when present, else raw.
  const r = chronic > 0 ? adjustedRatio : 0;
  let band: LoadFormBand;
  let bandLabel: string;
  let bandColor: string;
  let verdict: string;

  if (chronic === 0) {
    band = 'unknown';     bandLabel = 'No baseline yet'; bandColor = '#9AA4B2';
    verdict = 'Log a few weeks of sessions before this ratio is meaningful.';
  } else if (r < 0.8) {
    band = 'fresh';       bandLabel = 'Fresh';           bandColor = '#22D3EE';
    verdict = 'Below your recent baseline — room to push this week.';
  } else if (r <= 1.3) {
    band = 'optimal';     bandLabel = 'Optimal';         bandColor = '#34D399';
    verdict = 'Productive overload zone — sweet spot for adaptation.';
  } else if (r <= 1.5) {
    band = 'high';        bandLabel = 'High';            bandColor = '#FFD23F';
    verdict = 'Above-target load — watch recovery markers tomorrow.';
  } else if (r <= 2.0) {
    band = 'overreach';   bandLabel = 'Overreaching';    bandColor = '#F59E0B';
    verdict = 'Acute load is well above chronic — easy day strongly recommended.';
  } else {
    band = 'spike';       bandLabel = 'Spike';           bandColor = '#EF4444';
    verdict = 'Big jump above your baseline — pull back to reduce injury risk.';
  }

  return {
    acuteLoad: Math.round(acute),
    chronicLoad: Math.round(chronic),
    ratio,
    adjustedRatio,
    band,
    bandLabel,
    bandColor,
    verdict,
    recoveryPenaltyPct: penalty,
  };
}

// --- helpers --------------------------------------------------------------

function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = parseDateString(dateStrA).getTime();
  const b = parseDateString(dateStrB).getTime();
  return Math.round((b - a) / 86_400_000);
}

function isPosNum(v: unknown): v is number {
  return typeof v === 'number' && v > 0;
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function lastNDailyLogs(logs: DailyLog[], refStr: string, n: number): DailyLog[] {
  const refDate = parseDateString(refStr);
  const out: DailyLog[] = [];
  for (let i = 0; i < n; i++) {
    const d = toDateString(subDays(refDate, i));
    const log = logs.find((l) => l.date === d);
    if (log) out.push(log);
  }
  return out;
}

/**
 * RPE estimator from training duration + heart-rate signal.
 *
 * Inputs are the fields Strava (and most watches) actually expose on the
 * activity summary: total moving time, average HR, max HR observed in the
 * activity, and the user's personal max HR setting.
 *
 * The model:
 *   1. Compute intensity as % of personal max HR (clamped 0.4-1.0).
 *   2. Map %HRmax to a base RPE band per standard exercise physiology zones:
 *        <50% → RPE 2  (recovery)
 *        <60% → RPE 3  (very light)
 *        <70% → RPE 5  (light/moderate, "Zone 2")
 *        <80% → RPE 7  (aerobic threshold / tempo)
 *        <85% → RPE 8  (lactate threshold)
 *        <90% → RPE 9  (VO2max)
 *        ≥90% → RPE 10 (anaerobic / max effort)
 *   3. Apply a duration modifier — a 90-minute Zone 2 run feels harder than
 *      a 20-minute Zone 2 walk, even at the same %HRmax:
 *        ≥ 90 min  → +1
 *        ≥ 60 min  → +0.5
 *        < 20 min  → -0.5
 *   4. If max HR seen in the activity is very near user-max (≥ 95%), bias up
 *      by +0.5 — there was at least one hard effort even if average was low.
 *   5. Clamp to [1, 10] and round.
 *
 * Missing HR data → fall back to a reasonable default per known type (called
 * by the sync layer, not this function — `estimateRpe` returns `undefined` if
 * HR isn't usable so the caller can decide).
 */

export interface RpeInputs {
  durationMinutes: number;
  averageHeartRate?: number;
  maxHeartRateInActivity?: number;
  userMaxHeartRate: number;     // settings.maxHeartRate, default 190
}

export function estimateRpe(input: RpeInputs): number | undefined {
  const { durationMinutes, averageHeartRate, maxHeartRateInActivity, userMaxHeartRate } = input;
  if (!averageHeartRate || averageHeartRate < 50) return undefined;
  if (!userMaxHeartRate || userMaxHeartRate < 120) return undefined;

  const pctMax = clamp(averageHeartRate / userMaxHeartRate, 0.4, 1.0);

  const intensityRpe =
    pctMax < 0.50 ? 2 :
    pctMax < 0.60 ? 3 :
    pctMax < 0.70 ? 5 :
    pctMax < 0.80 ? 7 :
    pctMax < 0.85 ? 8 :
    pctMax < 0.90 ? 9 :
    10;

  const durationMod =
    durationMinutes >= 90 ? 1.0 :
    durationMinutes >= 60 ? 0.5 :
    durationMinutes < 20 ? -0.5 :
    0;

  // Peak-effort bias
  let peakBias = 0;
  if (maxHeartRateInActivity && userMaxHeartRate) {
    const peakPct = maxHeartRateInActivity / userMaxHeartRate;
    if (peakPct >= 0.95) peakBias = 0.5;
  }

  const raw = intensityRpe + durationMod + peakBias;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/**
 * Heuristic Run subtype from intensity + duration. Used when a Strava
 * `Run` activity comes in and we need to fill `subtype`.
 */
export function inferRunSubtype(
  input: RpeInputs,
): 'Zone 2' | 'Tempo' | 'Intervals' | 'Long Run' {
  const { durationMinutes, averageHeartRate, maxHeartRateInActivity, userMaxHeartRate } = input;
  if (durationMinutes >= 75) return 'Long Run';
  if (!averageHeartRate || !userMaxHeartRate) return 'Zone 2';
  const pctAvg = averageHeartRate / userMaxHeartRate;
  const pctPeak = maxHeartRateInActivity ? maxHeartRateInActivity / userMaxHeartRate : pctAvg;
  if (pctAvg < 0.72) return 'Zone 2';
  if (pctPeak >= 0.90 && pctAvg < 0.85) return 'Intervals';
  return 'Tempo';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

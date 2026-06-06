import { Session } from './types';
import { WeeklyLoad, getLoadZone } from './load';
import { subDays } from 'date-fns';
import { toDateString } from './dates';

export function generateSmartMessage(
  weekly: WeeklyLoad,
  allSessions: Session[]
): string {
  // Based on COMPLETED load (what you've actually done this week), not the
  // projected total that includes planned sessions.
  const pct = weekly.percentCompleted;
  const zone = getLoadZone(pct);

  // Two-day streak of hard training
  const yesterday = toDateString(subDays(new Date(), 1));
  const dayBefore = toDateString(subDays(new Date(), 2));
  const yesterdayHard = allSessions.some(
    (s) =>
      s.date === yesterday &&
      (s.status === 'Completed' || s.status === 'Partial') &&
      (s.intensity ?? 0) >= 7
  );
  const dayBeforeHard = allSessions.some(
    (s) =>
      s.date === dayBefore &&
      (s.status === 'Completed' || s.status === 'Partial') &&
      (s.intensity ?? 0) >= 7
  );

  if (yesterdayHard && dayBeforeHard) {
    return 'You trained hard two days in a row. Consider making today lower-intensity.';
  }

  if (pct >= 110) {
    return `Overreaching territory (${Math.round(pct)}% of target). Prioritize recovery — sauna, mobility, or rest.`;
  }
  if (pct >= 90) {
    return `High load already (${Math.round(pct)}%). Keep today technical or recovery-focused.`;
  }
  if (pct >= 70) {
    return `${zone.label} at ${Math.round(pct)}% of weekly target. Tonight is fine — avoid extra hard rounds.`;
  }
  if (pct >= 40) {
    return `Moderate week so far (${Math.round(pct)}%). Solid pace — a normal session today fits well.`;
  }
  return `Light week (${Math.round(pct)}% so far). Good day to add a lift, run, or BJJ if energy is good.`;
}

export function projectedMessage(
  currentProjectedPct: number,
  newPct: number
): { label: string; tone: 'light' | 'moderate' | 'heavy' } {
  const delta = newPct - currentProjectedPct;
  if (delta < 5) return { label: 'Light addition', tone: 'light' };
  if (delta < 15) return { label: 'Moderate addition', tone: 'moderate' };
  return { label: 'High addition', tone: 'heavy' };
}

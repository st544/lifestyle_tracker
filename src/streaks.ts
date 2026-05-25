import { Session, SessionType } from './types';
import { weekRange, toDateString } from './dates';
import { subWeeks } from 'date-fns';

/**
 * Count consecutive past weeks (including this one if met) where the user
 * completed >= `goal` sessions of `type`. Stops at first week where goal isn't met.
 *
 * If the current week hasn't yet met the goal we still count *prior* weeks —
 * we don't break the streak until a week fully passes without hitting it.
 */
export function calculateStreak(
  sessions: Session[],
  type: SessionType,
  goal: number,
  weekStartsOn: 'monday' | 'sunday' = 'sunday'
): { weeks: number; metThisWeek: boolean } {
  if (!goal || goal <= 0) return { weeks: 0, metThisWeek: false };

  const now = new Date();
  let weeks = 0;
  let metThisWeek = false;

  // Check current week
  const thisWeek = weekRange(now, weekStartsOn);
  const thisCount = countCompleted(sessions, type, thisWeek.startStr, thisWeek.endStr);
  metThisWeek = thisCount >= goal;
  if (metThisWeek) weeks += 1;

  // Walk back week-by-week
  for (let i = 1; i < 104; i++) {
    const ref = subWeeks(now, i);
    const r = weekRange(ref, weekStartsOn);
    const count = countCompleted(sessions, type, r.startStr, r.endStr);
    if (count >= goal) {
      weeks += 1;
    } else {
      break;
    }
  }

  return { weeks, metThisWeek };
}

function countCompleted(
  sessions: Session[],
  type: SessionType,
  startStr: string,
  endStr: string
): number {
  let n = 0;
  for (const s of sessions) {
    if (s.type !== type) continue;
    if (s.status !== 'Completed' && s.status !== 'Partial') continue;
    if (s.date < startStr || s.date > endStr) continue;
    n += 1;
  }
  return n;
}

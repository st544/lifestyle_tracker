import { DailyLog } from './types';
import { toDateString, parseDateString } from './dates';
import { subDays } from 'date-fns';

/**
 * Rolling HRV baseline — the mean of the last `days` of logged HRV values,
 * excluding `today`. Lives in its own module (not wellness.ts) so that both
 * `wellness.ts` and `load-form.ts` can use it without an import cycle
 * (wellness ↔ load-form).
 */
export function rollingHrvBaseline(logs: DailyLog[], today: string, days = 14): number | undefined {
  const cutoff = toDateString(subDays(parseDateString(today), days));
  const inWindow = logs
    .filter((l) => l.date < today && l.date >= cutoff && typeof l.hrv === 'number' && (l.hrv as number) > 0)
    .map((l) => l.hrv as number);
  if (inWindow.length === 0) return undefined;
  const sum = inWindow.reduce((a, b) => a + b, 0);
  return sum / inWindow.length;
}

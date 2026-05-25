import {
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  isSameDay,
  addDays,
  subDays,
} from 'date-fns';

export function toDateString(d: Date): string {
  // Local YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDateString(s: string): Date {
  // Treat as local
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export function todayString(): string {
  return toDateString(new Date());
}

export function weekRange(
  reference: Date,
  weekStartsOn: 'monday' | 'sunday' = 'monday'
): { start: Date; end: Date; startStr: string; endStr: string } {
  const start = startOfWeek(reference, { weekStartsOn: weekStartsOn === 'monday' ? 1 : 0 });
  const end = endOfWeek(reference, { weekStartsOn: weekStartsOn === 'monday' ? 1 : 0 });
  return {
    start,
    end,
    startStr: toDateString(start),
    endStr: toDateString(end),
  };
}

export function isInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

export function lastNDays(n: number, includeToday = true): string[] {
  const out: string[] = [];
  const base = new Date();
  const start = includeToday ? 0 : 1;
  for (let i = start; i < n + start; i++) {
    out.push(toDateString(subDays(base, i)));
  }
  return out;
}

export function nextNDays(n: number, includeToday = true): string[] {
  const out: string[] = [];
  const base = new Date();
  const start = includeToday ? 0 : 1;
  for (let i = start; i < n + start; i++) {
    out.push(toDateString(addDays(base, i)));
  }
  return out;
}

export function formatPretty(dateStr: string): string {
  return format(parseDateString(dateStr), 'EEE, MMM d');
}

export function formatLong(dateStr: string): string {
  return format(parseDateString(dateStr), 'EEEE, MMMM d, yyyy');
}

export function formatTime(time?: string): string {
  if (!time) return '';
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return format(d, 'h:mm a');
}

export function timeFromDate(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function parseTime(s?: string): Date {
  const d = new Date();
  if (!s) return d;
  const [hh, mm] = s.split(':').map((x) => parseInt(x, 10));
  d.setHours(hh, mm, 0, 0);
  return d;
}

export { isSameDay, parseISO, format, addDays, subDays };

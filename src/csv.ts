/**
 * Minimal CSV parser for HRV/sleep import. No external dependency — the
 * format we accept is simple enough that a 30-line parser works.
 *
 * Supported features:
 *   - Comma OR semicolon delimited (auto-detected from header line)
 *   - Optional double-quoted cells (only quotes around the cell, no embedded \n)
 *   - First non-blank line is treated as the header
 *
 * Out of scope (PRs welcome if you ever need them):
 *   - Embedded newlines in quoted cells
 *   - Escaped quotes (""")
 *   - Locale-specific decimal commas
 */

import { DailyLog, SupplementKey } from './types';

export interface ParsedRow {
  raw: Record<string, string>;
  /** YYYY-MM-DD or undefined if the date column couldn't be parsed. */
  date?: string;
  /** Mapped fields ready to upsert via `upsertDailyLog`. */
  patch?: Partial<DailyLog> & { date: string };
  /** Human-readable issue if the row was skipped. */
  error?: string;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  /** How we mapped each known field to a CSV column name. */
  mapping: ColumnMapping;
  /** Rows that produced a usable patch. */
  importable: number;
  /** Rows we couldn't parse (bad date, no recognized fields, etc.). */
  skipped: number;
}

export interface ColumnMapping {
  date?: string;
  hrv?: string;
  sleepHours?: string;
  sleepMinutes?: string;
  sleepQuality?: string;
  notes?: string;
  supplements: Partial<Record<SupplementKey, string>>;
}

const CANDIDATE_HEADERS: Record<keyof Omit<ColumnMapping, 'supplements'>, RegExp[]> = {
  date:         [/^date$/i, /^day$/i, /^timestamp$/i, /^start.?date$/i],
  hrv:          [/^hrv$/i, /^heart.?rate.?variability$/i, /^rmssd$/i, /^hrv.?ms$/i, /^overnight.?hrv$/i],
  sleepHours:   [/^sleep.?hours$/i, /^sleep.?duration.?h(ours)?$/i, /^hours.?slept$/i, /^sleep$/i, /^total.?sleep$/i],
  sleepMinutes: [/^sleep.?minutes$/i, /^sleep.?duration.?m(in(utes)?)?$/i],
  sleepQuality: [/^sleep.?quality$/i, /^quality$/i, /^sleep.?score$/i],
  notes:        [/^notes?$/i, /^comment$/i],
};

const SUPPLEMENT_PATTERNS: Record<SupplementKey, RegExp[]> = {
  creatine:     [/^creatine$/i],
  greens:       [/^greens?$/i, /^veggies?$/i, /^vegetables?$/i],
  electrolytes: [/^electrolytes?$/i, /^lyte$/i, /^salt$/i],
  protein:      [/^protein$/i, /^whey$/i],
};

function detectDelimiter(line: string): ',' | ';' | '\t' {
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs >= commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function splitCsvLine(line: string, delim: string): string[] {
  // Simple state machine that handles quoted cells like "1,234"
  const out: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === delim && !inQuote) { out.push(cell.trim()); cell = ''; continue; }
    cell += c;
  }
  out.push(cell.trim());
  return out;
}

/**
 * Try to coerce a date cell into our canonical YYYY-MM-DD local-date string.
 * Accepts: ISO (with or without time/Z), "M/D/YYYY", "D/M/YYYY", "YYYY/MM/DD".
 */
function normalizeDate(s: string): string | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;

  // YYYY-MM-DD or YYYY/MM/DD (or with time) → take first 10 chars after norm
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, '0');
    const d = iso[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // M/D/YYYY or D/M/YYYY — ambiguous; assume US M/D/YYYY by convention
  const us = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (us) {
    let [, m, d, y] = us;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Last resort — let JS parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return undefined;
}

function parseNumeric(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d.\-]/g, '');
  if (!cleaned) return undefined;
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseBool(s: string | undefined): boolean | undefined {
  if (s == null) return undefined;
  const t = s.trim().toLowerCase();
  if (!t) return undefined;
  if (['1', 'y', 'yes', 'true', 't', 'x', '✓', 'taken'].includes(t)) return true;
  if (['0', 'n', 'no', 'false', 'f', ''].includes(t)) return false;
  return undefined;
}

function buildMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { supplements: {} };
  for (const h of headers) {
    for (const [field, patterns] of Object.entries(CANDIDATE_HEADERS) as Array<[keyof Omit<ColumnMapping, 'supplements'>, RegExp[]]>) {
      if (patterns.some((re) => re.test(h)) && !mapping[field]) {
        mapping[field] = h;
        break;
      }
    }
    for (const [supp, patterns] of Object.entries(SUPPLEMENT_PATTERNS) as Array<[SupplementKey, RegExp[]]>) {
      if (patterns.some((re) => re.test(h)) && !mapping.supplements[supp]) {
        mapping.supplements[supp] = h;
        break;
      }
    }
  }
  return mapping;
}

export function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { headers: [], rows: [], mapping: { supplements: {} }, importable: 0, skipped: 0 };
  }
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim);
  const mapping = buildMapping(headers);

  const rows: ParsedRow[] = [];
  let importable = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cells[idx] ?? ''; });

    if (!mapping.date) {
      rows.push({ raw, error: 'No date column detected' });
      skipped += 1;
      continue;
    }
    const dateStr = normalizeDate(raw[mapping.date]);
    if (!dateStr) {
      rows.push({ raw, error: `Could not parse date "${raw[mapping.date]}"` });
      skipped += 1;
      continue;
    }

    const patch: Partial<DailyLog> & { date: string } = { date: dateStr, supplements: {} };

    if (mapping.hrv) {
      const v = parseNumeric(raw[mapping.hrv]);
      if (v != null && v > 0) patch.hrv = v;
    }

    // Sleep — accept either decimal hours, or split hours+minutes columns
    if (mapping.sleepHours) {
      const hVal = parseNumeric(raw[mapping.sleepHours]);
      if (hVal != null && hVal >= 0) {
        let mins = 0;
        if (mapping.sleepMinutes) {
          const mVal = parseNumeric(raw[mapping.sleepMinutes]);
          if (mVal != null && mVal >= 0) mins = mVal;
        }
        patch.sleepHours = hVal + mins / 60;
      }
    }

    if (mapping.sleepQuality) {
      let q = parseNumeric(raw[mapping.sleepQuality]);
      if (q != null) {
        // If it's clearly on a 0-10 scale (≤ 10), upgrade to 0-100
        if (q <= 10) q = q * 10;
        patch.sleepQuality = Math.max(1, Math.min(100, Math.round(q)));
      }
    }

    if (mapping.notes) {
      const n = raw[mapping.notes].trim();
      if (n) patch.notes = n;
    }

    for (const [supp, header] of Object.entries(mapping.supplements) as Array<[SupplementKey, string]>) {
      const b = parseBool(raw[header]);
      if (b !== undefined) {
        patch.supplements = patch.supplements ?? {};
        patch.supplements[supp] = b;
      }
    }

    // Sanity check — must have at least ONE field other than date
    const usable =
      patch.hrv != null ||
      patch.sleepHours != null ||
      patch.sleepQuality != null ||
      Object.values(patch.supplements ?? {}).some((v) => v !== undefined);
    if (!usable) {
      rows.push({ raw, date: dateStr, error: 'No HRV / sleep / supplement value' });
      skipped += 1;
      continue;
    }

    rows.push({ raw, date: dateStr, patch });
    importable += 1;
  }

  return { headers, rows, mapping, importable, skipped };
}

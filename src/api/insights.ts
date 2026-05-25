import { format, addDays } from 'date-fns';
import {
  DailyInsight, DailyLog, Session, Settings, SUPPLEMENTS, InsightFocus,
} from '../types';
import { lastNDays, parseDateString, toDateString, weekRange, isInRange } from '../dates';
import { calculateWeeklyLoad } from '../load';
import { calculateWellness } from '../wellness';
import { getSettings, getSessions, getDailyLogs, upsertDailyInsight, getDailyInsight } from '../storage';
import { callAnthropic, INSIGHT_MODEL, MissingApiKeyError } from './anthropic';

const SYSTEM_PROMPT = `You are a thoughtful, evidence-based training coach for an amateur athlete who trains in:
- Brazilian Jiu-Jitsu (intense, varied — sparring is high-load)
- Strength training (lifting, kettlebells)
- Running (zone 2 through intervals)
- Rock climbing
- Recovery work: sauna, cold plunge, mobility

You are given the past 14 days of:
- Training sessions (type, subtype, duration, intensity RPE 0-10, load score, status)
- Daily wellness logs (HRV in ms, sleep hours, sleep quality 1-10, supplements taken)
- Weekly training load relative to a configurable target

Your job: produce ONE specific, actionable recommendation for TOMORROW.

Guidelines:
- Be specific. "Do a 30-minute zone 2 run" beats "exercise more". "Take a full rest day" beats "rest".
- Consider load balance, recovery markers (HRV trend vs baseline, sleep debt), and patterns you see.
- If HRV is well below baseline OR sleep is poor 2+ nights running OR weekly load is >100% of target → bias toward recovery or rest.
- If weekly load is light AND wellness is good → suggest a quality session.
- If a streak pattern is obvious (e.g. always BJJ on Tuesdays, or three hard days in a row) — call it out and act on it.
- Keep the recommendation under 100 characters. Keep reasoning under 200 characters.
- The "focus" classifies the recommendation:
    "recovery"    — light/active recovery (mobility, walk, sauna)
    "training"    — substantive training session
    "rest"        — full rest day
    "maintenance" — short technical/skill session, no big load
`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    recommendation: { type: 'string', description: 'One specific action for tomorrow (≤100 chars).' },
    reasoning:      { type: 'string', description: 'Why, in 1-2 sentences (≤200 chars).' },
    focus:          { type: 'string', enum: ['recovery', 'training', 'rest', 'maintenance'] },
  },
  required: ['recommendation', 'reasoning', 'focus'],
  additionalProperties: false,
};

interface BuildContextArgs {
  sessions: Session[];
  dailyLogs: DailyLog[];
  settings: Settings;
  today: string;
}

function buildContext({ sessions, dailyLogs, settings, today }: BuildContextArgs): string {
  // Last 14 days, oldest → newest
  const days = lastNDays(14).slice().reverse();

  const dayLines: string[] = [];
  for (const d of days) {
    const log = dailyLogs.find((l) => l.date === d);
    const daysSessions = sessions
      .filter((s) => s.date === d)
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

    const parts: string[] = [];
    if (log) {
      const supplements = SUPPLEMENTS
        .filter((s) => log.supplements?.[s.key])
        .map((s) => s.label)
        .join(',') || 'none';
      const wellness = calculateWellness(
        d, log, dailyLogs, sessions, settings.defaultWeeklyTargetLoad, settings.weekStartsOn,
      );
      const bits = [];
      if (typeof log.hrv === 'number')           bits.push(`HRV ${log.hrv}`);
      if (typeof log.sleepHours === 'number')    bits.push(`sleep ${log.sleepHours}h`);
      if (typeof log.sleepQuality === 'number')  bits.push(`q${log.sleepQuality}/100`);
      bits.push(`supps:${supplements}`);
      bits.push(`wellness ${wellness.score}/100`);
      parts.push(`  daily: ${bits.join(' · ')}`);
    }
    for (const s of daysSessions) {
      const score = s.loadScore ?? 0;
      const sub = s.subtype ? ` ${s.subtype}` : '';
      const rpe = s.intensity != null ? ` RPE${s.intensity}` : '';
      const miles = s.type === 'Run' && typeof s.miles === 'number' ? ` ${s.miles}mi` : '';
      parts.push(`  session: ${s.type}${sub} ${s.durationMinutes}min${rpe}${miles} load=${score} (${s.status})`);
    }
    if (parts.length === 0) parts.push('  (no logs)');
    dayLines.push(`${d} ${format(parseDateString(d), 'EEE')}:\n${parts.join('\n')}`);
  }

  // Weekly load context: this week + previous week
  const thisWeek = weekRange(parseDateString(today), settings.weekStartsOn);
  const prevWeekRef = parseDateString(toDateString(addDays(thisWeek.start, -1)));
  const prevWeek = weekRange(prevWeekRef, settings.weekStartsOn);

  const thisWeekSessions = sessions.filter((s) => isInRange(s.date, thisWeek.startStr, thisWeek.endStr));
  const prevWeekSessions = sessions.filter((s) => isInRange(s.date, prevWeek.startStr, prevWeek.endStr));
  const thisWeekly = calculateWeeklyLoad(thisWeekSessions, settings.defaultWeeklyTargetLoad);
  const prevWeekly = calculateWeeklyLoad(prevWeekSessions, settings.defaultWeeklyTargetLoad);

  const weeklySummary = `
Weekly load (target ${settings.defaultWeeklyTargetLoad}):
  This week so far: ${thisWeekly.completedLoad} (${Math.round(thisWeekly.percentCompleted)}%), projected ${thisWeekly.totalProjected} (${Math.round(thisWeekly.percentProjected)}%)
  Last week:        ${prevWeekly.completedLoad} (${Math.round(prevWeekly.percentCompleted)}%)
  This week minutes: workout ${thisWeekly.workoutMinutes}, recovery ${thisWeekly.recoveryMinutes}
`.trim();

  const tomorrow = toDateString(addDays(parseDateString(today), 1));

  return `Past 14 days (oldest first):
${dayLines.join('\n')}

${weeklySummary}

Tomorrow: ${tomorrow} (${format(parseDateString(tomorrow), 'EEEE')})
Today: ${today} (${format(parseDateString(today), 'EEEE')})

Return ONE specific recommendation for tomorrow.`;
}

export interface GenerateInsightOptions {
  /** If true, always make a fresh API call even if a cached insight exists for the same target date. */
  force?: boolean;
  /** Override the target date (defaults to tomorrow's date). */
  targetDate?: string;
}

/**
 * Generate (or return cached) daily insight. Cached by target date — once an
 * insight exists for tomorrow, subsequent calls in the same day reuse it
 * unless `force: true`.
 */
export async function generateDailyInsight(opts: GenerateInsightOptions = {}): Promise<DailyInsight> {
  const [settings, sessions, dailyLogs] = await Promise.all([
    getSettings(), getSessions(), getDailyLogs(),
  ]);

  const today = toDateString(new Date());
  const targetDate = opts.targetDate ?? toDateString(addDays(parseDateString(today), 1));

  if (!opts.force) {
    const cached = await getDailyInsight(targetDate);
    if (cached) return cached;
  }

  const apiKey = settings.anthropicApiKey?.trim();
  if (!apiKey) throw new MissingApiKeyError();

  const userContent = buildContext({ sessions, dailyLogs, settings, today });

  const response = await callAnthropic(apiKey, {
    model: INSIGHT_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    output_config: {
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA as any },
    },
  });

  // Pull the first text block; structured-outputs JSON arrives as a text block.
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Empty response from Anthropic API');

  let parsed: { recommendation: string; reasoning: string; focus: InsightFocus };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(`Could not parse Claude response as JSON: ${textBlock.text.slice(0, 120)}…`);
  }

  const insight: DailyInsight = {
    date: targetDate,
    generatedAt: new Date().toISOString(),
    recommendation: parsed.recommendation,
    reasoning: parsed.reasoning,
    focus: parsed.focus,
    model: INSIGHT_MODEL,
  };

  await upsertDailyInsight(insight);
  return insight;
}

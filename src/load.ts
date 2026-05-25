import { Session, SessionType } from './types';

export interface LoadZone {
  key: 'light' | 'moderate' | 'productive' | 'high' | 'overreaching';
  label: string;
  color: string;
}

export function getTypeMultiplier(type: SessionType, subtype?: string): number {
  switch (type) {
    case 'BJJ':
      switch (subtype) {
        case 'Technique': return 1.0;
        case 'Hard Sparring': return 1.4;
        case 'Open Mat': return 1.3;
        case 'Competition Class': return 1.5;
        case 'Normal Class':
        default: return 1.2;
      }
    case 'Lift':
      return 1.1;
    case 'Run':
      switch (subtype) {
        case 'Zone 2': return 0.8;
        case 'Tempo': return 1.2;
        case 'Intervals': return 1.4;
        case 'Long Run': return 1.2;
        default: return 1.0;
      }
    case 'Rock Climb':
      return 0.9;
    case 'Sauna':
      return 0.3;
    case 'Cold Plunge':
      return 0.2;
    case 'Sauna + Cold Plunge':
      return 0.3;
    case 'Mobility / Recovery':
      return 0.2;
    case 'Rest':
      return 0;
    default:
      return 1.0;
  }
}

export function calculateLoadScore(session: {
  type: SessionType;
  subtype?: string;
  durationMinutes: number;
  intensity?: number;
}): number {
  const intensity = session.intensity ?? 0;
  const mult = getTypeMultiplier(session.type, session.subtype);
  return Math.round(session.durationMinutes * intensity * mult);
}

export interface WeeklyLoad {
  completedLoad: number;
  plannedLoad: number;
  totalProjected: number;
  percentCompleted: number;
  percentProjected: number;
  sessionsCompleted: number;
  sessionsPlanned: number;
  byType: Partial<Record<SessionType, number>>;
  // minutes (completed only)
  workoutMinutes: number;
  recoveryMinutes: number;
  // miles (completed only)
  milesRun: number;
}

const RECOVERY_TYPES: SessionType[] = [
  'Sauna',
  'Cold Plunge',
  'Sauna + Cold Plunge',
  'Mobility / Recovery',
  'Rest',
];

export function isRecoveryType(t: SessionType): boolean {
  return RECOVERY_TYPES.includes(t);
}

export function calculateWeeklyLoad(
  sessions: Session[],
  weeklyTarget: number
): WeeklyLoad {
  let completedLoad = 0;
  let plannedLoad = 0;
  let sessionsCompleted = 0;
  let sessionsPlanned = 0;
  let workoutMinutes = 0;
  let recoveryMinutes = 0;
  let milesRun = 0;
  const byType: Partial<Record<SessionType, number>> = {};

  for (const s of sessions) {
    const score = s.loadScore ?? calculateLoadScore(s);
    byType[s.type] = (byType[s.type] ?? 0) + 1;
    if (s.status === 'Completed' || s.status === 'Partial') {
      completedLoad += score;
      sessionsCompleted += 1;
      if (isRecoveryType(s.type)) {
        recoveryMinutes += s.durationMinutes;
      } else {
        workoutMinutes += s.durationMinutes;
      }
      if (s.type === 'Run' && typeof s.miles === 'number') {
        milesRun += s.miles;
      }
    } else if (s.status === 'Planned') {
      plannedLoad += score;
      sessionsPlanned += 1;
    }
  }

  const totalProjected = completedLoad + plannedLoad;
  return {
    completedLoad,
    plannedLoad,
    totalProjected,
    percentCompleted: weeklyTarget > 0 ? (completedLoad / weeklyTarget) * 100 : 0,
    percentProjected: weeklyTarget > 0 ? (totalProjected / weeklyTarget) * 100 : 0,
    sessionsCompleted,
    sessionsPlanned,
    byType,
    workoutMinutes,
    recoveryMinutes,
    milesRun,
  };
}

export function getLoadZone(percent: number): LoadZone {
  if (percent < 40) {
    return { key: 'light', label: 'Light week', color: '#22D3EE' };
  }
  if (percent < 70) {
    return { key: 'moderate', label: 'Moderate', color: '#34D399' };
  }
  if (percent < 90) {
    return { key: 'productive', label: 'Productive', color: '#4F8CFF' };
  }
  if (percent < 110) {
    return { key: 'high', label: 'High but acceptable', color: '#F59E0B' };
  }
  return { key: 'overreaching', label: 'Overreaching', color: '#EF4444' };
}

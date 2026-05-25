import { SessionType } from './types';

export interface TypeDefault {
  durationMinutes: number;
  intensity: number;
  subtypes: string[];
  locations?: string[];
}

export const TYPE_DEFAULTS: Record<SessionType, TypeDefault> = {
  BJJ: {
    durationMinutes: 90,
    intensity: 7,
    subtypes: ['Normal Class', 'Technique', 'Hard Sparring', 'Open Mat', 'Competition Class'],
    locations: ['Princeton BJJ', 'Logic', 'Other'],
  },
  Lift: {
    durationMinutes: 45,
    intensity: 6,
    subtypes: ['Lift A', 'Lift B', 'Upper', 'Lower', 'Full Body', 'Kettlebell', 'Maintenance'],
  },
  Run: {
    durationMinutes: 30,
    intensity: 5,
    subtypes: ['Zone 2', 'Tempo', 'Intervals', 'Long Run'],
  },
  'Rock Climb': {
    durationMinutes: 90,
    intensity: 6,
    subtypes: ['Bouldering', 'Top Rope', 'Lead', 'Casual'],
  },
  Sauna: {
    durationMinutes: 20,
    intensity: 2,
    subtypes: [],
  },
  'Cold Plunge': {
    durationMinutes: 6,
    intensity: 2,
    subtypes: [],
  },
  'Sauna + Cold Plunge': {
    durationMinutes: 60,
    intensity: 3,
    subtypes: [],
  },
  'Mobility / Recovery': {
    durationMinutes: 20,
    intensity: 2,
    subtypes: ['Stretch', 'Yoga', 'Foam Roll'],
  },
  Rest: {
    durationMinutes: 0,
    intensity: 0,
    subtypes: ['Scheduled Rest', 'Sleep Debt', 'Sick', 'Travel', 'Busy', 'Sore'],
  },
};

// Quick-add buttons order
export const QUICK_ADD_TYPES: SessionType[] = [
  'BJJ',
  'Lift',
  'Run',
  'Rock Climb',
  'Mobility / Recovery',
  'Sauna',
  'Cold Plunge',
  'Rest',
];

export const ALL_TYPES: SessionType[] = [
  'BJJ',
  'Lift',
  'Run',
  'Rock Climb',
  'Sauna',
  'Cold Plunge',
  'Sauna + Cold Plunge',
  'Mobility / Recovery',
  'Rest',
];

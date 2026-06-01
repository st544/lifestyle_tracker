import { SessionType, HikingDifficulty } from './types';

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
    subtypes: ['Normal class', 'Technique only', 'Hard sparring', 'Open mat', 'Competition class'],
    locations: ['Princeton BJJ', 'Logic', 'Other'],
  },
  Lift: {
    durationMinutes: 45,
    intensity: 6,
    subtypes: [
      'Normal lift', 'Maintenance / easy', 'Heavy upper', 'Heavy lower',
      'Heavy full body', 'Circuit / conditioning lift', 'Kettlebell',
    ],
  },
  Run: {
    durationMinutes: 30,
    intensity: 5,
    subtypes: [
      'Easy / Zone 2', 'Long easy run', 'Tempo', 'Intervals', 'Race / time trial',
      'Trail run', 'Hilly run', 'Downhill-heavy run',
    ],
  },
  'Rock Climb': {
    durationMinutes: 90,
    intensity: 6,
    subtypes: ['Casual climbing', 'Top rope / moderate', 'Bouldering', 'Hard bouldering', 'Limit session'],
  },
  Hiking: {
    durationMinutes: 120,
    intensity: 5,
    // Hiking uses `hikingDifficulty` (see HIKING_DIFFICULTIES) rather than a
    // free-text subtype, so the subtype chip row is empty for hikes.
    subtypes: [],
    locations: ['Local trail', 'State park', 'Other'],
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

/** Difficulty options shown for Hiking (drive the load multiplier). */
export const HIKING_DIFFICULTIES: HikingDifficulty[] = [
  'Easy / flat',
  'Moderate',
  'Hilly',
  'Hard / steep',
  'Very hard / mountain',
];

export const DEFAULT_HIKING_DIFFICULTY: HikingDifficulty = 'Moderate';

// Quick-add buttons order
export const QUICK_ADD_TYPES: SessionType[] = [
  'BJJ',
  'Lift',
  'Run',
  'Rock Climb',
  'Hiking',
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
  'Hiking',
  'Sauna',
  'Cold Plunge',
  'Sauna + Cold Plunge',
  'Mobility / Recovery',
  'Rest',
];

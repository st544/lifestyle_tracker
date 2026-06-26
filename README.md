# Training Calendar

A mobile-first, Expo Go–compatible training calendar built with React Native + TypeScript. Plan and log BJJ, lifts, runs, climbing, hiking, sauna, cold plunge, and rest — and see your weekly training load at a glance.

No backend. No accounts. Everything is persisted locally with AsyncStorage. Includes a lightweight calorie/macro tracker (USDA FoodData Central search + reusable recipes) to complement the calories you burn training.

Training load uses a unified **calorie/MET-equivalent** model (`loadScore = baseEnergyEquivalent × stressMultiplier`) — active calories when your watch provides them, activity-specific estimates otherwise. See [CLAUDE_HIKING_LOAD_PROMPT.md](./CLAUDE_HIKING_LOAD_PROMPT.md) for the full spec.

---

## 1. Run it on your phone (Expo Go)

Requirements:
- Node 18+ and npm
- Expo Go installed on your phone (App Store / Play Store)
- Phone and computer on the same Wi-Fi

```bash
# from the project root (this folder)
npm install
npx expo start
```

When Metro starts, scan the QR code with Expo Go (Android) or the iOS Camera (iOS).

If the version-compatibility doctor complains about pinned versions, align them with:

```bash
npx expo install --fix
```

That's it — no native build needed.

---

## 2. Project plan / what's included

Four primary tabs, plus a few modal screens:

| Screen        | What you do there                                                  |
|---------------|--------------------------------------------------------------------|
| Today         | Hero date, smart message, weekly load bar, quick-add, today's list |
| Calendar      | Month view with colored dots per session type; tap a day → detail  |
| Add           | Big tiles per type, "Plan a session", and saved templates          |
| This Week     | Completed vs planned load, counts by type, full week's sessions    |
| Day Detail    | All sessions for one day; planned → completed / skip / move / edit |
| Add Session   | One-screen form with activity-specific fields (RPE, distance, calories, hiking difficulty/elevation/pack, etc.) + live load preview |
| Backfill Week | Last 7 days, one tap = one default session (catch up fast)         |
| Nutrition     | Daily calorie/macro log via USDA food search + reusable recipes (Food button on Today) |

Design principles baked in:
- Most sessions log in under 30 seconds via quick-add or templates.
- Planned sessions are **updated** to Completed (no duplicates).
- Live load preview while editing: shows this session's load score and what the week becomes.
- All required fields stay required (date, type, duration, status); everything else optional.

---

## 3. File / folder structure

```
.
├── App.tsx                       # Navigation root (tabs + modal stack)
├── app.json                      # Expo config
├── babel.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── types.ts                  # Session, Template, Settings, enums
    ├── theme.ts                  # Colors, typeColors, typeIcons, spacing, radius
    ├── defaults.ts               # Per-type defaults (duration, RPE, subtypes, locations)
    ├── dates.ts                  # date-fns helpers: weekRange, todayString, formatters
    ├── load.ts                   # calculateLoadScore, calculateWeeklyLoad, getLoadZone
    ├── messages.ts               # generateSmartMessage, projectedMessage
    ├── storage.ts                # AsyncStorage CRUD + seed templates
    ├── navigation.ts             # Param-list types for navigators
    ├── components/
    │   ├── Pill.tsx              # Chip-style selectable pill
    │   ├── LoadBar.tsx           # Completed + projected bar with target marker
    │   ├── QuickAddBar.tsx       # Horizontal scroll of quick-add buttons
    │   ├── SessionCard.tsx       # Session row (color bar, meta, status)
    │   └── Section.tsx           # Section + Card layout primitives
    └── screens/
        ├── TodayScreen.tsx
        ├── CalendarScreen.tsx
        ├── DayDetailScreen.tsx
        ├── AddTabScreen.tsx
        ├── AddSessionScreen.tsx
        ├── WeekScreen.tsx
        └── BackfillScreen.tsx
```

---

## 4. Data types

See `src/types.ts`. Summary:

```ts
type SessionType =
  | 'BJJ' | 'Lift' | 'Run' | 'Rock Climb' | 'Hiking'
  | 'Sauna' | 'Cold Plunge' | 'Sauna + Cold Plunge'
  | 'Rest' | 'Mobility / Recovery';

type SessionStatus = 'Planned' | 'Completed' | 'Skipped' | 'Moved' | 'Partial';

interface Session {
  id: string;
  date: string;            // YYYY-MM-DD (local)  REQUIRED
  type: SessionType;       //                     REQUIRED
  durationMinutes: number; //                     REQUIRED
  status: SessionStatus;   //                     REQUIRED

  startTime?: string;      // HH:mm
  endTime?: string;
  subtype?: string;
  intensity?: number;      // 0–10 (RPE)
  location?: string;
  notes?: string;
  loadScore?: number;
  saunaMinutes?: number;
  coldPlungeMinutes?: number;
  miles?: number;              // distance — Run AND Hiking
  activeCalories?: number;     // preferred load base when known
  elevationGainFeet?: number;  // Hiking
  hikingDifficulty?: HikingDifficulty;
  packWeightLbs?: number;      // Hiking
  trailName?: string;          // Hiking

  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: string; name: string; type: SessionType;
  subtype?: string; durationMinutes: number; intensity?: number;
  location?: string; startTime?: string; notes?: string; createdAt: string;
}

interface Settings {
  defaultWeeklyTargetLoad: number;
  weekStartsOn: 'monday' | 'sunday';
  bodyWeightKg?: number;   // MET-based calorie fallbacks (default 80)
  // …plus goals, heart-rate bounds, Strava creds, Anthropic key
}
```

---

## 5. Load calculation

`src/load.ts` implements a unified **calorie/MET-equivalent** model (the old `duration × intensity × typeMultiplier` model has been replaced):

```
loadScore = baseEnergyEquivalent × stressMultiplier
```

`baseEnergyEquivalent` is actual **active calories** when known (`session.activeCalories`). When not known, it's an activity-specific calorie-equivalent estimate (`round(bodyWeightKg × MET × hours)` for Run/Lift/Climb/Hiking; `duration × RPE × 0.85` for BJJ). `calculateLoadScore(input, bodyWeightKg?)` takes the user's body weight (`Settings.bodyWeightKg`, default 80) for the MET fallbacks. Distance, pace, and elevation are stored/displayed as context only — never added directly to load.

Multipliers (per subtype/difficulty):

| Activity | Multiplier |
|---|---|
| BJJ | Technique only 1.00 · Normal class 1.10 · Hard sparring 1.20 · Open mat 1.20 · Competition class 1.30 |
| **Run** (cap 1.40) | Easy/Zone 2 0.90 · Long easy run 1.00 · Tempo 1.10 · Intervals 1.20 · Race/time trial 1.30 · Trail run 1.10 · Hilly run 1.15 · Downhill-heavy run 1.20 |
| **Lift** (cap 1.45) | base by type (Maintenance/easy 1.05 · Normal 1.15 · Heavy upper 1.20 · Heavy lower 1.30 · Heavy full body 1.25 · Circuit 1.10 · Kettlebell 1.15) **+ per-RPE adj** (1 −0.12 … 6 0 · 7 +0.05 · 8 +0.08 · 9 +0.12 · 10 +0.16) |
| Rock Climb | Casual 1.00 · Top rope/moderate 1.05 · Bouldering 1.20 · Hard bouldering 1.30 · Limit 1.35 |
| **Hiking** (cap 1.75) | `1 + difficultyBonus + elevationBonus + durationBonus + packBonus` — difficulty (flat 0 → mountain 0.40), elevation/mile (<100 ft/mi 0 → >750 0.20), duration (<2h 0 → 6h+ 0.15), pack (0–10 lb 0 → 25+ 0.10) |
| Recovery | Sauna/Sauna+Cold 0.50 · Cold Plunge 0.30 · Mobility 1.00 · Rest 0 |

Legacy subtype names (`Normal Class`, `Zone 2`, `Long Run`, `Top Rope`, …) still map correctly so older stored sessions keep calculating.

Required session fields remain `date`, `type`, `durationMinutes`, and `status`. Everything else stays optional and activity-specific so quick entry remains fast.

Weekly target defaults to **4000** (you may want to re-tune it in Goals now that the load scale changed). Zones:

| Percent of target | Zone                  |
|-------------------|-----------------------|
| 0–40%             | Light week            |
| 40–70%            | Moderate              |
| 70–90%            | Productive            |
| 90–110%           | High but acceptable   |
| 110%+             | Overreaching          |

`calculateWeeklyLoad(sessions, target)` returns `{ completedLoad, plannedLoad, totalProjected, percentCompleted, percentProjected, sessionsCompleted, sessionsPlanned, byType }`.

---

## 6. Persistence (AsyncStorage)

`src/storage.ts` exports the helpers you spec'd:

- `getSessions()`, `saveSessions(arr)`
- `addSession(input)`, `updateSession(id, patch)`, `deleteSession(id)`
- `getSessionsForDate(date)`, `getSessionsForWeek(reference)`
- `calculateProjectedWeeklyLoad(reference)`
- `getTemplates()`, `addTemplate(input)`, `deleteTemplate(id)`
- `getSettings()`, `saveSettings(s)`
- `seedDefaultsIfEmpty()` — drops in Princeton BJJ Tuesday / Logic BJJ / Morning Lift / Zone 2 Run / Sauna + Cold Plunge on first run

Keys used:
- `training_sessions`
- `training_templates`
- `training_settings`

`updateSession` automatically recomputes `loadScore` (using `Settings.bodyWeightKg`) when any load-relevant field changes — type / subtype / duration / intensity / activeCalories / hikingDifficulty / packWeightLbs — so the load is always consistent.

---

## 7. Useful interactions

- **Quick-add** (Today, Day Detail, Backfill, Add tab) — one tap creates a session with that type's defaults pre-filled.
- **Planned → Completed** — on Today, planned sessions show "Mark completed" inline. In Day Detail, long-press / tap a planned session for Mark Completed / Edit / Skip / Move / Delete. The original record is updated; no duplicate is created.
- **Calendar tap-to-add** — tap any day → Day Detail → quick-add or custom.
- **Backfill mode** — `Today → Backfill` button → last 7 days each with quick-add buttons.
- **Save as template** — from any session edit screen (iOS will prompt for a name; Android will get a future "Templates" screen).
- **Live load preview** — the Add Session form recomputes load + projected weekly % as you change duration / intensity / type.

---

## 8. Customization knobs

- **Weekly target**: change `defaultWeeklyTargetLoad` in `src/types.ts` (`DEFAULT_SETTINGS`) or persist via `saveSettings`.
- **Defaults per type**: `src/defaults.ts` (`TYPE_DEFAULTS`).
- **Colors**: `src/theme.ts` (`typeColors`, `colors`).
- **Smart messages**: `src/messages.ts` (`generateSmartMessage`).
- **Multipliers / zones**: `src/load.ts` (`getTypeMultiplier`, `getLoadZone`).

---

## 9. Common questions the app answers

- *What did I train this week?* → Week tab → "Completed".
- *What am I planning?* → Week tab → "Planned"; Today tab → "Planned today".
- *How much load am I under?* → Today + Week, with bar + zone.
- *Is another session reasonable?* → Add Session shows "X% projected · Light/Moderate/High addition" live as you tweak.
- *Which days did I do BJJ/Lift/Run/Climb/Sauna/Plunge?* → Calendar tab, colored dots; tap a day for detail.

---

## 10. Next steps you might want later

- Migrate AsyncStorage → SQLite via `expo-sqlite` if the dataset grows beyond a few hundred sessions.
- Settings screen for editing weekly target and `weekStartsOn`.
- Drag-and-drop a planned session to a different day on the calendar.
- Optional Supabase sync (out of scope for v1, but the storage layer is a thin abstraction).

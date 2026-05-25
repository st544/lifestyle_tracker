# CONTEXT.md

> **Read this first.** It's the cheat sheet for any future Claude session picking up this codebase. Pair it with DESIGN.md (style/animation principles) and ROADMAP.md (what's planned).

## What this app is

A **lightweight training calendar** for one user (the owner of this repo). It tracks BJJ, lifts, runs, climbing, sauna, cold plunge, mobility, and rest days. It is not a generic habit tracker, not a Garmin replacement, not a life OS. The success metric is "can I log a session in under 30 seconds while walking off the mat?"

Primary user journey:
1. Open app → see today + the smart message.
2. Tap a quick-add button or open a planned session.
3. See weekly load update.
4. Occasionally browse Calendar / Week / Trends for context.

## Stack

- **Expo SDK 54** (Expo Go, no custom dev build)
- **React Native 0.81.x**, React 19.1
- **TypeScript** strict mode
- **React Navigation v7** (bottom tabs + native stack)
- **AsyncStorage** as the only persistence layer (no backend, no auth, no Supabase)
- **react-native-reanimated v4** for all animation work, paired with **`react-native-worklets`** as a required peer dep (see "Critical setup facts" — both must be installed together or the app crashes at startup)
- **react-native-svg** for charts, triforce shapes, particles
- **expo-haptics**, **expo-linear-gradient** for feel
- **react-native-calendars** for the month view
- **date-fns** for date math


## Folder layout

```
.
├── App.tsx                    # GestureHandlerRootView → SafeAreaProvider → NavigationContainer → tabs + stack
├── index.ts                   # registerRootComponent(App) — SDK 53+ entry
├── babel.config.js            # MUST include 'react-native-reanimated/plugin' LAST
├── package.json               # main: "index.ts"; SDK 54 versions
├── app.json                   # newArchEnabled: true
├── tsconfig.json
├── CONTEXT.md  DESIGN.md  ROADMAP.md  README.md
└── src/
    ├── types.ts               # Session, Template, Settings, DailyLog, WeeklyChecklist, DailyInsight, SUPPLEMENTS
    ├── theme.ts               # colors, typeColors, typeIcons, zelda palette, rupeePalette
    ├── defaults.ts            # TYPE_DEFAULTS, QUICK_ADD_TYPES, ALL_TYPES
    ├── dates.ts               # weekRange, toDateString, formatTime, etc.
    ├── load.ts                # calculateLoadScore, calculateWeeklyLoad, getLoadZone, isRecoveryType
    ├── streaks.ts             # calculateStreak (consecutive weeks hitting a per-type goal)
    ├── wellness.ts            # calculateWellness, rollingHrvBaseline, wellnessBand — composite 0-100 from HRV/sleep/load
    ├── readiness.ts           # calculateReadiness, readinessBand — forward-looking 0-100 weighted 50/35/15 toward HRV/sleep/load
    ├── rpe.ts                 # estimateRpe, inferRunSubtype — RPE from duration + avg/max HR vs user's max HR setting
    ├── csv.ts                 # parseCsv — column auto-detection + row coercion for HRV/sleep/supplement import
    ├── wellness-insight.ts    # generateWellnessInsight — rule-based 7-day analysis (headline + body + tone, no API call)
    ├── load-form.ts           # calculateLoadForm — ACWR (acute:chronic workload ratio) with HRV/sleep-aware recovery penalty
    ├── messages.ts            # generateSmartMessage, projectedMessage
    ├── storage.ts             # all AsyncStorage CRUD: sessions, templates, settings, dailyLogs, weeklyChecklists, dailyInsights, last-seen
    ├── haptics.ts             # tap/tick/thunk/success/warn/error (wraps expo-haptics)
    ├── sounds.ts              # STUB — no-op until user drops audio files into assets/sounds/
    ├── navigation.ts          # RootStackParamList, TabsParamList
    ├── api/
    │   ├── anthropic.ts       # callAnthropic (fetch-based; no SDK), INSIGHT_MODEL constant
    │   ├── insights.ts        # generateDailyInsight — builds 14-day prompt, calls Claude w/ structured outputs, caches by target date
    │   ├── strava.ts          # Strava OAuth + activity list (fetch-based; manual-paste auth flow)
    │   └── strava-sync.ts     # syncStravaActivities — pulls new activities, dedupes, maps to Session via RPE estimator
    ├── components/
    │   ├── Section.tsx        # Section header + Card container
    │   ├── Pill.tsx           # Animated chip with press scale + haptic
    │   ├── LoadBar.tsx        # Animated dual-fill bar (completed + projected) with zone-flash
    │   ├── QuickAddBar.tsx    # Horizontal scroll of animated quick-add buttons
    │   ├── SessionCard.tsx    # Animated session row with press scale
    │   ├── BarChart.tsx       # SVG bar chart (Trends screen) with target line
    │   ├── AnimatedNumber.tsx # TextInput-as-animated-text trick (reanimated v4)
    │   ├── TriforceBurst.tsx  # Particle burst — triforces, rupees, sparks
    │   ├── TriforceIcon.tsx   # Static 3-triangle Triforce SVG
    │   ├── CelebrationOverlay.tsx # Modal "ACHIEVEMENT UNLOCKED" with triforce + burst
    │   ├── SaveCheckmark.tsx  # SVG-stroke-drawn check inside a pulsing ring
    │   ├── TypewriterText.tsx # Char-by-char text reveal (JS setInterval, fine for short strings)
    │   ├── FadeInView.tsx     # Reanimated fade + slide-up with optional spring
    │   ├── AnimatedTabIcon.tsx# Bounces on tab focus
    │   ├── WellnessRing.tsx   # Circular SVG gauge for wellness score with animated draw + count-up
    │   ├── SupplementsRow.tsx # 4 toggle buttons: creatine / greens / electrolytes / protein
    │   ├── DailyLogRow.tsx    # Inline daily-log row on Today (HRV / sleep / supplements / wellness ring)
    │   ├── DailyInsightCard.tsx  # Gold-trimmed card showing Claude's recommendation for tomorrow (sparkles icon, not Triforce)
    │   ├── TrainingReadinessCard.tsx # Front-page card: ring + HRV/Sleep/Load lines with trend arrows + verdict
    │   ├── DurationInput.tsx  # Side-by-side hours + minutes inputs; stores decimal hours
    │   ├── PulseNumber.tsx    # Static text that pulses (scale 1→1.18→1) on value change. NO count-up — replaces AnimatedNumber for stat counts
    │   └── LineChart.tsx      # Multi-series SVG line chart with tap-to-show tooltip, dual y-axis overlay, null-tolerant gaps
    └── screens/
        ├── TodayScreen.tsx        # hero count-up, typewriter, gradient hero, DailyLogRow, DailyInsightCard, staggered cards, pull-to-refresh burst
        ├── CalendarScreen.tsx     # month view, streak chips with ignition, milestone overlay (4/12/26/52 weeks)
        ├── DayDetailScreen.tsx    # tap a day → quick-add + per-session actions (mark complete / skip / move / delete)
        ├── AddTabScreen.tsx       # tiles per type, "Plan a session", templates list
        ├── AddSessionScreen.tsx   # one-screen form with live load preview, save morphs into checkmark + triforce burst
        ├── WeekScreen.tsx         # totals, animated LoadBar, meal-prep checkbox, workout/recovery/miles, counts by type — week navigator (chevrons + "back to current week" chip) lets you scroll through past weeks
        ├── TrendsScreen.tsx       # 4/8/12/26-week bar charts: load, sessions, minutes, miles, per-activity
        ├── BackfillScreen.tsx     # last 7 days with one-tap quick-add per type
        ├── GoalsScreen.tsx        # per-activity weekly minimums, weekly load target, week-starts-on, max/resting HR, Strava button, Anthropic API key
        ├── DailyLogScreen.tsx     # Full modal for HRV / sleep / supplements / notes — supports past dates via the date picker
        ├── StravaSetupScreen.tsx  # One-time Strava OAuth setup (manual-paste flow), shows connection status, sync-now / disconnect
        ├── CsvImportScreen.tsx    # Pick a CSV file OR paste text → auto-detect columns → preview → bulk upsert daily logs
        ├── WellnessScreen.tsx     # 7-day HRV / sleep duration / sleep quality charts + rule-based wellness insight (headline+body)
        └── ReadinessScreen.tsx    # Tap-to-open from TrainingReadinessCard. Line graph of readiness over time (14/30/60/90d) + day list to drill in
```

## Critical setup facts

- **Babel plugin: `react-native-worklets/plugin`** must be the **last** entry in `plugins`. NOT `react-native-reanimated/plugin` — that's the v3 path; in v4 the worklets babel plugin lives in the `react-native-worklets` package. If animations stop working on a fresh install, this is the first thing to check.
- **`main` in package.json must be `"index.ts"`**, not `node_modules/expo/AppEntry.js` (removed in SDK 53+). `index.ts` calls `registerRootComponent(App)`.
- **`GestureHandlerRootView`** wraps everything in App.tsx. Required for reanimated + gesture-handler to function correctly in Expo Go.
- **`SafeAreaProvider` + `useSafeAreaInsets`** in `TabsNavigator` pushes the tab bar above Android's edge-to-edge nav. Floor at `max(insets.bottom, 10)`.
- **`newArchEnabled: true`** in app.json. Reanimated 4 requires the new architecture.
- **`react-native-worklets` is a required peer dep of reanimated 4.** It must be in `package.json` AND `npm install`-ed AND referenced by the babel plugin. Missing it produces `installTurboModule called with N arguments` at startup. `npx expo install --fix` does NOT add missing peer deps — you must add it to `package.json` manually. Note that you also cannot use reanimated v3 on Expo Go SDK 54 (we tried) — Expo Go's bundled native module is v4, so a v3 JS package crashes with `NullPointerException at NativeProxy.initHybrid`. The only viable Expo Go config is the full v4 stack: reanimated 4 + worklets + new arch + the v4 babel plugin.

## Storage keys

| Key | Value |
|---|---|
| `training_sessions` | `Session[]` |
| `training_templates` | `Template[]` |
| `training_settings` | `Settings` (defaults: target 4000, weekStartsOn 'sunday', goals {BJJ:3, Lift:2, Run:2}, optional `anthropicApiKey`) |
| `training_daily_logs` | `DailyLog[]` — one record per date with HRV / sleep / supplements / notes |
| `training_weekly_checklists` | `WeeklyChecklist[]` — meal-prep done per week (keyed by week-start date) |
| `training_daily_insights` | `DailyInsight[]` — Claude's recommendations, capped at last 60 entries, keyed by target date (tomorrow) |
| `training_strava_tokens` | `StravaTokens` — `{accessToken, refreshToken, expiresAt, athleteId, athleteName}` |
| `training_strava_sync_state` | `{syncedIds: number[], lastSyncedAt: number}` — dedup set capped at 5000, high-water-mark unix seconds for incremental sync |
| `training_last_seen_streaks` | `Record<SessionType, number>` — used for milestone detection on Calendar focus |
| `training_last_seen_weekly_pct` | `number` — used for pull-to-refresh celebration on Today |

`seedDefaultsIfEmpty()` runs on TodayScreen mount and drops in 5 default templates if `training_templates` is empty.

## Load math (don't change without telling the user)

```
loadScore = durationMinutes × intensity × typeMultiplier
```

Multipliers and zones are pinned in `src/load.ts`. The user explicitly enumerated them — they are spec, not suggestions. If you change them, surface that in the response.

Zones:
- 0–40% Light · 40–70% Moderate · 70–90% Productive · 90–110% High · 110%+ Overreaching

## Training Readiness (composite 0-100, forward-looking)

Lives in `src/readiness.ts`. Distinct from the wellness score:

|   | Wellness | Readiness |
|---|---|---|
| Time orientation | Today snapshot | Forward-looking (today + recent trend) |
| HRV weight | 0.40 | 0.50 |
| Sleep weight | 0.40 | 0.35 |
| Load weight | 0.20 | 0.15 |
| Sleep window | Today only | Last 3 nights, slope-aware |
| HRV input | Today's value vs 14-day baseline | Today's value vs baseline + 3-day trend kicker (±5-8 pts) |
| Used by | DailyLogRow ring, full DailyLogScreen breakdown | **TrainingReadinessCard on the Today front page** |

Readiness intentionally over-indexes on recovery signals — the user specifically asked for HRV + sleep to dominate. Returns trend arrows (`↑`/`↓`/`→`) for each component for the card UI.

Bands:
- **85+** Primed (green) · **70-84** Ready (blue) · **55-69** Caution (gold) · **40-54** Drained (amber) · **<40** Recover (red)

## Load Form / ACWR (separate from per-session loadScore)

`src/load-form.ts` exposes `calculateLoadForm()` — the **Acute:Chronic Workload Ratio** used in sport science (Gabbett et al.). This is a **derived aggregate** built on top of per-session `loadScore`; it does NOT modify the canonical formula `loadScore = durationMinutes × intensity × typeMultiplier` (which is user-spec'd and pinned).

- `acuteLoad` = sum of last 7 days of completed `loadScore`
- `chronicLoad` = (last 28 days sum) / 4 (a 7-day-equivalent rolling baseline)
- `ratio` = `acuteLoad / chronicLoad`
- **Recovery-adjusted bump:** if avg HRV last 7d is < 95% of baseline AND/OR avg sleep < 7h, acute load is multiplied by up to 1.15 before computing `adjustedRatio`. This is editorial — same physical load feels heavier when undercooked. Surfaced separately as `adjustedRatio` so the raw `ratio` is preserved.
- Bands: `< 0.8` Fresh · `0.8-1.3` Optimal · `1.3-1.5` High · `1.5-2.0` Overreaching · `> 2.0` Spike

Shown on WeekScreen below the LoadBar / totals card. Past weeks show the ratio as it was at that week's end date.

## Export

`exportAllAsJson()` in `storage.ts` returns a single JSON dump with all training data. **Strips** `anthropicApiKey`, `stravaClientId`, `stravaClientSecret`, and the Strava tokens — the export is for backup/portability, not credential leakage. Exposed via a button in Goals & Settings using `expo-sharing` + the new `expo-file-system` `File` API.

## Two distinct scores on Today (intentional)

`TrainingReadinessCard` and the WellnessRing in `DailyLogRow` show **different numbers** because they're different formulas — see the "Training Readiness" section below for the breakdown. To reduce confusion the DailyLogRow ring now has an explicit "WELLNESS SCORE" label, and a "Trends" chip in the row header opens `WellnessScreen` for the deeper view. **Do not** silently swap one to use the other's formula — the user has explicitly asked to keep both visible and labeled separately.

## Sleep quality scale (1-100, was 1-10)

The sleep quality field on `DailyLog` is on a **1-100 scale**. It used to be 1-10. There's a one-shot migration in `storage.ts` (`migrateSleepQualityIfNeeded`) gated by `Settings.sleepQualityMigratedToHundred` — values ≤10 get ×10'd on first app run after the upgrade. **Don't re-introduce a 1-10 input** anywhere; both `wellness.ts` and `readiness.ts` now treat the quality value as identity-clamped 0-100.

## CSV import (HRV / sleep / supplements)

`src/csv.ts` is a dependency-free parser. `CsvImportScreen` either picks a file via `expo-document-picker` + `expo-file-system` or accepts pasted text, then auto-detects columns via regex on the header row (handles common synonyms: `HRV` / `RMSSD`, `Sleep` / `Sleep Hours`, `Quality` / `Sleep Score`, plus per-supplement names). Quality values ≤ 10 are auto-upgraded to the 0-100 scale on import. Sleep duration accepts decimal hours OR split hours+minutes columns. Booleans accept `1/0`, `y/n`, `true/false`, `taken`, `✓`. Date column is required; HRV/sleep/supps are all optional but at least one non-date field must produce a value or the row is skipped.

## Wellness score (composite 0-100)

Lives in `src/wellness.ts`. Formula:

```
wellness = 0.40 * hrvScore + 0.40 * sleepScore + 0.20 * loadBalance
```

with missing components renormalized so partial logs don't tank the score.

- **HRV score** — relative to the user's rolling 14-day mean. 100 = at or above baseline; 0 = 50% below. Falls back to a coarse raw mapping until enough days are logged.
- **Sleep score** — 60% hours (optimal 7-9h band) + 40% quality (1-10 → 0-100).
- **Load balance** — sweet spot 60-90% of weekly target. Both undertraining and overreaching reduce score.

Color bands come from `wellnessBand()` — used by the Wellness Ring and the DailyLogScreen breakdown:
- **85+** Primed (green) · **70-84** Ready (blue) · **55-69** Steady (gold) · **40-54** Drained (amber) · **<40** Recover (red)

## Strava sync pipeline

Lives in `src/api/strava.ts` (HTTP client) and `src/api/strava-sync.ts` (the runner). Activities are pulled and converted to `Session` records automatically on every `TodayScreen` focus.

**Auth flow:** manual-paste OAuth (no deep links — works inside Expo Go without scheme registration).
1. User registers a Strava app at strava.com/api (any callback domain, e.g. `localhost`).
2. Enters `clientId` + `clientSecret` in the StravaSetupScreen.
3. Taps "Open Strava login" → system browser opens `https://www.strava.com/oauth/authorize?...`.
4. After approval Strava redirects to `https://localhost/exchange_token?code=...` which fails to load — user copies the URL.
5. User pastes the URL (or just the code) back into the app; we extract the `code`, exchange it for `access_token` + `refresh_token` + `expires_at`.
6. Tokens persisted in `training_strava_tokens`. The shared client_secret stays in `Settings.stravaClientSecret`.

**Sync:** `syncStravaActivities()` is safe to call from anywhere (returns immediately if not configured). On each call:
- Refreshes the access token if expiring within 60s
- Fetches activities `after` the stored `lastSyncedAt` (initial backfill = 30 days)
- Skips any activity ID already in `syncedIds`
- Maps `sport_type` → our `SessionType` (Run/Lift/Mobility/Climb), plus name-based overrides for BJJ, climbing, sauna, plunge, mobility
- Estimates RPE via `estimateRpe()` from duration + HR vs the user's `Settings.maxHeartRate`
- Infers Run subtype (Zone 2 / Tempo / Intervals / Long Run) via `inferRunSubtype()`
- Computes load score and writes a `Session` with `status: 'Completed'` and `notes: "Strava: <activity name>"`

**RPE algorithm** (`src/rpe.ts`): five-band map of `%HRmax → base RPE` (2/3/5/7/8/9/10), plus a duration modifier (`±0.5–1`) and a peak-effort bias (`+0.5` when max-HR-in-activity ≥ 95% of user max), clamped to [1, 10]. Returns `undefined` if HR isn't usable so the sync layer can fall back to type-based defaults.

**Unmapped activity types** (Ride, Swim, Walk, Hike, etc.) are silently skipped — they'd need new `SessionType` entries first.

## Daily AI insight pipeline (Anthropic)

The Anthropic API is called **at most once per target date** (cached in `training_daily_insights`). User must add their API key in Goals & Settings — it's stored locally in AsyncStorage and only ever sent to `api.anthropic.com`.

- `src/api/anthropic.ts` calls `https://api.anthropic.com/v1/messages` directly with **`fetch`**. We intentionally do **NOT** use `@anthropic-ai/sdk` — it pulls Node built-ins (`stream`, `crypto`, `fs`) into the Metro bundle which on SDK 54 + new arch causes `installTurboModule called with N arguments` runtime crashes. Since the use case is a single daily request with no streaming/tools/caching, `fetch` is sufficient and far safer. **Do not re-introduce the SDK without a fresh compatibility check.**
- `INSIGHT_MODEL` constant defaults to **`claude-opus-4-7`**. For this single-call/day, ~1KB payload use case, ~$0.005 per call. To cut cost change to `claude-haiku-4-5`.
- `generateDailyInsight()` builds a 14-day context (sessions + daily logs + weekly load), sends it with a system prompt describing the athlete's stack, and uses `output_config.format: {type: 'json_schema', ...}` to constrain the response shape.
- The response is `{recommendation, reasoning, focus}` where `focus ∈ recovery|training|rest|maintenance`.
- Cached by **target date** (tomorrow). Calling again without `force: true` returns the cached insight.
- `DailyInsightCard` on Today shows the cached insight; refresh button calls `generateDailyInsight({force: true})`.

If the user hasn't entered an API key, the card shows a "Set API key" CTA that navigates to Goals.

## Animation system (Zelda inspired)

See **DESIGN.md** for the full philosophy. Quick reference:

- **Every press** should haptic-tap and scale-shrink. `Pill`, `QuickAddBar`, `SessionCard` already do this — keep that contract for any new tappable.
- **Every count** uses `AnimatedNumber`. Hard-coded numbers feel cheap once everything else animates.
- **Every screen entry** uses `FadeInView` with staggered delays (60–80ms). Pattern: `FadeInView delay={0,80,160,240,...}`.
- **Every milestone** uses `CelebrationOverlay` + `TriforceBurst`. The overlay is the "item get" pose — only fire it for genuinely rare events.
- **The Triforce gold (`zelda.triforceGold = #FFD23F`)** is the legendary/celebration accent. Don't use it for everyday UI — that dilutes it.
- **Sound is a stub.** `src/sounds.ts` exports no-op functions. To enable, drop `.mp3` files into `assets/sounds/` and uncomment the bodies (use `expo-audio` which ships with SDK 54).

## Conventions

- Files use `colors`/`spacing`/`fontSize`/`radius` from `src/theme.ts`. Don't hard-code hex outside of `theme.ts` and gradient definitions.
- Type/icon mapping for sessions lives in `src/theme.ts` (`typeColors`, `typeIcons`). New session types need entries there.
- Date strings are local `YYYY-MM-DD` (NOT ISO with timezone). Convert via `toDateString(Date)` / `parseDateString(str)`. ISO parsing across timezones is the most likely source of off-by-one-day bugs.
- All `useFocusEffect` callbacks reload state from storage rather than holding it in a parent — there's no global state container and the user prefers the simplicity.

## Things I should NOT do without asking

- Change the load multipliers or zone thresholds.
- Add a native module that requires a custom dev build. Expo Go compatibility is a hard requirement.
- Add notifications without asking. The user hasn't requested them.

## Common commands

```powershell
# fresh install after changing package.json
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
npx expo install --check    # validates pins against SDK 54
npx expo start -c           # -c clears Metro cache (always do this after babel changes)
```

If the Expo Go app shows `PlatformConstants could not be found`: the SDK doesn't match Expo Go's version. Either update Expo Go on the phone, or downgrade `expo` in package.json.

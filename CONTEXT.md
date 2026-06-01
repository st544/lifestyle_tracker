# CONTEXT.md

> **Read this first.** It's the cheat sheet for any future Claude session picking up this codebase. Pair it with DESIGN.md (style/animation principles) and ROADMAP.md (what's planned).

## What this app is

A **lightweight training calendar** for one user (the owner of this repo). It tracks BJJ, lifts, runs, climbing, hiking, sauna, cold plunge, mobility, and rest days. It is not a generic habit tracker, not a Garmin replacement, not a life OS. The success metric is "can I log a session in under 30 seconds while walking off the mat?"

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
├── HEALTH_CONNECT.md          # PLANNED integration spec (Garmin→Health Connect→app, Android). Not built yet.
├── DEV_BUILD_GUIDE.md         # How to compile/deploy a dev build to Android + re-enter API keys (needed for Health Connect)
├── HEALTH_CONNECT_KICKOFF_PROMPT.md  # Paste-into-fresh-session prompt that builds the Health Connect integration
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
    ├── toast.ts               # Module-level toast singleton API — `toast.show / success / error / warn / info` from anywhere
    ├── messages.ts            # generateSmartMessage, projectedMessage
    ├── storage.ts             # all AsyncStorage CRUD: sessions, templates, settings, dailyLogs, weeklyChecklists, dailyInsights, last-seen
    ├── haptics.ts             # tap/tick/thunk/success/warn/error (wraps expo-haptics)
    ├── sounds.ts              # STUB — no-op until user drops audio files into assets/sounds/
    ├── navigation.ts          # RootStackParamList, TabsParamList
    ├── api/
    │   ├── anthropic.ts       # callAnthropic (fetch-based; no SDK), INSIGHT_MODEL constant
    │   ├── insights.ts        # generateDailyInsight — builds 14-day prompt, calls Claude w/ structured outputs, caches by target date
    │   ├── strava.ts          # Strava OAuth + activity list (fetch-based; manual-paste auth flow)
    │   ├── strava-sync.ts     # syncStravaActivities — pulls new activities, dedupes, maps to Session via RPE estimator
    │   └── usda.ts            # USDA FoodData Central search (fetch-based) — searchFoods + scaleMacros (per-100g)
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
    │   ├── LineChart.tsx      # Multi-series SVG line chart with tap-to-show tooltip, dual y-axis overlay, null-tolerant gaps
    │   ├── ToastHost.tsx      # Mounted ONCE at app root; subscribes to the toast singleton + animates entries in/out
    │   ├── ElevatedAddTab.tsx # Custom tabBarButton for the center "Add" tab — FAB-style raised primary-color circle
    │   ├── DurationDropdown.tsx # Hours+minutes dropdown (Modal + ScrollView) for hiking duration entry
    │   ├── FoodSearchModal.tsx  # USDA food search → pick → set grams → confirm; used by Nutrition + RecipeBuilder
    │   ├── WeekDaysRing.tsx     # Tiny SVG progress ring (days trained this week) used in the Today hero
    │   └── HolyMoonlightSword.tsx # Animated glowing SVG sword emblem (Bloodborne HMS, activated) under the Today date — gold hilt left, pulsing blue moonlight blade right
    └── screens/
        ├── TodayScreen.tsx        # hero: date + glowing HolyMoonlightSword (left), streak flame chip + days-ring + Goals/Backfill/⚙ (right); TrainingReadinessCard, DailyLogRow, DailyInsightCard, Quick add, sessions, This week, Nutrition panel (last); pull-to-refresh burst
        ├── CalendarScreen.tsx     # month view w/ custom day cells (original-size activity dots); each day's WELLNESS score renders as a small square (un-rounded) NEON-outlined tint around the date number (not a dot); today marker gated to the active month (no square dupe on adjacent months); streak chips with a continuous gradient sheen; milestone overlay (4/12/26/52 weeks)
        ├── DayDetailScreen.tsx    # tap a day → quick-add + per-session actions (mark complete / skip / move / delete)
        ├── AddTabScreen.tsx       # tiles per type, "Plan a session", templates list
        ├── AddSessionScreen.tsx   # one-screen form with live load preview, save morphs into checkmark + triforce burst
        ├── WeekScreen.tsx         # totals, animated LoadBar, meal-prep checkbox, workout/recovery/miles, counts by type — week navigator; tapping the **Target** stat opens a modal to edit the global weekly load target (applies to every week)
        ├── TrendsScreen.tsx       # 4/8/12/26-week bar charts: load, sessions, minutes, miles, per-activity
        ├── BackfillScreen.tsx     # last 7 days with one-tap quick-add per type
        ├── GoalsScreen.tsx        # GOALS ONLY now: per-activity weekly minimums, weekly load target, daily calorie goal (+ link to Settings)
        ├── SettingsScreen.tsx     # device/integration settings split out of Goals: week-starts-on, max/resting HR, body weight, Strava, CSV import, export, USDA key, Anthropic key
        ├── DailyLogScreen.tsx     # Full modal for HRV / sleep / supplements / notes — supports past dates via the date picker
        ├── StravaSetupScreen.tsx  # One-time Strava OAuth setup (manual-paste flow), shows connection status, sync-now / disconnect
        ├── CsvImportScreen.tsx    # Pick a CSV file OR paste text → auto-detect columns → preview → bulk upsert daily logs
        ├── WellnessScreen.tsx     # 7-day HRV / sleep duration / sleep quality charts + rule-based wellness insight (headline+body)
        ├── ReadinessScreen.tsx    # Tap-to-open from TrainingReadinessCard. Line graph of readiness over time (14/30/60/90d) + day list to drill in
        ├── NutritionScreen.tsx    # Daily food log — total vs goal, burned, macros, entries, recipe quick-add (Food button on Today)
        └── RecipeBuilderScreen.tsx # Build a reusable recipe from USDA-searched ingredients with live summed totals
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
| `training_settings` | `Settings` (defaults: target 4000, weekStartsOn 'sunday', goals {BJJ:3, Lift:2, Run:2}, maxHeartRate 190, restingHeartRate 60, bodyWeightKg 80, optional `anthropicApiKey`) |
| `training_daily_logs` | `DailyLog[]` — one record per date with HRV / sleep / supplements / notes |
| `training_weekly_checklists` | `WeeklyChecklist[]` — meal-prep done per week (keyed by week-start date) |
| `training_daily_insights` | `DailyInsight[]` — Claude's recommendations, capped at last 60 entries, keyed by target date (tomorrow) |
| `training_strava_tokens` | `StravaTokens` — `{accessToken, refreshToken, expiresAt, athleteId, athleteName}` |
| `training_strava_sync_state` | `{syncedIds: number[], lastSyncedAt: number}` — dedup set capped at 5000, high-water-mark unix seconds for incremental sync |
| `training_last_seen_streaks` | `Record<SessionType, number>` — used for milestone detection on Calendar focus |
| `training_last_seen_weekly_pct` | `number` — used for pull-to-refresh celebration on Today |
| `training_food_entries` | `FoodEntry[]` — logged foods (one per item eaten), keyed by date |
| `training_recipes` | `Recipe[]` — reusable named recipes (ingredient list + summed macros) |

`seedDefaultsIfEmpty()` runs on TodayScreen mount and drops in 5 default templates if `training_templates` is empty.

## Load math (calorie/MET-equivalent model — IMPLEMENTED)

`src/load.ts` now uses the unified calorie/MET-equivalent model (the old `durationMinutes × intensity × typeMultiplier` model has been removed, along with `getTypeMultiplier`). Spec source: `CLAUDE_HIKING_LOAD_PROMPT.md`.

```
loadScore = baseEnergyEquivalent × stressMultiplier
```

`baseEnergyEquivalent` is **actual active calories when known** (`session.activeCalories`), otherwise an activity-specific calorie-equivalent estimate. `calculateLoadScore(input, bodyWeightKg?)` takes the user's body weight (from `Settings.bodyWeightKg`, default `DEFAULT_BODY_WEIGHT_KG = 80`) for the MET-based fallbacks. Storage (`addSession`/`updateSession`) reads `bodyWeightKg` from settings and recomputes `loadScore` whenever any load-relevant field changes (type/subtype/duration/intensity/activeCalories/hikingDifficulty/packWeightLbs).

Per-activity rules (`baseEnergyEquivalent` → multiplier). **Hiking / Run / Lift use the v2 scheme below; BJJ / Rock Climb / recovery are unchanged.**
- **BJJ** *(unchanged)*: calories if known, else `duration × RPE × 0.85`. Mult by subtype: Technique only 1.00 · Normal class 1.10 · Hard sparring 1.20 · Open mat 1.20 · Competition class 1.30.
- **Run**: `activeCalories × runImpactMultiplier`. No calories → estimate `round(bodyWeightKg × MET × hours)` (METs 8.0–11.0 by subtype). Mult (capped **1.40**): Easy/Zone 2 0.90 · Long easy run 1.00 · Tempo 1.10 · Intervals 1.20 · Race/time trial 1.30 · Trail run 1.10 · Hilly run 1.15 · Downhill-heavy run 1.20.
- **Lift**: `round(bodyWeightKg × MET × hours) × finalMultiplier` (uses calories instead of the MET estimate if provided). `finalMultiplier = baseMult + rpeAdjustment`, capped **1.45**. [MET, baseMult]: Maintenance/easy [3.5, 1.05] · Normal lift [4.5, 1.15] · Heavy upper [5.0, 1.20] · Heavy lower [5.5, 1.30] · Heavy full body [5.5, 1.25] · Kettlebell [5.5, 1.15] · Circuit [5.8, 1.10]. RPE adj: 1–4 −0.10 · 5–6 0 · 7–8 +0.05 · 9–10 +0.10 (RPE 0/unset → 0).
- **Hiking**: `activeCalories × hikeImpactMultiplier`. No calories → estimate `round(bodyWeightKg × difficulty-MET × hours)` (METs 4.5–9.0). `hikeImpactMultiplier = 1 + difficultyBonus + elevationBonus + durationBonus + packBonus`, capped **1.75**:
  - difficulty: Easy/flat 0 · Moderate 0.10 · Hilly 0.20 · Hard/steep 0.30 · Very hard/mountain 0.40
  - elevation (`elevationGainFeet / miles`): <100 ft/mi 0 · 100–250 0.05 · 250–500 0.10 · 500–750 0.15 · >750 0.20
  - duration: <2h 0 · 2–4h 0.05 · 4–6h 0.10 · 6h+ 0.15
  - pack: 0–10 lb 0 · 10–25 0.05 · 25+ 0.10
- **Rock Climb** *(unchanged)*: calories if known, else `bodyWeightKg × session-adjusted MET × hours`. [MET, mult]: Casual [3.5, 1.00] · Top rope/moderate [4.0, 1.05] · Bouldering [5.0, 1.20] · Hard bouldering [5.5, 1.30] · Limit [6.0, 1.35].
- **Recovery types** *(unchanged)* (Sauna/Cold Plunge/Sauna+Cold/Mobility): low MET × small multiplier. **Rest = 0**.

Legacy subtype names (`Normal Class`, `Zone 2`, `Long Run`, `Maintenance`, `Upper`, `Lower`, `Full Body`, `Top Rope`, `Lead`, `Casual`, etc.) are still recognized by the multiplier switches, so old stored sessions keep calculating.

Rules that still hold: do **not** use raw `RPE × duration` as the final score; do **not** add run/hike distance or hiking elevation directly to load (stored/displayed only — calories already reflect them; hiking elevation feeds only the *multiplier* bonus). Only `date`, `type`, `durationMinutes`, `status` are required.

**Migration:** `migrateLoadScoresIfNeeded()` (in `storage.ts`, run on TodayScreen mount, gated by `Settings.loadModelVersion` vs `CURRENT_LOAD_MODEL_VERSION`) recomputes every existing session's `loadScore` whenever the model version is bumped, so historical trends/ACWR stay on one consistent scale. Non-destructive (loadScore is derived). **v1** = initial calorie/MET model; **v2** = hiking additive-bonus model + expanded run types + lifting RPE adjustment.

> **Note on magnitude:** because the model changed from RPE-duration to calorie-equivalent, absolute load numbers shifted somewhat. The 4000 weekly target default is unchanged but the user may want to re-tune it in Goals.

Zones (unchanged, in `getLoadZone`):
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

`src/load-form.ts` exposes `calculateLoadForm()` — the **Acute:Chronic Workload Ratio** used in sport science (Gabbett et al.). This is a **derived aggregate** built on top of per-session `loadScore` (now the calorie/MET-equivalent score); it does NOT define its own per-session formula. It keeps working unchanged because it only reads `s.loadScore`.

- `acuteLoad` = sum of last 7 days of completed `loadScore`
- `chronicLoad` = (last 28 days sum) / 4 (a 7-day-equivalent rolling baseline)
- `ratio` = `acuteLoad / chronicLoad`
- **Recovery-adjusted bump:** if avg HRV last 7d is < 95% of baseline AND/OR avg sleep < 7h, acute load is multiplied by up to 1.15 before computing `adjustedRatio`. This is editorial — same physical load feels heavier when undercooked. Surfaced separately as `adjustedRatio` so the raw `ratio` is preserved.
- Bands: `< 0.8` Fresh · `0.8-1.3` Optimal · `1.3-1.5` High · `1.5-2.0` Overreaching · `> 2.0` Spike

Shown on WeekScreen below the LoadBar / totals card. Past weeks show the ratio as it was at that week's end date.

## Export

`exportAllAsJson()` in `storage.ts` returns a single JSON dump with all training data. **Strips** `anthropicApiKey`, `stravaClientId`, `stravaClientSecret`, and the Strava tokens — the export is for backup/portability, not credential leakage. Exposed via a button in Goals & Settings using `expo-sharing` + the new `expo-file-system` `File` API.

## TrainingReadinessCard is the Today hero (merged)

`TrainingReadinessCard` on the Today screen now optionally includes a "Today's read" sub-section (smart message + big projected % + LoadBar). When TodayScreen passes `smartMessage`, `completedPercent`, and `projectedPercent`, the card renders the merged view; otherwise it's just the readiness portion. This replaces what used to be two stacked cards (readiness + gradient smart-message card) — one combined hero card instead.

A **sticky banner** (`READINESS XX · BAND`) appears at the top of Today when the user scrolls past the readiness card, using Reanimated's `useAnimatedScrollHandler`. The card's bottom Y is captured via `onLayout` into a shared value; the banner's `opacity` + `translateY` interpolate when `scrollY > cardBottomY`.

## Toast system

`src/toast.ts` is a module-level singleton — anything can call `toast.show('Saved')`, `toast.success('...')`, etc. `ToastHost` is mounted ONCE inside the NavigationContainer at the app root, subscribes to the singleton, and animates entries in/out (slide-up + fade via Reanimated). Wired across all action sites: save/delete sessions, mark complete, Strava sync, daily insight refresh, CSV import, settings save, JSON export, Strava connect/disconnect.

## Tab bar

- Every tab uses `AnimatedTabIcon` which now renders a translucent **pill background** behind the icon when focused (color tinted by `tabBarActiveTintColor`).
- The center "Add" tab uses a **custom `tabBarButton`** (`ElevatedAddTab`) instead — a raised primary-color filled circle that visually breaks out of the tab bar via negative `marginTop` + `tabBarStyle.overflow: 'visible'`. The label is hidden for this tab (icon-only FAB).

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
- Maps `sport_type` → our `SessionType` (Run/Hiking/Lift/Mobility/Climb), plus name-based overrides for BJJ, climbing, sauna, plunge, mobility. `Hike` → Hiking (was previously skipped), preserving distance, elevation gain (m→ft), and active calories when present; difficulty is inferred from elevation-per-mile
- Estimates RPE via `estimateRpe()` from duration + HR vs the user's `Settings.maxHeartRate`
- Infers Run subtype (Zone 2 / Tempo / Intervals / Long Run) via `inferRunSubtype()`
- Computes load score and writes a `Session` with `status: 'Completed'` and `notes: "Strava: <activity name>"`

**RPE algorithm** (`src/rpe.ts`): five-band map of `%HRmax → base RPE` (2/3/5/7/8/9/10), plus a duration modifier (`±0.5–1`) and a peak-effort bias (`+0.5` when max-HR-in-activity ≥ 95% of user max), clamped to [1, 10]. Returns `undefined` if HR isn't usable so the sync layer can fall back to type-based defaults.

**Unmapped activity types** (Ride, Swim, Walk, etc.) are silently skipped.

## Daily AI insight pipeline (Anthropic)

The Anthropic API is called **at most once per target date** (cached in `training_daily_insights`). User must add their API key in Goals & Settings — it's stored locally in AsyncStorage and only ever sent to `api.anthropic.com`.

- `src/api/anthropic.ts` calls `https://api.anthropic.com/v1/messages` directly with **`fetch`**. We intentionally do **NOT** use `@anthropic-ai/sdk` — it pulls Node built-ins (`stream`, `crypto`, `fs`) into the Metro bundle which on SDK 54 + new arch causes `installTurboModule called with N arguments` runtime crashes. Since the use case is a single daily request with no streaming/tools/caching, `fetch` is sufficient and far safer. **Do not re-introduce the SDK without a fresh compatibility check.**
- `INSIGHT_MODEL` constant defaults to **`claude-opus-4-7`**. For this single-call/day, ~1KB payload use case, ~$0.005 per call. To cut cost change to `claude-haiku-4-5`.
- `generateDailyInsight()` builds a 14-day context (sessions + daily logs + weekly load), sends it with a system prompt describing the athlete's stack, and uses `output_config.format: {type: 'json_schema', ...}` to constrain the response shape.
- The response is `{recommendation, reasoning, focus}` where `focus ∈ recovery|training|rest|maintenance`.
- Cached by **target date** (tomorrow). Calling again without `force: true` returns the cached insight.
- `DailyInsightCard` on Today shows the cached insight; refresh button calls `generateDailyInsight({force: true})`.

If the user hasn't entered an API key, the card shows a "Set API key" CTA that navigates to Goals.

## Nutrition / calorie tracking (MyFitnessPal-lite)

A lightweight food/calorie tracker layered onto the training app. Calories *consumed* complement the per-session `activeCalories` *burned* so the user can see energy balance.

- **Data source:** USDA FoodData Central (`src/api/usda.ts`, fetch-based — same no-SDK pattern as Anthropic/Strava). `searchFoods(query, apiKey)` returns simplified results with macros normalized **per 100 g**; `scaleMacros(per100, grams)` scales to the amount eaten. Requires a free USDA API key stored in `Settings.usdaApiKey` (entered in Goals & Settings). **Do not re-introduce an SDK** — keep it fetch-only for Expo Go safety.
- **Types** (`types.ts`): `FoodMacros` (calories + optional protein/carbs/fat), `FoodEntry` (a logged food on a date), `RecipeIngredient`, `Recipe` (named ingredient list with summed totals).
- **Storage** (`storage.ts`): `getFoodEntriesForDate` / `addFoodEntry` / `deleteFoodEntry` / `getCaloriesForDate`; `getRecipes` / `addRecipe` / `deleteRecipe`. Food entries + recipes are included in `exportAllAsJson` (USDA key stripped).
- **Screens:** `NutritionScreen` (modal, reached via the **Food** button in the Today hero row) — daily total vs `Settings.dailyCalorieGoal`, calories burned (sum of that day's session `activeCalories`), protein/carb/fat totals, today's entries (delete), and saved-recipe quick-add. `RecipeBuilderScreen` (modal) builds a recipe from searched ingredients with live summed totals. Both use the shared `FoodSearchModal` component (search → pick → set grams → confirm).
- **Scope note:** intentionally an MVP — no barcode scanning, micros, or per-meal grouping. The app's North Star is still training; nutrition is a complementary surface, not the main event.

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

- Change load zone thresholds or the per-activity calorie/MET multipliers without asking. They're enumerated in `CLAUDE_HIKING_LOAD_PROMPT.md` and implemented in `src/load.ts` — treat them as spec.
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

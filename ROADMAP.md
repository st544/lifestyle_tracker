# ROADMAP.md

> Living list of what's built, what's planned, and what's been explicitly ruled out. Update this after every significant change.

## Shipped (v1)

### Core
- 5 bottom tabs: Today / Calendar / Add / This Week / Trends
- One-screen Add Session form with live load preview ("light/moderate/high addition")
- Planned → Completed in-place update (no duplicate sessions)
- DayDetail action sheet: Mark Completed / Edit / Skip / Move / Delete
- Backfill Week (last 7 days, one tap = default session)
- Reusable session templates (5 seeded defaults)
- AsyncStorage persistence (sessions / templates / settings / last-seen snapshots)

### Tracking
- 10 session types (incl. **Hiking**), 5 statuses
- Per-type defaults (duration / RPE / subtypes / locations); Hiking uses difficulty + pack weight + elevation + trail name
- **Calorie/MET-equivalent load model** (`loadScore = baseEnergyEquivalent × stressMultiplier`): active calories when known, RPE/MET fallbacks otherwise. Replaced the old `duration × intensity × multiplier` model. Body weight (kg) in Settings drives MET fallbacks. See `CLAUDE_HIKING_LOAD_PROMPT.md` + CONTEXT.md "Load math".
- Weekly load zones (Light → Overreaching)
- Smart message generator on Today (varies by load and recent-day intensity)
- Optional `miles` field on Run sessions
- Recovery vs workout minutes split

### Goals + streaks
- Per-activity weekly session minimums (Goals modal)
- Configurable weekly load target
- Configurable week start (Sunday default)
- Streak chips on Calendar (consecutive weeks meeting goal)
- Milestone celebration overlay at 4 / 12 / 26 / 52 week streaks

### Trends
- 4 / 8 / 12 / 26 week range selector
- Bar charts for: weekly load (with target line), sessions, workout minutes, recovery minutes, miles run
- Per-activity charts (BJJ / Lift — Run & Climb charts removed by request) with per-activity goal as target line

### Animation + feel (Zelda inspired)
- Tier 1: press scale + haptic on every tappable, count-up numbers everywhere, tab icon bounce on focus, screen entry fade-stagger
- Tier 2: save button → SaveCheckmark + TriforceBurst, hero count-up, typewriter smart message, gradient hero that shifts color with zone, LoadBar zone-transition flash, pull-to-refresh celebration when weekly % rose, mark-completed burst
- Tier 3: CelebrationOverlay "ACHIEVEMENT UNLOCKED" modal with Triforce icon, rotating dashed ring, golden particles
- Zelda accent palette (`zelda` in theme.ts) reserved for celebration moments
- Haptics wired throughout (`src/haptics.ts`)

### Strava + readiness + heart rate
- **Strava OAuth integration** — manual-paste flow works in Expo Go (no deep links). Tokens auto-refresh.
- **Activity auto-sync** on every TodayScreen focus. Dedupes by Strava activity ID, incremental from `lastSyncedAt`.
- **Sport-type + name-based mapping** to our SessionType (BJJ override via name pattern).
- **RPE estimator** from training duration + average/max HR vs user's max HR — 5-band intensity map with duration modifier and peak-effort bias.
- **Run subtype inference** (Zone 2 / Tempo / Intervals / Long Run) from HR + duration.
- **Heart-rate settings** (`maxHeartRate`, `restingHeartRate`) added to Settings + Goals screen.
- **Training Readiness card** on Today front page — composite 0-100 weighted 50/35/15 toward HRV/sleep/load. Shows trend arrows per component and a verdict band.
- **Note:** the original "Garmin integration" was explicitly ruled out earlier. The Strava path is a re-think — Garmin syncs to Strava natively, so this gets you activities + HR + distance without a Garmin Health API partnership.

### Wellness + AI insights
- Daily log inputs (HRV ms, sleep hours, sleep quality 1-10, supplement checkboxes for creatine/greens/electrolytes/protein, notes)
- Inline daily-log row on Today + full-edit modal screen
- Composite **wellness score** (0-100) blending HRV vs 14-day baseline, sleep, and load balance — with circular animated gauge
- Weekly meal-prep checkbox on the This Week tab
- **Daily AI insight** — calls Anthropic API with last 14 days of data, returns one specific recommendation for tomorrow, cached by target date so we hit the API at most once per day
- Anthropic API key field in Goals & Settings, stored locally only

### Nutrition (MyFitnessPal-lite, MVP)
- USDA FoodData Central food search (`src/api/usda.ts`, fetch-based; free API key in Goals)
- Daily food log (`NutritionScreen`, reached via the Today **Food** button): calories eaten vs `dailyCalorieGoal`, calories burned (from session `activeCalories`), protein/carb/fat totals, per-entry delete
- Reusable **recipes** built from searched ingredients (`RecipeBuilderScreen`) with summed macros; one-tap to log
- Shared `FoodSearchModal` (search → pick → grams → confirm); macros normalized per-100g and scaled
- Food entries + recipes included in JSON export (USDA key stripped)
- Scope: no barcode scan / micros / meal grouping yet — see ideas below

### Health Connect (Garmin → Health Connect → app, Android)
- **Native module integration** (`react-native-health-connect` v3 + Expo config plugin) — **ends Expo Go**, requires a development build (`DEV_BUILD_GUIDE.md`).
- `src/api/health-connect.ts` guarded wrapper (no-op on iOS / when unavailable / denied) + `health-connect-sync.ts` runner mirroring the Strava pipeline (read since HWM, dedup on record id, 30-day backfill).
- Imports: HRV → `DailyLog.hrv`, sleep duration → `DailyLog.sleepHours`, resting HR → new `DailyLog.restingHr`, exercise sessions → `Session` (reusing `estimateRpe` + `calculateLoadScore`, with active calories / distance / HR from overlapping records).
- `HealthConnectSetupScreen` (availability, grant permissions, sync now, last-synced, open HC settings, auto-sync toggle → `Settings.healthConnectEnabled`); Android-only row in Settings. App-open sync gated in `TodayScreen.load()`.
- **JSON restore** (`importAllFromJson` + `JsonImportScreen`) so history can move from the old Expo Go install into the fresh dev-build sandbox.

### Layout/UX fixes
- Tab bar respects safe-area bottom inset (Android edge-to-edge nav)
- GestureHandlerRootView at app root
- New-architecture enabled

## Planned next (priority order)

1. ~~**HRV / sleep auto-import from a watch.**~~ **SHIPPED** (Android, Health Connect — see Shipped above). Remaining: verify record shapes/units against a real Garmin device on-device; derive `sleepQuality` from stage composition if a score isn't present; iOS/HealthKit is still a separate parallel task (parallel `health-kit.ts` + `health-kit-sync.ts` writing the same `upsertDailyLog`/`addSession` targets).
2. **Insight history view.** Cached insights are kept (last 60) but not browsable. Add a "Past insights" screen so the user can see which recommendations they followed and how the week unfolded.
3. **Streak/quality of compliance.** Track whether the user actually followed each day's insight (manual check). Feed back into the next day's prompt as additional context.
4. **Sounds.** `src/sounds.ts` is a stub. Drop short Zelda-style chimes into `assets/sounds/` and wire them up via `expo-audio`:
   - `playItemGet()` on CelebrationOverlay open
   - `playRupee()` on each save's TriforceBurst
   - `playSecret()` on pull-to-refresh celebration
   - `playChestOpen()` on hero zone transition
2. **Reduce-motion support.** Read `AccessibilityInfo.isReduceMotionEnabled()` once in App.tsx, expose via context, gate Tier-3 and shorten Tier-1 animations when on.
3. **Calendar drag-to-reschedule.** Long-press a planned session in DayDetail → drag to another day. Would need `react-native-gesture-handler` panning (already installed).
4. **Templates editor screen.** Currently templates can only be created via the Save-as-template prompt in AddSession (iOS-only via Alert.prompt). Build a Templates screen reachable from the Add tab where the user can edit existing templates and create new ones.
5. **Copy-previous-session shortcut.** Long-press an existing SessionCard → "Duplicate" option that opens AddSession with everything but date pre-filled to today.
6. **PR detection.** Track personal records (longest run, heaviest week load, longest streak) and fire `CelebrationOverlay` when a PR is set. Storage: `training_personal_records`.
7. **Heart-rate inspired RPE picker.** Replace the 0–10 dot row with a small SVG heart that fills as RPE rises, in `heartRed` from the Zelda palette.

## Nutrition — possible follow-ups
- Barcode scanning (would add `expo-camera`/`expo-barcode-scanner` — still Expo Go compatible).
- Macro goals + a macro progress ring (protein/carb/fat targets), not just a calorie goal.
- Per-meal grouping (breakfast/lunch/dinner/snack) and recently-eaten quick list.
- Net-energy surface on Today (calories in vs out vs BMR) feeding into recovery context.
- Editable recipes + scaling a recipe by servings when logging.

## Mid-term ideas

- Settings screen (currently only Goals + the 3 fields there). Pull `defaultWeeklyTargetLoad` and `weekStartsOn` into a broader Settings if more knobs accumulate.
- Per-week notes ("how the week felt") attached to the week-start date.
- Calendar tap-to-add directly from the month grid (already navigates to DayDetail; could skip a step).
- Year heatmap (GitHub-contribution style) under Trends.
- Export sessions as CSV (`expo-file-system` + share sheet via `expo-sharing`).

## Long-term / consider when needed

- **SQLite migration.** AsyncStorage gets a single JSON blob per key. Once `training_sessions` is >500 entries, list parsing becomes noticeable. Migrate to `expo-sqlite` then.
- **Sync backend.** User has explicitly deferred this. If revisited, Supabase is the leading candidate. Storage layer is already abstracted, so swap should be local to `src/storage.ts`.
- **iPad / web layout.** Currently mobile-only design. Tablet would benefit from a multi-column Today view.

## Explicitly ruled out (don't propose these)

- **Direct Garmin Health API integration.** Requires partner approval and a backend. The Strava sync covers ~90% of the same data (activities + HR + distance + suffer score) since Garmin Connect auto-syncs everything to Strava — go through that instead.
- **Health Connect (Android).** No longer ruled out — spec'd and ready to build (see `HEALTH_CONNECT.md`). Moved to "planned next #1." Accepts the Expo-Go→dev-build trade-off.
- **Apple Watch / HealthKit (iOS).** Still deferred. Same write targets as Health Connect, different native module; build as a parallel path after the Android one proves out.
- **Generic habit tracker features.** This is a training calendar, not Streaks/Done/etc.
- **Authentication.** Local-first, single user.
- **Notifications.** User hasn't asked. Don't add without explicit request — push notifications need extra setup and feel like nagging.
- **Additional AI/LLM features beyond the current Daily AI insight.** The repo already has an Anthropic-powered daily insight card; don't add more LLM surfaces without explicit request.

## Open questions for the user

- Do you want sound effects? If yes, the wiring is ready — you'd need to provide audio files.
- Want a year heatmap on the Trends tab?
- Should milestone overlays fire once per milestone (current behavior, via `lastSeenStreaks`) or every time you open the Calendar while at that milestone? Currently the former.
- The `react-native-confetti-cannon` dep is in package.json but unused — we went with `TriforceBurst` instead. OK to remove from package.json on next change?

## Versions / dependency notes

- Pinned to Expo SDK 54. To upgrade, run `npx expo install --fix` after bumping `expo` in package.json. Expect breaking changes in reanimated and react-native every major SDK.
- `react-native-reanimated` is v4 (uses worklets). Some older snippets you find online assume v2/v3 — be careful.
- `react-native-svg` is needed by both `TriforceBurst` / `BarChart` / `TriforceIcon` / `SaveCheckmark` AND transitively by `react-native-calendars`. Don't remove from deps even if it looks unused at the screen level.

# HEALTH_CONNECT.md

> Integration plan + technical context for syncing **Garmin → Health Connect → this app** on Android. Pair with `DEV_BUILD_GUIDE.md` (how to compile/deploy the required development build) and `HEALTH_CONNECT_KICKOFF_PROMPT.md` (the prompt that builds this integration end-to-end).
>
> **Status: NOT YET BUILT.** This document is the spec. Nothing in `src/` references Health Connect yet.

---

## 1. Why this is the chosen path

The data flow:

```
Garmin watch → Garmin Connect app → Health Connect (on-device store) → this app
```

- **Garmin → Health Connect**: the Garmin Connect Android app writes workouts, HRV, sleep, resting HR, etc. into Health Connect automatically once the user enables it (Garmin Connect → Settings → Connected Apps → Health Connect). No code on our side.
- **Health Connect → this app**: we read records via the `react-native-health-connect` native module.

**Why not Google Fit:** the Google Fit REST API and Android SDK are deprecated and being shut down (2026). Health Connect is Google's replacement and the only forward-looking option on Android.

**Why not Apple Health:** that's the iOS equivalent (`HealthKit`). If iOS support is ever needed it's a *separate* integration (`react-native-health` / `@kingstinct/react-native-healthkit`) writing to the same `upsertDailyLog` / `addSession` targets. Out of scope for this doc.

**This is on-device, not cloud "API sync."** Health Connect is a local database on the phone. There is no server, no webhook. Garmin Connect populates it in the background; we read from it when the app opens or via a registered background task. For a single-user local-first app, that's ideal — no backend required.

---

## 2. The hard constraint this breaks

The project has been **Expo Go, no custom dev build** from day one (see `CONTEXT.md` → Stack). Health Connect is a native module that is **not** in the Expo Go sandbox. Adding it **ends Expo Go compatibility** — you must build and run a **development build** (a custom dev client) instead.

This is a deliberate, one-way door. Once merged:
- `npx expo start` still works, but you scan the QR into **your dev build**, not Expo Go.
- Everyone testing the app needs the dev build APK installed, not Expo Go.
- The `newArchEnabled: true` setting (already on) is compatible with `react-native-health-connect`.

`DEV_BUILD_GUIDE.md` covers the build + install. Do not start the integration until you've read it and accepted the trade-off.

---

## 3. Library + platform requirements

| Item | Value |
|---|---|
| Library | `react-native-health-connect` (Matinzd) — the de-facto RN Health Connect binding |
| Min Android | Android 9 (API 26) for the lib; **Health Connect itself** is built into Android 14+ (API 34). On Android 13- the user installs the "Health Connect" app from the Play Store. |
| compileSdk / targetSdk | 34+ (Expo SDK 54 default is already 34/35 — fine) |
| Config plugin | The lib ships an Expo config plugin that injects the required `<queries>` + permissions into `AndroidManifest.xml`. Add it to `app.json` `plugins`. |
| New arch | Compatible. We're already `newArchEnabled: true`. |

Install (the kickoff prompt does this):
```
npx expo install react-native-health-connect
```

---

## 4. Which Health Connect records map to which app data

The app already has the exact write targets. **Do not invent new storage** — reuse these:

| Health Connect record | App field | Storage call |
|---|---|---|
| `HeartRateVariabilityRmssd` | `DailyLog.hrv` (ms) | `upsertDailyLog({ date, hrv })` |
| `SleepSession` (sum of stages → hours) | `DailyLog.sleepHours` | `upsertDailyLog({ date, sleepHours })` |
| `SleepSession` (Garmin sleep score, if present in metadata) | `DailyLog.sleepQuality` (1-100) | `upsertDailyLog({ date, sleepQuality })` |
| `RestingHeartRate` | `Settings.restingHeartRate` (rolling) OR a future `DailyLog.restingHr` | (see §7 open question) |
| `ExerciseSession` (+ `ActiveCaloriesBurned`, `HeartRate`) | a `Session` | `addSession({...})` via the same mapping shape as `strava-sync.ts` |

### Mapping rules (mirror `src/api/strava-sync.ts`)

The Strava sync already solved "external activity → `Session`". Health Connect activity import should **reuse that exact logic** as far as possible:

- `ExerciseSession.exerciseType` → `SessionType` via a `mapHealthConnectType()` analogous to `mapActivityType()` in `strava-sync.ts`. Health Connect exercise type is an enum (e.g. `EXERCISE_TYPE_RUNNING`, `EXERCISE_TYPE_STRENGTH_TRAINING`, `EXERCISE_TYPE_HIKING`). Name-based override for BJJ still applies (Garmin often records martial arts as "Workout"/"Other" — check the session title metadata).
- Duration: `(endTime - startTime)` in minutes.
- Intensity (RPE): reuse `estimateRpe()` from `src/rpe.ts` with avg/max HR from the associated `HeartRate` records vs `Settings.maxHeartRate`.
- `activeCalories`: from `ActiveCaloriesBurned` records overlapping the session window → feeds the calorie/MET load model in `load.ts`.
- `miles`: from `Distance` records (meters → miles) for Run/Hiking.
- `loadScore`: compute via `calculateLoadScore(payload, settings.bodyWeightKg)` — same as Strava sync.
- `status: 'Completed'`, `notes: 'Health Connect: <title>'`.

---

## 5. Dedup + incremental sync (mirror Strava's `StravaSyncState`)

Health Connect records have stable string IDs (`metadata.id`). Follow the Strava pattern exactly:

- New storage key: `training_health_connect_sync_state` → `{ syncedRecordIds: string[]; lastSyncedAt: number }`.
- On each sync: read records with `startTime > lastSyncedAt` (or last 30 days on first run), skip any `metadata.id` already in `syncedRecordIds`, upsert the rest, advance the high-water mark.
- Daily logs (HRV/sleep) are **date-keyed and idempotent** via `upsertDailyLog` — re-reading the same day just merges identical values, so dedup there is less critical, but still track record IDs to avoid redundant writes.
- Cap `syncedRecordIds` at ~5000 like `saveStravaSyncState` does.

**Garmin → Health Connect latency:** a workout can take 5–60 min to appear; sleep/HRV usually lands next morning. So the app's view always lags real-time slightly. Fine for a training calendar.

---

## 6. Files to create / touch (the build plan)

New:
- `src/api/health-connect.ts` — thin wrapper over `react-native-health-connect`: `isAvailable()`, `ensureInitialized()`, `requestPermissions()`, typed `readHrv(range)`, `readSleep(range)`, `readExerciseSessions(range)`, `readActiveCalories(range)`. All guarded so they no-op + return empty on iOS / when HC unavailable.
- `src/api/health-connect-sync.ts` — `syncHealthConnect()`: the runner. Mirrors `strava-sync.ts` structure (init → permission check → read since high-water-mark → dedup → `upsertDailyLog` / `addSession` → save sync state → return `{importedSessions, importedDailyLogs, skipped}`).
- `src/screens/HealthConnectSetupScreen.tsx` — modal: availability status, "Grant permissions" button (opens HC permission sheet), "Sync now", last-synced timestamp, "Open Health Connect settings" deep link, toggle for auto-sync-on-open. Mirror `StravaSetupScreen.tsx`.

Touch:
- `app.json` — add the `react-native-health-connect` config plugin + any required `android.permissions`.
- `src/types.ts` — add `Settings.healthConnectEnabled?: boolean`; optionally `DailyLog.restingHr?: number`. Add `HealthConnectSyncState` interface.
- `src/storage.ts` — add `getHealthConnectSyncState` / `saveHealthConnectSyncState` + KEYS entry, following the Strava sync-state helpers.
- `src/navigation.ts` — add `HealthConnect: undefined` to `RootStackParamList`.
- `App.tsx` — register the `HealthConnect` modal screen.
- `src/screens/SettingsScreen.tsx` — add a "Health Connect (Android)" row that navigates to `HealthConnectSetupScreen` (only show on Android: `Platform.OS === 'android'`).
- `src/screens/TodayScreen.tsx` — in `load()`, after the Strava sync block, add a best-effort `syncHealthConnect()` call guarded by `Settings.healthConnectEnabled` + `Platform.OS === 'android'`. Toast on import count, same as Strava.
- `CONTEXT.md` / `ROADMAP.md` — flip the "Expo Go only" claim once this lands.

---

## 7. Open questions to resolve during the build

1. **Resting HR storage.** There's no `DailyLog.restingHr` field today. Either add one (cleanest, enables a future chart) or fold it into the rolling `Settings.restingHeartRate`. **Recommend: add `DailyLog.restingHr?: number`** — it's per-day data and belongs with HRV/sleep.
2. **Sleep score availability.** Garmin's 0-100 sleep score may or may not survive into Health Connect's `SleepSession` (HC models sleep as staged intervals, not a score). If the score isn't present, derive `sleepQuality` from stage composition (deep + REM %), or leave `sleepQuality` for manual entry and only auto-fill `sleepHours`. Decide after inspecting real records on-device.
3. **Manual-vs-imported conflict.** If the user already hand-logged HRV for a day and HC then imports a different value, which wins? **Recommend: HC import wins for HRV/sleep (it's the measured source), but never overwrite a non-empty `notes` or `supplements`.** `upsertDailyLog` already deep-merges supplements and only overwrites provided fields, so this is mostly handled — just be deliberate about HRV/sleep.
4. **Background sync.** v1 should sync on app-open only (like Strava). True background sync needs `expo-background-task` / a foreground service — defer.
5. **HRV units.** Garmin's native HRV is RMSSD; HC's `HeartRateVariabilityRmssd` is also RMSSD, so this should match the Garmin app more closely than the Apple Health SDNN path would. Verify against the watch on-device.

---

## 8. What does NOT change

- The `loadScore` formula (`load.ts`) — Health Connect just provides better inputs (real `activeCalories`, real HR for RPE). The model is untouched.
- `upsertDailyLog` / `addSession` — the write targets are reused as-is.
- Wellness / readiness / ACWR math — they consume `DailyLog` + `Session` and don't care where the data came from.
- The CSV import + manual daily log + Strava sync paths all remain. Health Connect is **additive**, a fourth ingestion source, not a replacement.

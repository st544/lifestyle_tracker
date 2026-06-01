# DEV_BUILD_GUIDE.md

> How to compile a **development build** of this app and run it on a physical Android phone. Required for the Health Connect integration (native module — not available in Expo Go). Also covers re-entering API keys in the new build.
>
> You only need a dev build **once per native-dependency change**. Day-to-day JS edits still hot-reload over `npx expo start` — you just scan into the dev build instead of Expo Go.

---

## 0. Mental model — why this is needed

Expo Go is a fixed prebuilt app: it only contains the native modules Expo bundled. `react-native-health-connect` is a *new* native module, so it must be compiled into a custom app binary — a **development build**. That binary is basically "your own personal Expo Go" with your native deps baked in. After installing it once, the JS dev loop is identical (Metro + QR + hot reload).

Two ways to produce it:
- **EAS Build (cloud)** — Expo compiles it on their servers, you download an APK. No Android Studio / Java needed locally. **Recommended.**
- **Local build** — `npx expo run:android`. Needs Android Studio, JDK 17, and the Android SDK installed. Faster iteration if you build native often, heavier setup.

This guide leads with EAS Build.

---

## 1. One-time prerequisites

1. **Expo account** — free. Create at https://expo.dev/signup.
2. **EAS CLI**:
   ```powershell
   npm install -g eas-cli
   eas login
   ```
3. **Android phone with Developer Options + USB debugging** (only needed for the local-install method; EAS APK can be downloaded directly to the phone via a link).
   - Settings → About phone → tap "Build number" 7× → Developer Options unlocked.
   - Developer Options → enable "USB debugging".
4. **Health Connect on the phone**:
   - Android 14+: built in. Settings → Security & privacy → (More) → Health Connect.
   - Android 13 or earlier: install **Health Connect** from the Play Store.
   - In the **Garmin Connect** app: Settings → Connected Apps (or "Health Connect") → enable, and grant Garmin write permission for Heart Rate Variability, Sleep, Exercise, Active Calories, Resting Heart Rate.

---

## 2. Configure EAS (one-time, in the repo)

```powershell
cd C:\Users\strie\Documents\lifestyle_tracker_app
eas build:configure
```

This creates `eas.json`. Ensure it has a **development** profile that produces an installable APK (not an `.aab`, which is for the Play Store only):

```jsonc
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {}
  }
}
```

- `developmentClient: true` → includes the dev menu + Metro connection (this is the one to use while building the feature).
- `distribution: "internal"` → gives you a direct download link / QR, no Play Store.
- `buildType: "apk"` → sideloadable on the phone directly.

---

## 3. Build the APK (cloud)

```powershell
eas build --profile development --platform android
```

- First run asks to generate an Android **keystore** — say **yes**, let EAS manage it. (It's just a signing key; EAS stores it.)
- Build runs on Expo's servers (~10–20 min). When done, the terminal prints a URL and a QR.

---

## 4. Install on the phone

**Easiest:** open the build URL (or scan the QR EAS printed) **on the phone's browser** → download the APK → tap it → "install from unknown source" (allow for the browser). The dev build app icon appears in the launcher.

**Via cable (alternative):** with USB debugging on and the phone plugged in:
```powershell
# requires platform-tools (adb) installed
adb install path\to\downloaded.apk
```

---

## 5. Run the JS against the dev build

```powershell
npx expo start --dev-client
```

- Open the **dev build app** on the phone (NOT Expo Go).
- It shows a screen to connect to Metro — scan the QR from `npx expo start`, or it auto-detects on the same Wi-Fi.
- Hot reload, fast refresh, the dev menu (shake) all work exactly like Expo Go.

If the phone and laptop aren't on the same network: `npx expo start --dev-client --tunnel`.

---

## 6. Re-enter API keys in the dev build  ⚠️ important

**The dev build is a different app install than Expo Go**, with its own AsyncStorage sandbox. **None of your existing data or keys carry over.** You start fresh. Re-enter, in the app's **Settings** screen (gear icon on Today → "Device settings, integrations & API keys"):

1. **Anthropic API key** (for Daily Insight) — `sk-ant-...`
   - Get/regenerate at https://console.anthropic.com → API Keys.
   - Paste into Settings → "Daily AI insight" (or wherever the key field lives). Stored locally only; only sent to `api.anthropic.com`.
2. **Strava** (if you use activity sync) — re-enter Client ID + Client Secret, then re-run the OAuth paste flow in the Strava setup screen.
3. **USDA FoodData Central key** (nutrition search) — free key at https://fdc.nal.usda.gov/api-key-signup.html.
4. **Body weight / Max HR / Resting HR** — re-enter in Settings; these drive the load + RPE models.

> **Migrating existing data:** before switching, open the old Expo Go app → Goals/Settings → **Export all data as JSON** → share to yourself. (There's no in-app JSON *import* yet — if you want your history in the dev build, the kickoff prompt should add a JSON import counterpart to the existing CSV import, OR you re-import HRV/sleep via the CSV path. Flag this to the user.)

---

## 7. When do you rebuild?

| Change | Rebuild needed? |
|---|---|
| JS / TS / styles / new screens | ❌ — just hot reload |
| Add/remove/upgrade a **native** module (e.g. `react-native-health-connect`) | ✅ — `eas build` again, reinstall APK |
| Change `app.json` plugins / Android permissions | ✅ |
| Change Anthropic prompt / load math / charts | ❌ |

So you rebuild **once** when Health Connect is added, then go back to the normal JS loop.

---

## 8. Local build alternative (if you'd rather not use EAS cloud)

Requires: Android Studio, JDK 17, `ANDROID_HOME` set, an emulator or plugged-in device.

```powershell
npx expo run:android
```

First run does a full Gradle prebuild (slow, ~10 min). Subsequent runs are incremental. The dev build installs directly to the connected device/emulator. Use this if you're iterating on native code frequently; otherwise EAS cloud is less setup.

---

## 9. Troubleshooting

- **"Unable to load script / could not connect to Metro"** in the dev build → make sure `npx expo start --dev-client` is running and the phone is on the same Wi-Fi (or use `--tunnel`).
- **Health Connect permission sheet never appears** → the `react-native-health-connect` config plugin didn't inject the manifest entries; confirm it's in `app.json` `plugins` and that you rebuilt after adding it. Permissions only take effect in a fresh build.
- **`installTurboModule` / startup crash after adding the native module** → version mismatch. Run `npx expo install --fix`, rebuild. (This project has hit this before with reanimated — see CONTEXT.md.)
- **APK won't install ("app not installed")** → uninstall any older copy of the dev build first; signing keys must match.

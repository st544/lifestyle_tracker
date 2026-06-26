/**
 * Expo config plugin: make the app discoverable to Health Connect on
 * **Android 14+** (where Health Connect is part of the OS).
 *
 * WHY THIS EXISTS: react-native-health-connect's bundled plugin only injects
 * the Android 13 mechanism (an `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`
 * intent-filter on MainActivity). On Android 14+, Health Connect discovers a
 * client app via a `VIEW_PERMISSION_USAGE` / `HEALTH_PERMISSIONS` **activity-alias**
 * instead. Without it, Health Connect never lists the app, it can't be searched
 * or added under "App permissions", and `requestPermission()` returns empty —
 * which is exactly the symptom on Samsung/Android 14 devices.
 *
 * This adds that activity-alias (pointing at MainActivity) so Health Connect
 * recognizes the app and shows the permission UI. Keep BOTH mechanisms: the
 * library's intent-filter covers Android 13, this covers 14+.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const ALIAS_NAME = 'ViewPermissionUsageActivity';

module.exports = function withHealthConnectRationale(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application && cfg.modResults.manifest.application[0];
    if (!app) return cfg;

    app['activity-alias'] = app['activity-alias'] || [];
    const already = app['activity-alias'].some(
      (a) => a && a.$ && a.$['android:name'] === ALIAS_NAME,
    );
    if (!already) {
      app['activity-alias'].push({
        $: {
          'android:name': ALIAS_NAME,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } },
            ],
            category: [
              { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } },
            ],
          },
        ],
      });
    }
    return cfg;
  });
};

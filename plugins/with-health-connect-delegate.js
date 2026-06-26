/**
 * Expo config plugin: wire up react-native-health-connect's permission
 * delegate in MainActivity.
 *
 * WHY THIS EXISTS: the library's own app.plugin.js only adds the
 * ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter to the manifest. But its
 * native module requires `HealthConnectPermissionDelegate.setPermissionDelegate(this)`
 * to be called in MainActivity.onCreate — that call registers the
 * ActivityResultLauncher the permission dialog runs through. Without it,
 * `requestPermission()` hits an uninitialized `lateinit` launcher inside a
 * coroutine and HARD-CRASHES the app (uncatchable from JS).
 *
 * This plugin injects the import + the onCreate call into the generated
 * MainActivity.kt during prebuild (locally or on EAS).
 */
const { withMainActivity, WarningAggregator } = require('@expo/config-plugins');

const IMPORT_LINE =
  'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function injectKotlin(src) {
  let out = src;

  // 1. Import (after the package declaration)
  if (!out.includes(IMPORT_LINE)) {
    out = out.replace(/^(package .*\r?\n)/m, `$1\n${IMPORT_LINE}\n`);
  }

  // 2. Delegate call (right after super.onCreate(...) in onCreate)
  if (!out.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
    if (/super\.onCreate\([^)]*\)/.test(out)) {
      out = out.replace(
        /(super\.onCreate\([^)]*\)\s*\r?\n)/,
        `$1    ${DELEGATE_CALL}\n`,
      );
    } else {
      // Template without an onCreate override — add one inside the class body.
      out = out.replace(
        /(class MainActivity\s*:\s*ReactActivity\(\)\s*\{\s*\r?\n)/,
        `$1  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n` +
        `    super.onCreate(null)\n` +
        `    ${DELEGATE_CALL}\n` +
        `  }\n\n`,
      );
    }
  }

  return out;
}

module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === 'kt') {
      cfg.modResults.contents = injectKotlin(cfg.modResults.contents);
    } else {
      WarningAggregator.addWarningAndroid(
        'with-health-connect-delegate',
        'MainActivity is Java — Health Connect permission delegate was NOT injected. Convert to Kotlin or add HealthConnectPermissionDelegate.INSTANCE.setPermissionDelegate(this, "com.google.android.apps.healthdata") manually.',
      );
    }
    return cfg;
  });
};

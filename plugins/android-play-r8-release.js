const { withGradleProperties, withAppBuildGradle } = require("expo/config-plugins");

const R8_FULL_MODE_KEY = "android.enableR8.fullMode";
const R8_FULL_MODE_VALUE = "true";

function upsertGradleProperty(items, key, value) {
  const index = items.findIndex(
    (item) => item.type === "property" && item.key === key,
  );
  const entry = { type: "property", key, value };
  if (index >= 0) {
    items[index] = entry;
  } else {
    items.push(entry);
  }
}

/**
 * Play Console „Verschleierung“ / DEX-Optimierung (Store-Marathon 2026-09-22):
 * - `expo-build-properties` setzt minify/shrink via gradle.properties (wirksam erst im gebauten AAB).
 * - Expo-Template nutzt `proguard-android.txt` (−dontoptimize); für R8-Optimierung + Obfuscation
 *   wechseln wir auf `proguard-android-optimize.txt`.
 * - R8 full mode explizit aktivieren (AGP-Default kann je Version variieren).
 *
 * Nach `expo prebuild` / EAS Release: neues Produktions-AAB hochladen — Play misst nur den live Track.
 */
function withAndroidPlayR8Release(config) {
  config = withGradleProperties(config, (cfg) => {
    upsertGradleProperty(cfg.modResults, R8_FULL_MODE_KEY, R8_FULL_MODE_VALUE);
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("proguard-android.txt")) {
      contents = contents.replace(
        /getDefaultProguardFile\(\s*["']proguard-android\.txt["']\s*\)/g,
        'getDefaultProguardFile("proguard-android-optimize.txt")',
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withAndroidPlayR8Release;

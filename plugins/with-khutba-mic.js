const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');

const PACKAGE = 'de.salatibox.de';
const NATIVE_DIR = path.join(__dirname, 'khutba-mic-native');
const FILES = ['KhutbaMicService.kt', 'KhutbaMicModule.kt', 'KhutbaMicPackage.kt'];

const withKhutbaMicFiles = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...PACKAGE.split('.'),
        'khutba',
      );
      fs.mkdirSync(javaDir, { recursive: true });
      for (const f of FILES) {
        fs.copyFileSync(path.join(NATIVE_DIR, f), path.join(javaDir, f));
      }
      return cfg;
    },
  ]);

const withKhutbaMicManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] ?? [];
    for (const perm of [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    ]) {
      if (!manifest.manifest['uses-permission'].some((p) => p.$?.['android:name'] === perm)) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }
    const app = manifest.manifest.application?.[0];
    if (!app) return cfg;
    app.service = app.service ?? [];
    if (!app.service.some((s) => s.$?.['android:name'] === '.khutba.KhutbaMicService')) {
      app.service.push({
        $: {
          'android:name': '.khutba.KhutbaMicService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone',
        },
      });
    }
    return cfg;
  });

const withKhutbaMicPackage = (config) =>
  withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('KhutbaMicPackage')) {
      src = src.replace(
        'import com.facebook.react.defaults.DefaultReactNativeHost',
        'import com.facebook.react.defaults.DefaultReactNativeHost\nimport de.salatibox.de.khutba.KhutbaMicPackage',
      );
      src = src.replace(
        'PackageList(this).packages',
        'PackageList(this).packages.apply { add(KhutbaMicPackage()) }',
      );
      if (!src.includes('KhutbaMicPackage')) {
        src = src.replace(
          /(\.apply\s*\{[^}]*)(}\s*\))/s,
          '$1    add(KhutbaMicPackage())\n          $2',
        );
      }
      cfg.modResults.contents = src;
    }
    return cfg;
  });

module.exports = (config) => {
  config = withKhutbaMicFiles(config);
  config = withKhutbaMicManifest(config);
  config = withKhutbaMicPackage(config);
  return config;
};
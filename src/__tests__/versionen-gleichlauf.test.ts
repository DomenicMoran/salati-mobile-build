/**
 * Die Versionsnummer steht an DREI Stellen, die nichts voneinander wissen:
 *
 *   1. `app.config.ts` → `version`        (iOS/Store-Anzeige, Web, OTA-Policy)
 *   2. `android/app/build.gradle` → `appVersionName`  (Android-versionName UND
 *      die expo-updates-runtimeVersion, s. Kommentar dort)
 *   3. `src/features/changelog/changelog.ts` → letzter Eintrag (Anzeige im
 *      „Neu in dieser Version"-Screen)
 *
 * Am 2026-07-28 wurde beim Bump auf 1.36.0 nur (1) und (3) geaendert. Die APK
 * trug dadurch versionCode 56, hiess aber weiterhin 1.35.0 — aufgefallen erst
 * beim Auslesen der fertigen APK, nach zwei Release-Builds à 6 Minuten. Ein
 * abweichender versionName verschiebt zusaetzlich die runtimeVersion, womit
 * OTA-Updates am falschen Kanal haengen.
 *
 * Gelesen wird bewusst der DATEITEXT, nicht ein Import: `build.gradle` ist
 * Groovy und laesst sich nicht importieren, und `app.config.ts` wuerde beim
 * Import den halben Expo-Konfigurationsbaum ausfuehren.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { LATEST_CHANGELOG_VERSION } from '@/features/changelog/changelog';

const WURZEL = path.join(__dirname, '..', '..');

function lies(datei: string): string {
  return readFileSync(path.join(WURZEL, datei), 'utf8');
}

describe('Versionsnummern laufen gleich', () => {
  const config = lies('app.config.ts');
  // Seit 1.41.0 steht die Nummer als Konstante `VERSION` und wird an
  // `version` und `runtimeVersion` verteilt.
  const ausConfig = /^const VERSION = '([^']+)';/m.exec(config)?.[1];
  const ausGradle = /^def appVersionName = "([^"]+)"/m.exec(lies(path.join('android', 'app', 'build.gradle')))?.[1];

  it('app.config.ts nennt eine Version', () => {
    expect(ausConfig).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('android/app/build.gradle nennt dieselbe Version wie app.config.ts', () => {
    expect(ausGradle).toBe(ausConfig);
  });

  it('der neueste Changelog-Eintrag traegt dieselbe Version', () => {
    expect(LATEST_CHANGELOG_VERSION).toBe(ausConfig);
  });

  it('versionCode und buildNumber sind identisch (eine Zahl je Release)', () => {
    const gradle = lies(path.join('android', 'app', 'build.gradle'));
    const versionCode = /^\s*versionCode (\d+)/m.exec(gradle)?.[1];
    const buildNumber = /buildNumber: '(\d+)'/.exec(config)?.[1];
    expect(versionCode).toBe(buildNumber);
  });

  /**
   * `eas update` loest im bare workflow (handgepflegtes android/) keine
   * runtimeVersion-Policy auf, sondern bricht ab. Deshalb steht dort eine
   * Zeichenkette — die aber exakt dem entsprechen muss, was build.gradle als
   * `expo_runtime_version` in die APK schreibt (dort: appVersionName).
   */
  it('runtimeVersion ist gesetzt und gleich der Version (keine Policy)', () => {
    expect(config).not.toMatch(/runtimeVersion:\s*\{/);
    expect(/runtimeVersion: (\w+),/.exec(config)?.[1]).toBe('VERSION');
    expect(lies(path.join('android', 'app', 'build.gradle'))).toContain(
      'resValue "string", "expo_runtime_version", appVersionName',
    );
  });

  /**
   * Android wird hier lokal gebaut, das Manifest also nicht aus app.config.ts
   * erzeugt. Bis 1.41.0 zeigte es auf ein anderes EAS-Projekt als die Config
   * (@salatipro statt @salatibox) — ein Update haette damit immer nur eine der
   * beiden Plattformen erreicht, ohne dass irgendwo ein Fehler erschienen waere.
   */
  it('die Update-URL im Android-Manifest nennt dasselbe EAS-Projekt wie app.config.ts', () => {
    const projectId = /projectId: '([^']+)'/.exec(config)?.[1];
    const manifest = lies(path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml'));
    const updateUrl = /EXPO_UPDATE_URL" android:value="([^"]+)"/.exec(manifest)?.[1];
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(updateUrl).toBe(`https://u.expo.dev/${projectId}`);
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';

// Die Handy-App ist ein Bare-Workflow: `expo prebuild` laeuft im CI NICHT
// (sonst waere der WearOS-Teil weg). Damit ist android/app/build.gradle die
// Quelle fuer den Bau - app.config.ts wird dort nicht gelesen.
//
// Genau daran ist 1.51.0 gescheitert: app.config.ts stand auf 1.51.0,
// build.gradle noch auf 1.50.0 mit versionCode 75. Der Lauf baute also
// unbemerkt wieder 1.50.0, und Play lehnte ab: "Version code 75 has already
// been used." Auffallen konnte das erst nach 30 Minuten Bauzeit.
//
// Dieser Test zieht den Abgleich nach vorn - er laeuft in Sekunden.
const ROOT = join(__dirname, '..', '..');

function lies(pfad: string): string {
  return readFileSync(join(ROOT, pfad), 'utf8');
}

describe('Version der Android-App', () => {
  const config = lies('app.config.ts');
  const gradle = lies('android/app/build.gradle');

  const configVersion = /^const VERSION = '([^']+)'/m.exec(config)?.[1];
  const gradleVersion = /^def appVersionName = "([^"]+)"/m.exec(gradle)?.[1];
  const versionCode = /^\s*versionCode (\d+)/m.exec(gradle)?.[1];

  it('findet beide Angaben ueberhaupt', () => {
    expect(configVersion).toBeDefined();
    expect(gradleVersion).toBeDefined();
    expect(versionCode).toBeDefined();
  });

  it('build.gradle traegt dieselbe Version wie app.config.ts', () => {
    expect(gradleVersion).toBe(configVersion);
  });

  it('hat zu dieser Version Play-Notizen in store/', () => {
    expect(() => lies(`store/play-notes-${configVersion}.json`)).not.toThrow();
  });
});

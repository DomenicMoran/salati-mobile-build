import { existsSync, statSync } from 'fs';
import { join } from 'path';

import { androidChannelSound, azanSource, iosNotificationSound } from './azan';
import { AZAN_CHOICES, azanNumber, migrateAzanChoice } from '@/features/settings/types';

describe('Adhan-Tonquellen', () => {
  test('"default" heißt überall: kein Adhan, System-Standardton', () => {
    expect(azanSource('default')).toBeNull();
    expect(androidChannelSound('default')).toBeUndefined();
    expect(iosNotificationSound('default')).toBeUndefined();
  });

  test('Android nutzt die Raw-Resource, die Metro aus dem Asset-Pfad erzeugt', () => {
    // Der Name ist KEINE freie Wahl: Metro legt `assets/audio/azan/adhan1.mp3`
    // im Release-Build als `res/raw/assets_audio_azan_adhan1.mp3` ab
    // (getAssetDestPathAndroid). Ändert sich der Asset-Pfad, muss dieser Name
    // mitwandern, sonst fällt expo-notifications' SoundResolver still auf den
    // System-Standardton zurück — hörbar nur auf einem echten Release-Gerät.
    expect(androidChannelSound('adhan1')).toBe('assets_audio_azan_adhan1.mp3');
    expect(androidChannelSound('fajr')).toBe('assets_audio_azan_fajr.mp3');
  });

  test('Auswahl-Kennungen bleiben gültige Android-Resource-Namen', () => {
    // res/raw-Namen dürfen nur [a-z0-9_] enthalten. Eine Auswahl wie
    // `adhanFajr` käme im Release-Build als `assets_audio_azan_adhanfajr.mp3`
    // an und liefe ins Leere.
    for (const choice of AZAN_CHOICES) {
      expect(choice).toMatch(/^[a-z0-9_]+$/);
    }
  });

  test('iOS nutzt den < 30-s-Schnitt, der über app.config.ts ins Bundle kommt', () => {
    expect(iosNotificationSound('fajr')).toBe('adhan_fajr.caf');
  });

  test('für jede Auswahl liegen volle Aufnahme UND Benachrichtigungs-Schnitt vor', () => {
    const root = join(__dirname, '..', '..', '..');
    for (const choice of AZAN_CHOICES) {
      if (choice === 'default') continue;
      expect(azanSource(choice)).toBeTruthy();
      expect(existsSync(join(root, 'assets', 'audio', 'azan', `${choice}.mp3`))).toBe(true);
      // Fehlt der Schnitt, ersetzt iOS den Ton kommentarlos durch den
      // Standardton — der Fehler wäre sonst erst im TestFlight-Build hörbar.
      const schnitt = join(root, 'assets', 'audio', 'azan', 'notification', `adhan_${choice}.caf`);
      expect(existsSync(schnitt)).toBe(true);
      // IMA-ADPCM mono 22050 Hz = 11 025 Byte/s. Apple lehnt Töne AB 30 s ab
      // (dann Standardton, kommentarlos) — die Obergrenze hier ist bewusst
      // knapp darunter und fängt einen falsch gesetzten Schnittpunkt in
      // scripts/make-adhan-notification-sounds.mjs ab.
      expect(statSync(schnitt).size).toBeLessThan(29 * 11025);
    }
  });
});

describe('Anzeigenamen „Adhan 1/2/3“', () => {
  test('die Nummer folgt der Reihenfolge in AZAN_CHOICES', () => {
    expect(azanNumber('adhan1')).toBe(1);
    expect(azanNumber('adhan2')).toBe(2);
    // Der Fadschr-Ruf heißt intern weiter `fajr` (Asset-/Resource-Namen),
    // erscheint im UI aber schlicht als „Adhan 3“.
    expect(azanNumber('fajr')).toBe(3);
  });

  test('jede Aufnahme hat genau eine Nummer, keine doppelt', () => {
    const nummern = AZAN_CHOICES.filter((c) => c !== 'default').map((c) =>
      azanNumber(c as Exclude<typeof c, 'default'>),
    );
    expect(nummern).toEqual([1, 2, 3]);
  });
});

describe('Migration der alten Auswahl-Kennungen', () => {
  test('entfallene Aufnahmen werden zu einer vorhandenen, Fadschr zum Fadschr-Ruf', () => {
    for (const alt of ['azan8', 'azan9', 'azan12', 'azan14', 'azan20']) {
      expect(migrateAzanChoice(alt, 'dhuhr')).toBe('adhan1');
      expect(migrateAzanChoice(alt, 'fajr')).toBe('fajr');
      expect(migrateAzanChoice(alt, null)).toBe('adhan1');
    }
  });

  test('"kein Adhan" bleibt "kein Adhan"', () => {
    expect(migrateAzanChoice('default', 'fajr')).toBe('default');
    expect(migrateAzanChoice('default', 'isha')).toBe('default');
    expect(migrateAzanChoice('default', null)).toBe('default');
  });

  test('gültige Auswahl bleibt unverändert, unbekannte wird gezogen', () => {
    expect(migrateAzanChoice('adhan2', 'asr')).toBe('adhan2');
    expect(migrateAzanChoice('adhan1', 'fajr')).toBe('adhan1');
    // Alle drei Aufnahmen stehen bei jedem Gebet zur Wahl — eine gespeicherte
    // Auswahl wird deshalb nirgends mehr umgebogen.
    expect(migrateAzanChoice('fajr', 'maghrib')).toBe('fajr');
    expect(migrateAzanChoice(undefined, 'isha')).toBe('adhan1');
    expect(migrateAzanChoice(42, 'fajr')).toBe('fajr');
  });
});

import fs from 'fs';
import path from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { COURSE_META } from '@/features/study/courses';

import {
  BACKUP_KEYS,
  BACKUP_KEY_PREFIXES,
  EXCLUDED_KEYS,
  EXCLUDED_KEY_PREFIXES,
  PORTABLE_SETTINGS_FIELDS,
  SETTINGS_BACKUP_KEY,
  classifyStorageKey,
  collectBackupValues,
  isFullBackupKey,
  mergePortableSettings,
  pickPortableSettings,
  restoreBackupValues,
  selectBackupKeys,
} from './backupKeys';

// ---------------------------------------------------------------------------
// Der eigentliche Wächter: JEDER im Quelltext vorkommende salatibox:-Schlüssel
// muss entweder gesichert werden oder ausdrücklich mit Begründung
// ausgeschlossen sein. Ein neuer, vergessener Schlüssel fällt damit sofort auf
// - genau der Fehler, durch den u. a. `prayer-qada-owed` (nachzuholende
// Gebete) und der gesamte Kursfortschritt beim Gerätewechsel verloren gingen.
// ---------------------------------------------------------------------------

const SRC_DIR = path.join(__dirname, '..', '..');

/**
 * `salatibox:` gefolgt vom statischen Anfang des Schlüssels. Der Punkt ist
 * BEWUSST nicht Teil der Zeichenklasse (sonst schluckt ein Satzende im
 * Kommentar - "… in salatibox:writing." - den Schlüsselnamen), `//` schließt
 * das Deep-Link-Schema `salatibox://…` aus, das kein Speicher-Schlüssel ist.
 * Dynamische Schlüssel (`salatibox:journey:${id}`) liefern so exakt ihr
 * Präfix - deshalb muss die Klassifizierung präfixfähig sein.
 */
const KEY_LITERAL = /salatibox:(?!\/\/)[A-Za-z0-9:_-]*/g;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Alle im Produktivcode vorkommenden Schlüssel(-präfixe) -> Fundstellen. */
function storageKeyLiterals(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of collectSourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(KEY_LITERAL)) {
      const key = match[0];
      if (key === 'salatibox:') continue; // Rest eines Deep-Links o. Ä.
      const where = found.get(key) ?? [];
      where.push(path.relative(SRC_DIR, file));
      found.set(key, where);
    }
  }
  return found;
}

describe('Vollständigkeit der Sicherung', () => {
  it('findet überhaupt Schlüssel im Quelltext (Regex/Pfad nicht kaputt)', () => {
    const keys = storageKeyLiterals();
    expect(keys.size).toBeGreaterThan(30);
    expect(keys.has('salatibox:prayer-qada-owed')).toBe(true);
    expect(keys.has('salatibox:journey:')).toBe(true);
  });

  it('ordnet JEDEN Schlüssel entweder der Sicherung oder der Ausschlussliste zu', () => {
    const unclassified: string[] = [];
    for (const [key, files] of storageKeyLiterals()) {
      if (classifyStorageKey(key) === 'unclassified') {
        unclassified.push(`${key}  (${[...new Set(files)].join(', ')})`);
      }
    }
    expect(unclassified).toEqual([]);
  });

  it('hält für jeden Ausschluss eine nicht-leere Begründung vor', () => {
    for (const [key, reason] of Object.entries({ ...EXCLUDED_KEYS, ...EXCLUDED_KEY_PREFIXES })) {
      expect(typeof reason).toBe('string');
      expect(reason.trim().length).toBeGreaterThan(20); // eine echte Begründung, kein "n/a"
      expect(key.startsWith('salatibox:')).toBe(true);
    }
  });

  it('führt keinen Schlüssel gleichzeitig in Sicherung und Ausschluss', () => {
    for (const key of BACKUP_KEYS) {
      expect(EXCLUDED_KEYS[key]).toBeUndefined();
      expect(classifyStorageKey(key)).toBe('full');
    }
  });

  it('sichert die im Befund genannten, vorher verlorenen Schlüssel', () => {
    const previouslyLost = [
      'salatibox:prayer-qada-owed',
      'salatibox:qada-owed',
      'salatibox:taraweeh',
      'salatibox:study-tajwid',
      'salatibox:study-unknown',
      'salatibox:study-course-order',
      'salatibox:journey:sabr',
      'salatibox:practice-days',
      'salatibox:practice-mistakes',
      'salatibox:practice-days-plays-total',
      'salatibox:tasbih-history',
      'salatibox:tasbih-goal',
      'salatibox:tasbih:custom',
      'salatibox:achievements-seen',
      'salatibox:mushaf-page',
      'salatibox:khatmah-completed-once',
    ];
    for (const key of previouslyLost) {
      expect([key, classifyStorageKey(key)]).toEqual([key, 'full']);
    }
  });
});

describe('dynamische Schlüssel über Präfixe', () => {
  it('sichert JEDEN Kurs aus COURSE_META, auch künftig hinzukommende', () => {
    for (const course of COURSE_META) {
      expect([course.id, isFullBackupKey(course.storageKey)]).toEqual([course.id, true]);
    }
    // ein Kurs, den es heute noch gar nicht gibt
    expect(isFullBackupKey('salatibox:study-ein-kurs-von-morgen')).toBe(true);
  });

  it('sichert jeden Lernweg unter dem journey-Präfix', () => {
    expect(isFullBackupKey('salatibox:journey:sabrJourney')).toBe(true);
    expect(isFullBackupKey('salatibox:journey:noch-nicht-erfunden')).toBe(true);
  });

  it('ausgeschlossene Präfix-Familien bleiben draußen', () => {
    expect(classifyStorageKey('salatibox:timings:52.520:13.400:3:0:auto:')).toBe('excluded');
    expect(classifyStorageKey('salatibox:mosques:v2:52.52:13.40:5000')).toBe('excluded');
    expect(classifyStorageKey('salatibox:halal:v2:52.52:13.40:5000')).toBe('excluded');
    expect(classifyStorageKey('salatibox:zakat-gold-price-usd')).toBe('excluded');
    expect(classifyStorageKey('salatibox:course-ver-tajwid')).toBe('excluded');
  });

  it('ein völlig fremder Schlüssel bleibt unklassifiziert (und damit ungesichert)', () => {
    expect(classifyStorageKey('salatibox:etwas-ganz-neues')).toBe('unclassified');
    expect(isFullBackupKey('salatibox:etwas-ganz-neues')).toBe(false);
  });

  it('selectBackupKeys filtert eine gemischte Schlüsselliste', () => {
    expect(
      selectBackupKeys([
        'salatibox:qada-owed',
        'salatibox:error-log',
        'salatibox:journey:sabr',
        'salatibox:settings',
        'salatibox:query-cache',
      ]),
    ).toEqual(['salatibox:journey:sabr', 'salatibox:qada-owed']);
  });
});

describe('Einstellungen: nur der übertragbare Ausschnitt', () => {
  const full = JSON.stringify({
    location: { lat: 52.52, lon: 13.4, label: 'Berlin', city: 'Berlin', country: 'DE' },
    method: 3,
    school: 1,
    prayerTimeOffsets: { fajr: -2 },
    language: 'tr',
    themeOverride: 'dark',
    widgetTheme: 'purple',
    recitationModel: 'turbo',
    notificationsEnabled: { fajr: true },
  });

  it('nimmt Standort/Methode mit, lässt gerätespezifische Schalter draußen', () => {
    const picked = JSON.parse(pickPortableSettings(full)!) as Record<string, unknown>;
    expect(picked.method).toBe(3);
    expect(picked.school).toBe(1);
    expect(picked.prayerTimeOffsets).toEqual({ fajr: -2 });
    expect(picked.location).toMatchObject({ city: 'Berlin' });
    expect(picked).not.toHaveProperty('language');
    expect(picked).not.toHaveProperty('themeOverride');
    expect(picked).not.toHaveProperty('widgetTheme');
    expect(picked).not.toHaveProperty('recitationModel');
    expect(picked).not.toHaveProperty('notificationsEnabled');
  });

  it('liefert null, wenn nichts Übertragbares gespeichert ist', () => {
    expect(pickPortableSettings(null)).toBeNull();
    expect(pickPortableSettings('kein json')).toBeNull();
    expect(pickPortableSettings(JSON.stringify({ themeOverride: 'dark' }))).toBeNull();
  });

  it('merge behält die gerätespezifischen Felder des Zielgeräts', () => {
    const target = JSON.stringify({ language: 'ar', themeOverride: 'light', method: 99 });
    const merged = JSON.parse(mergePortableSettings(target, pickPortableSettings(full)!)!) as Record<string, unknown>;
    expect(merged.language).toBe('ar'); // Zielgerät gewinnt
    expect(merged.themeOverride).toBe('light'); // Zielgerät gewinnt
    expect(merged.method).toBe(3); // aus der Sicherung
  });

  it('verwirft fremde Felder aus einer von Hand editierten Sicherung', () => {
    const merged = JSON.parse(
      mergePortableSettings('{}', JSON.stringify({ method: 5, themeOverride: 'dark', boeses: true }))!,
    ) as Record<string, unknown>;
    expect(merged.method).toBe(5);
    expect(merged).not.toHaveProperty('themeOverride');
    expect(merged).not.toHaveProperty('boeses');
  });

  it('PORTABLE_SETTINGS_FIELDS enthält keine Dubletten', () => {
    expect(new Set(PORTABLE_SETTINGS_FIELDS).size).toBe(PORTABLE_SETTINGS_FIELDS.length);
  });
});

describe('collectBackupValues / restoreBackupValues', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sammelt Nutzerdaten inkl. dynamischer Schlüssel und lässt Geräte-Kram weg', async () => {
    await AsyncStorage.multiSet([
      ['salatibox:prayer-qada-owed', '{"fajr":3}'],
      ['salatibox:qada-owed', '4'],
      ['salatibox:study-tajwid', '{"t1":{"score":5,"total":5,"completedAt":1}}'],
      ['salatibox:journey:sabr', '{"journeyId":"sabr","startDay":"2026-01-01","completed":{}}'],
      ['salatibox:offline-audio', '{"ar.alafasy|1":7}'],
      ['salatibox:error-log', '[]'],
      ['salatibox:query-cache', '{"gross":true}'],
      ['salatibox:timings:52.520:13.400:3:0:auto:', '{}'],
      [SETTINGS_BACKUP_KEY, JSON.stringify({ method: 3, themeOverride: 'dark' })],
    ]);

    const values = await collectBackupValues();
    expect(Object.keys(values).sort()).toEqual([
      'salatibox:journey:sabr',
      'salatibox:prayer-qada-owed',
      'salatibox:qada-owed',
      'salatibox:settings',
      'salatibox:study-tajwid',
    ]);
    expect(JSON.parse(values[SETTINGS_BACKUP_KEY])).toEqual({ method: 3 });
  });

  it('schreibt zurück, ignoriert dabei ausgeschlossene und fremde Schlüssel', async () => {
    await AsyncStorage.setItem(SETTINGS_BACKUP_KEY, JSON.stringify({ language: 'ar', method: 1 }));

    const restored = await restoreBackupValues({
      'salatibox:qada-owed': '7',
      'salatibox:journey:sabr': '{"journeyId":"sabr"}',
      'salatibox:error-log': '[{"gefaelscht":true}]',
      'salatibox:etwas-fremdes': 'x',
      'salatibox:settings': JSON.stringify({ method: 9, themeOverride: 'dark' }),
      'salatibox:qada-owed-zahl': 42, // kein String -> ignoriert
    });

    expect(restored.sort()).toEqual(['salatibox:journey:sabr', 'salatibox:qada-owed', 'salatibox:settings']);
    expect(await AsyncStorage.getItem('salatibox:qada-owed')).toBe('7');
    expect(await AsyncStorage.getItem('salatibox:error-log')).toBeNull();
    expect(await AsyncStorage.getItem('salatibox:etwas-fremdes')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_BACKUP_KEY))!)).toEqual({ language: 'ar', method: 9 });
  });

  it('Hin- und Rückweg erhält alle Werte identisch', async () => {
    const original: Record<string, string> = {
      'salatibox:prayer-qada-owed': '{"fajr":3,"dhuhr":0,"asr":1,"maghrib":0,"isha":2}',
      'salatibox:taraweeh': '{"2026-03-02":20}',
      'salatibox:tasbih:custom': '[{"id":"a","text":"سبحان الله"}]',
      'salatibox:mushaf-page': '340',
    };
    await AsyncStorage.multiSet(Object.entries(original));
    const collected = await collectBackupValues();
    await AsyncStorage.clear();
    await restoreBackupValues(collected);

    for (const [key, value] of Object.entries(original)) {
      expect([key, await AsyncStorage.getItem(key)]).toEqual([key, value]);
    }
  });
});

describe('BACKUP_KEY_PREFIXES', () => {
  it('sind alle korrekt präfixiert und überschneiden sich nicht mit Ausschluss-Präfixen', () => {
    for (const prefix of BACKUP_KEY_PREFIXES) {
      expect(prefix.startsWith('salatibox:')).toBe(true);
      for (const excluded of Object.keys(EXCLUDED_KEY_PREFIXES)) {
        expect(prefix.startsWith(excluded)).toBe(false);
        expect(excluded.startsWith(prefix)).toBe(false);
      }
    }
  });
});

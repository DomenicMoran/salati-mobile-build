import AsyncStorage from '@react-native-async-storage/async-storage';

// EINE Quelle der Wahrheit dafür, was bei Gerätewechsel/Neuinstallation
// mitgeht — genutzt von BEIDEN Sicherungswegen (Sync-Code in codeSync.ts und
// Backup-Datei in features/settings/backup.ts). Vorher pflegte codeSync.ts eine
// eigene 10er-Liste von Hand; die App schreibt aber ~40 Schlüssel. Alles, was
// nicht auf der Liste stand, ging beim Gerätewechsel STILL verloren — u. a. die
// nachzuholenden Gebete (`prayer-qada-owed`) und der komplette Kursfortschritt.
//
// Die eigentliche Ursache war nicht die Länge der Liste, sondern ihre Bauart:
// eine handgepflegte Aufzählung läuft dem Code immer hinterher. Deshalb hier:
//
//  1. PRÄFIXE statt Einzelnennung für alles, was dynamisch entsteht
//     (`salatibox:study-<kurs>`, `salatibox:journey:<id>`) — ein neuer Kurs
//     oder Lernweg ist damit automatisch mitgesichert.
//  2. Eine EXPLIZITE Ausschlussliste mit Begründung statt stillschweigendem
//     Weglassen. Der Test in backupKeys.test.ts liest alle im Quelltext
//     vorkommenden `salatibox:`-Schlüssel ein und verlangt, dass jeder
//     entweder gesichert wird ODER hier mit Grund ausgeschlossen ist — ein
//     neu hinzugefügter, vergessener Schlüssel lässt den Test sofort rot
//     werden statt erst beim Nutzer aufzufallen.

/** Gemeinsames Präfix aller AsyncStorage-Schlüssel der App. */
export const STORAGE_PREFIX = 'salatibox:';

/** Einstellungen — Sonderfall, wird nur AUSSCHNITTSWEISE gesichert (s. u.). */
export const SETTINGS_BACKUP_KEY = 'salatibox:settings';

/**
 * Klasse (a): echte Nutzerdaten, die vollständig (Rohwert 1:1) mitgehen.
 * Reihenfolge = thematisch gruppiert, nicht sicherheitsrelevant.
 */
export const BACKUP_KEYS: readonly string[] = [
  // --- Koran ---
  'salatibox:quran-progress', // Lesezeichen, Notizen, Leseverlauf, zuletzt gelesen
  'salatibox:mushaf-page', // zuletzt gelesene Mushaf-Seite
  'salatibox:khatmah', // laufender Khatmah-Plan (Startdatum + erledigte Tage)
  'salatibox:khatmah-completed-once', // "schon einmal durchgelesen" — Abzeichen-Voraussetzung
  'salatibox:hifz-progress', // auswendig gelernte Verse (known/learning je Sure)

  // --- Lernen / Studium ---
  'salatibox:learn-progress', // Basis-Kurs "Koran lesen lernen"
  'salatibox:study-course-order', // eigene Kurs-Reihenfolge im Studium-Hub
  'salatibox:review', // Wiederholungs-Warteschlange (Spaced Repetition)
  'salatibox:mistakes', // Fehlerarchiv Studium
  'salatibox:writing', // Schreibübung: Fortschritt je arabischem Buchstaben

  // --- Übungs-/Praxis-Statistik ---
  'salatibox:practice-stats', // Übungs-Gesamtstatistik
  'salatibox:practice-days', // Übungstage (Streak-Grundlage)
  'salatibox:practice-days-plays-total', // Gesamtzahl Übungsdurchläufe (Abzeichen)
  'salatibox:practice-mistakes', // Fehlerarchiv Aussprache-/Hörübungen

  // --- Gebet / Fasten ---
  'salatibox:prayer-tracker', // Tages-Gebetstracker
  'salatibox:prayer-qada-owed', // nachzuholende GEBETE, je Gebetsart (s. Dubletten-Hinweis unten)
  'salatibox:taraweeh', // Rakaat je Ramadan-Nacht
  'salatibox:fasting', // Fastentage
  'salatibox:herausforderungen', // Herausforderungen: selbst gezaehlte Stände + erreichte Ziele
  'salatibox:quran-lesetagebuch', // Lesetage und gelesene Suren (Grundlage der Koran-Ziele)
  'salatibox:qada-owed', // nachzuholende FASTENTAGE (s. Dubletten-Hinweis unten)

  // --- Dhikr ---
  'salatibox:tasbih', // Tasbih-Zählerstand
  'salatibox:tasbih-goal', // selbst gesetztes Tagesziel
  'salatibox:tasbih-history', // Tasbih-Verlauf
  'salatibox:tasbih:custom', // selbst angelegte Dhikr-Formeln

  // --- Sonstiges ---
  'salatibox:achievements-seen',
  // Ohne diesen Schlüssel würde der Nutzer nach einem Import mit Unlock-
  // Animationen für längst verdiente Abzeichen überschüttet — die Abzeichen
  // selbst leiten sich aus dem wiederhergestellten Fortschritt ab.
  'salatibox:zakat-anchor',
  // Zakat-Stichtag: manuell gesetztes Datum, aus dem sich die nächste
  // Fälligkeit errechnet. Nicht rekonstruierbar, wenn es der Nutzer vergisst.
  'salatibox:video-progress', // "Weiterschauen"-Position der Lernvideos
  'salatibox:video-playlists', // selbst zusammengestellte Playlists
];

/**
 * Klasse (a), dynamischer Teil: ALLES unter diesen Präfixen wird gesichert.
 * Genau hier verhindert der Präfix-Ansatz die nächste Lücke — ein neuer Kurs
 * (features/study/courses.ts) oder Lernweg (features/themes/journeys.ts)
 * bringt seinen eigenen Schlüssel mit, ohne dass ihn jemand hier nachträgt.
 */
export const BACKUP_KEY_PREFIXES: readonly string[] = [
  'salatibox:study-', // Kursfortschritt je Kurs (COURSE_META[].storageKey)
  'salatibox:journey:', // Fortschritt je Themen-Lernweg (journeyStorageKey)
];

/**
 * Klasse (b)/(c): bewusst NICHT gesichert, mit Begründung. Der Guard-Test
 * liest diese Map — eine Begründung ist damit Pflicht, kein Kommentar.
 */
export const EXCLUDED_KEYS: Readonly<Record<string, string>> = {
  // Verweise auf Dateien, die auf dem Zielgerät gar nicht liegen. Ein
  // mitgesicherter Index würde dort heruntergeladene Inhalte vortäuschen.
  'salatibox:offline-audio': 'Index heruntergeladener Rezitator-Audios — Dateien liegen nur auf diesem Gerät',
  'salatibox:podcast-downloads': 'Index heruntergeladener Podcast-Folgen — Dateien liegen nur auf diesem Gerät',
  'salatibox:handout-downloads': 'Index heruntergeladener Handouts — Dateien liegen nur auf diesem Gerät',
  'salatibox:video-downloads': 'Index heruntergeladener Lernvideos — Dateien liegen nur auf diesem Gerät',

  // Caches: jederzeit neu holbar, teils standortabhängig und auf einem
  // anderen Gerät schlicht falsch.
  'salatibox:query-cache': 'react-query-Cache — reiner Zwischenspeicher, wird neu geholt',
  'salatibox:widget-timings': 'Gebetszeiten-Zwischenspeicher für die Homescreen-Widgets',

  // Diagnose/Technik — kein Nutzerinhalt.
  'salatibox:error-log': 'lokales Fehlerprotokoll (Diagnose), kein Fortschritt',
  'salatibox:ota-last-check': 'Zeitstempel der letzten OTA-Prüfung, gerätegebunden',

  // Einmalige Hinweise/Erststart-Zustand: auf einem NEUEN Gerät sollen sie
  // wieder erscheinen, weil sie sich auf dieses Gerät beziehen
  // (Akku-Optimierung, Kompass-Kalibrierung, Berechtigungs-Abfragen).
  'salatibox:battery-hint-shown': 'einmaliger Hinweis zur Akku-Optimierung — gilt pro Gerät',
  'salatibox:qibla-calibration-hint-seen': 'einmaliger Hinweis zur Kompass-Kalibrierung — gilt pro Gerät',
  'salatibox:rating-prompt-shown': 'einmalige Bewertungs-Abfrage — gilt pro Installation/Store-Konto',
  'salatibox:onboarding-done':
    'Erststart-Assistent richtet Standort + Benachrichtigungs-Berechtigungen auf dem NEUEN Gerät ein und soll dort laufen',
  'salatibox:seenIntros':
    'gesehene Übungs-Erklärungen — dieselbe Klasse wie battery-hint-shown, gerätebezogener Einmal-Hinweis',

  // Grenzfälle (c) mit bewusster Entscheidung gegen die Sicherung:
  'salatibox:ki-verlauf':
    'KI-Chat-Protokoll: kein Fortschritt. Antworten sind wörtliche Zitate aus dem gebündelten Korpus und jederzeit reproduzierbar; freier Text würde den manuell zu kopierenden Sync-Code stark aufblähen (max. 30 Nachrichten)',
  'salatibox:zakat-reminder-enabled':
    'Benachrichtigungs-Schalter — Benachrichtigungs-Berechtigung ist gerätegebunden, gleiche Linie wie bei den Einstellungen. Der eigentliche Inhalt (zakat-anchor) wird gesichert',
  'salatibox:video-prefs':
    'klebrige Player-Schalter (Autoplay/Hintergrundton/Tempo) — Wiedergabe-Verhalten hängt am Gerät, der Fortschritt (video-progress) wird gesichert',
};

/** Wie EXCLUDED_KEYS, aber für dynamisch gebildete Schlüsselfamilien. */
export const EXCLUDED_KEY_PREFIXES: Readonly<Record<string, string>> = {
  'salatibox:timings:': 'Gebetszeiten-Cache je Standort/Methode — wird neu berechnet',
  'salatibox:mosques:': 'Moscheen-Suchergebnisse je Koordinate (Overpass-Cache)',
  'salatibox:halal:': 'Halal-Restaurant-Suchergebnisse je Koordinate (Overpass-Cache)',
  'salatibox:zakat-gold-price-': 'Goldpreis-Cache je Währung — Tageskurs, wird neu geholt',
  'salatibox:course-ver-':
    'Versionsmarke des per OTA nachgeladenen Kurs-JSONs — zeigt auf eine Datei im Dokumentverzeichnis DIESES Geräts',
};

/**
 * Klasse (c), Sonderfall Einstellungen: `salatibox:settings` ist EIN Blob aus
 * inhaltlicher Konfiguration und gerätespezifischen Schaltern. Komplett
 * mitzunehmen wäre falsch (Benachrichtigungs-Berechtigungen, Widget-Thema,
 * Sprachmodell-Wahl, Schriftgröße hängen am jeweiligen Gerät), komplett
 * wegzulassen aber auch: Standort, Berechnungsmethode und vor allem die
 * manuellen Minuten-Korrekturen auf die eigene Moschee sind mühsam erarbeitet.
 *
 * Deshalb ein Feld-Ausschnitt. Aufgenommen wird nur, was die Lebenswirklichkeit
 * des NUTZERS beschreibt (wo er betet, nach welcher Methode, mit welcher
 * Korrektur) — nicht, wie sich dieses eine Gerät verhalten soll. Rezitator,
 * Sprache und Theme bleiben bewusst draußen (dieselbe Entscheidung wie in der
 * ursprünglichen codeSync-Fassung: der Rezitator hängt am lokal geladenen
 * Audio, die Sprache an der Systemsprache des Geräts).
 */
export const PORTABLE_SETTINGS_FIELDS: readonly string[] = [
  'location', // aktiver Standort
  'savedLocations', // gespeicherte Orte ("Zuhause", "Arbeit") — reine Handarbeit
  'homeLocation', // Heimatort für den Reise-Modus
  'travelModeEnabled', // gehört inhaltlich zu homeLocation
  'method', // Berechnungsmethode
  'school', // Madhab (Asr-Berechnung)
  'highLatitudeRule', // Hochbreiten-Regel
  'prayerTimeOffsets', // Minuten-Korrektur je Gebet auf die eigene Moschee
  'iqamaEnabled',
  'iqamaOffsets', // Karenzzeit Adhan→Iqama der eigenen Moschee
  'zakatCurrency', // Währung des Zakat-Rechners
  'dailyMinutes', // Lern-Zeitbudget — steuert Tagesziel/Wiederholungsumfang, gehört zum Lernfortschritt
];

export type StorageKeyClass = 'full' | 'partial' | 'excluded' | 'unclassified';

function matchesPrefix(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => key.startsWith(p));
}

/**
 * Einordnung eines Schlüssels. Ausschlüsse werden ZUERST geprüft, damit ein
 * ausgeschlossener Schlüssel nicht versehentlich über ein Sicherungs-Präfix
 * hereinrutscht.
 */
export function classifyStorageKey(key: string): StorageKeyClass {
  if (key in EXCLUDED_KEYS) return 'excluded';
  if (key === SETTINGS_BACKUP_KEY) return 'partial';
  if (BACKUP_KEYS.includes(key)) return 'full';
  if (matchesPrefix(key, Object.keys(EXCLUDED_KEY_PREFIXES))) return 'excluded';
  if (matchesPrefix(key, BACKUP_KEY_PREFIXES)) return 'full';
  return 'unclassified';
}

/** true = Rohwert wird 1:1 gesichert/zurückgeschrieben (nicht die Einstellungen). */
export function isFullBackupKey(key: string): boolean {
  return classifyStorageKey(key) === 'full';
}

/** Aus einer Liste vorhandener Schlüssel die vollständig zu sichernden herausfiltern. */
export function selectBackupKeys(allKeys: readonly string[]): string[] {
  return allKeys.filter(isFullBackupKey).sort();
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Reduziert die gespeicherten Einstellungen auf die übertragbaren Felder. null = nichts Übertragbares. */
export function pickPortableSettings(raw: string | null): string | null {
  const parsed = parseObject(raw);
  if (!parsed) return null;
  const picked: Record<string, unknown> = {};
  for (const field of PORTABLE_SETTINGS_FIELDS) {
    if (field in parsed) picked[field] = parsed[field];
  }
  return Object.keys(picked).length > 0 ? JSON.stringify(picked) : null;
}

/**
 * Spielt einen Einstellungs-Ausschnitt in die bestehenden Einstellungen ein.
 * Bewusst ein MERGE statt eines Überschreibens: die gerätespezifischen Felder
 * des Zielgeräts (Sprache, Theme, Benachrichtigungen …) bleiben unangetastet.
 * Fremde Felder im Import werden verworfen, damit eine von Hand editierte
 * Sicherungsdatei keine beliebigen Werte in die Einstellungen schreiben kann.
 */
export function mergePortableSettings(currentRaw: string | null, importedRaw: string): string | null {
  const imported = parseObject(importedRaw);
  if (!imported) return null;
  const merged: Record<string, unknown> = { ...(parseObject(currentRaw) ?? {}) };
  let changed = false;
  for (const field of PORTABLE_SETTINGS_FIELDS) {
    if (field in imported) {
      merged[field] = imported[field];
      changed = true;
    }
  }
  return changed ? JSON.stringify(merged) : null;
}

/**
 * Liest ALLE zu sichernden Werte aus AsyncStorage. Arbeitet über
 * `getAllKeys()` + Klassifizierung statt über eine feste Liste — deshalb
 * landen auch Schlüssel im Backup, die es zum Zeitpunkt dieses Releases noch
 * gar nicht gab, solange sie unter einem Sicherungs-Präfix liegen.
 */
export async function collectBackupValues(): Promise<Record<string, string>> {
  const allKeys = await AsyncStorage.getAllKeys();
  const values: Record<string, string> = {};

  const entries = await AsyncStorage.multiGet(selectBackupKeys(allKeys));
  for (const [key, value] of entries) {
    if (value != null) values[key] = value;
  }

  const settings = pickPortableSettings(await AsyncStorage.getItem(SETTINGS_BACKUP_KEY));
  if (settings != null) values[SETTINGS_BACKUP_KEY] = settings;

  return values;
}

/**
 * Schreibt gesicherte Werte zurück und liefert die tatsächlich übernommenen
 * Schlüssel. Alles, was nicht klassifiziert gesichert wird, wird ignoriert —
 * eine manipulierte/fremde Sicherung kann so keine beliebigen Schlüssel setzen.
 */
export async function restoreBackupValues(values: Record<string, unknown>): Promise<string[]> {
  const writes: [string, string][] = [];

  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string') continue;
    if (isFullBackupKey(key)) writes.push([key, value]);
  }

  const importedSettings = values[SETTINGS_BACKUP_KEY];
  if (typeof importedSettings === 'string') {
    const merged = mergePortableSettings(await AsyncStorage.getItem(SETTINGS_BACKUP_KEY), importedSettings);
    if (merged != null) writes.push([SETTINGS_BACKUP_KEY, merged]);
  }

  if (writes.length > 0) await AsyncStorage.multiSet(writes);
  return writes.map(([key]) => key);
}

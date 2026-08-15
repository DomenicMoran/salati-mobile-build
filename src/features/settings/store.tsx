import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { BEST_TAFSIRS, BEST_TRANSLATIONS } from '@/features/quran/api';
import { setRecitationModel } from '@/features/hifz/whisperModel';
import { detectDeviceLocale } from '@/lib/locale-detect';
import { ensureLocale, preloadLocale } from '@/lib/translate';
import { AppSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, migrateAzanChoice } from './types';

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  /** Persistiert das Patch; das zurückgegebene Promise löst nach dem Schreiben
   *  in AsyncStorage auf (z. B. um danach Homescreen-Widgets neu zu zeichnen). */
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // Immer aktueller Settings-Stand für update() — vermeidet ein veraltetes
  // Merge bei mehreren synchronen update()-Aufrufen und erlaubt es, das
  // AsyncStorage-Schreib-Promise deterministisch zurückzugeben. Wird per Effekt
  // (nicht während des Renderns) synchron gehalten; update() setzt den Ref
  // zusätzlich sofort im Event-Handler, damit direkt aufeinanderfolgende
  // update()-Aufrufe korrekt mergen.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then(async (raw) => {
        if (cancelled) return;
        if (!raw) {
          // Erster Start — Gerätesprache übernehmen und die beste
          // Koran-Übersetzung für diese Sprache voreinstellen.
          const language = detectDeviceLocale();
          // Nur de/en sind statisch gebündelt (s. lib/translate.ts). Die
          // Sprachdatei VOR dem Anwenden der Settings holen, sonst rendert der
          // erste Frame deutsch und springt einen Tick später um. Nach
          // spätestens 1,5 s wird ohne sie weitergemacht (Fallback de/en).
          await preloadLocale(language);
          if (cancelled) return;
          const first: AppSettings = {
            ...DEFAULT_SETTINGS,
            language,
            quranTranslation: BEST_TRANSLATIONS[language] ?? DEFAULT_SETTINGS.quranTranslation,
            quranTafsirs: [BEST_TAFSIRS[language] ?? DEFAULT_SETTINGS.quranTafsirs[0]],
            // Hadith in der Gerätesprache, soweit vorhanden — resolveHadithLang()
            // fällt je Sammlung sauber auf Englisch zurück und das UI weist
            // darauf hin (vorher startete jeder Nutzer auf Englisch).
            hadithLanguage: language,
            // Reise-Modus-Heimatort: der zu diesem Zeitpunkt aktive
            // (Default-)Standort dient als erste Näherung für "Heimat".
            homeLocation: DEFAULT_SETTINGS.homeLocation ?? DEFAULT_SETTINGS.location,
          };
          setSettings(first);
          // Audit 2026-07-27 (O6): der abgeleitete Erststart-Stand wurde NICHT
          // geschrieben. Der Zweig lief bei jedem Start erneut — und er ist nur
          // solange idempotent, wie `detectDeviceLocale()` dasselbe liefert:
          // wechselt der Nutzer die Systemsprache, bevor er in der App etwas
          // ändert, kippen Sprache, Koran-Übersetzung, Tafsir UND Hadith-Sprache
          // stillschweigend mit. Einmal persistieren beendet das (gleiches
          // Muster wie der Migrationspfad für homeLocation unten).
          AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(first)).catch(() => {});
          return;
        }
        try {
          const parsed = JSON.parse(raw) as Partial<AppSettings>;
          // Migration: alter Default war ar.muyassar für ALLE Sprachen —
          // Nicht-Arabisch-Nutzer, die ihn nie angefasst haben, bekommen
          // den englischen Standard-Tafsir (bewusste Auswahl bleibt erhalten).
          if (
            parsed.language !== 'ar' &&
            parsed.quranTafsirs?.length === 1 &&
            parsed.quranTafsirs[0] === 'ar.muyassar'
          ) {
            parsed.quranTafsirs = [BEST_TAFSIRS[parsed.language ?? 'de'] ?? 'qc.169'];
          }
          // Migration: Reise-Modus-Heimatort fehlt (Update von einer älteren
          // Version ohne dieses Feld) — den aktuell aktiven Standort einmalig
          // als Heimat übernehmen UND persistieren. Ohne das Persistieren
          // würde jeder App-Start den Heimatort erneut auf den dann aktiven
          // Standort zurücksetzen und die Reise-Erkennung nie greifen.
          // Migration: die fünf bis 2026-07-28 mitgelieferten Adhan-Aufnahmen
          // (azan8/9/12/14/20) sind entfallen, weil sich für sie keine
          // Freigabe belegen ließ (docs/audit-2026-07-27/ADHAN-LIZENZEN.md).
          // Gespeicherte Auswahlen zeigen sonst auf nicht mehr vorhandene
          // Assets: der Adhan-Button bliebe stumm und der Notification-Channel
          // fiele auf den System-Standardton zurück, ohne dass das in den
          // Einstellungen sichtbar wäre.
          const azanVorher = JSON.stringify([parsed.azanChoice, parsed.azanNotificationChoices]);
          if (parsed.azanChoice !== undefined) {
            parsed.azanChoice = migrateAzanChoice(parsed.azanChoice, null);
          }
          if (parsed.azanNotificationChoices) {
            const alt = parsed.azanNotificationChoices;
            parsed.azanNotificationChoices = {
              fajr: migrateAzanChoice(alt.fajr, 'fajr'),
              dhuhr: migrateAzanChoice(alt.dhuhr, 'dhuhr'),
              asr: migrateAzanChoice(alt.asr, 'asr'),
              maghrib: migrateAzanChoice(alt.maghrib, 'maghrib'),
              isha: migrateAzanChoice(alt.isha, 'isha'),
            };
          }
          if (JSON.stringify([parsed.azanChoice, parsed.azanNotificationChoices]) !== azanVorher) {
            AsyncStorage.setItem(
              SETTINGS_STORAGE_KEY,
              JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }),
            ).catch(() => {});
          }
          if (!parsed.homeLocation) {
            parsed.homeLocation = parsed.location ?? DEFAULT_SETTINGS.location;
            AsyncStorage.setItem(
              SETTINGS_STORAGE_KEY,
              JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }),
            ).catch(() => {});
          }
          if (parsed.language) {
            await preloadLocale(parsed.language);
            if (cancelled) return;
          }
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {
          // corrupt cache — ignore, keep defaults
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // whisperModel.ts hält die Modell-Wahl als synchrone Modul-Variable (damit die
  // Download-/Pfad-Funktionen nicht bei jedem Aufruf AsyncStorage lesen müssen) —
  // bei Laden und jeder Änderung der Auswahl spiegeln.
  useEffect(() => {
    setRecitationModel(settings.recitationModel);
  }, [settings.recitationModel]);

  function update(patch: Partial<AppSettings>): Promise<void> {
    // Sprachwechsel: Nachladen sofort im Event-Handler anstoßen (nicht erst im
    // Render des nächsten Frames), damit die neuen Texte ohne sichtbare
    // Verzögerung stehen. useTranslation rendert neu, sobald die Datei da ist.
    if (patch.language) void ensureLocale(patch.language);
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    return AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
      .then(() => {})
      .catch(() => {});
  }

  function reset() {
    setSettings(DEFAULT_SETTINGS);
    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)).catch(() => {});
  }

  const value = useMemo(() => ({ settings, loaded, update, reset }), [settings, loaded]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

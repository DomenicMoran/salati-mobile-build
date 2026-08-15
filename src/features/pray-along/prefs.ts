import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Anzeige-Einstellungen für den "Gebet mitbeten"-Screen (Schriftgröße, welche
// Elemente sichtbar sind, Reihenfolge). Bewusst als EIGENER AsyncStorage-Key
// gehalten (nicht im globalen Settings-Store): es ist eine reine
// Screen-Präferenz, die niemand sonst braucht — analog zu features/onboarding/
// flag.ts. So bleibt der Screen self-contained und ein Settings-Reset lässt
// diese Wahl unangetastet.

export const PRAY_ALONG_PREFS_KEY = 'salati.prayalong.prefs';

export type PrayAlongFontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface PrayAlongPrefs {
  /** Schriftgröße für Umschrift (Held), Übersetzung und arabischen Text. */
  fontSize: PrayAlongFontSize;
  /** Übersetzung anzeigen. */
  showTranslation: boolean;
  /** Arabischen Wortlaut anzeigen. */
  showArabic: boolean;
  /** Hinweise (Handlungsanweisungen) anzeigen. */
  showNotes: boolean;
  /** true = arabischer Text zuerst, false = Umschrift zuerst (Standard). */
  arabicFirst: boolean;
  /** Witr: zusätzliche Sure auch in der 3. Rak'ah (je nach Rechtsschule).
   *  Standard false — die verbreitete Vereinfachung liest die Sure nur in den
   *  ersten beiden Rak'ah; wer der klassischen hanafitischen Form folgt, kann
   *  sie hier aktivieren. Der In-App-Hinweis empfiehlt Rücksprache mit einem
   *  Gelehrten. */
  witrSurahInThird: boolean;
}

export const DEFAULT_PRAY_ALONG_PREFS: PrayAlongPrefs = {
  fontSize: 'medium',
  showTranslation: true,
  showArabic: true,
  showNotes: true,
  arabicFirst: false,
  witrSurahInThird: false,
};

export const FONT_SIZE_OPTIONS: PrayAlongFontSize[] = ['small', 'medium', 'large', 'xlarge'];

/** Skalierungsfaktor je Schriftgröße (medium = 1, entspricht den Basiswerten). */
export const FONT_SCALE: Record<PrayAlongFontSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2,
  xlarge: 1.45,
};

function isFontSize(v: unknown): v is PrayAlongFontSize {
  return v === 'small' || v === 'medium' || v === 'large' || v === 'xlarge';
}

/** Rohen Speicher-String defensiv in gültige Prefs überführen (Teil-Objekte,
 *  falsche Typen und Unlesbares fallen auf die Standardwerte zurück). */
export function parsePrefs(raw: string | null): PrayAlongPrefs {
  if (!raw) return DEFAULT_PRAY_ALONG_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof PrayAlongPrefs, unknown>>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PRAY_ALONG_PREFS;
    return {
      fontSize: isFontSize(parsed.fontSize) ? parsed.fontSize : DEFAULT_PRAY_ALONG_PREFS.fontSize,
      showTranslation:
        typeof parsed.showTranslation === 'boolean'
          ? parsed.showTranslation
          : DEFAULT_PRAY_ALONG_PREFS.showTranslation,
      showArabic:
        typeof parsed.showArabic === 'boolean' ? parsed.showArabic : DEFAULT_PRAY_ALONG_PREFS.showArabic,
      showNotes:
        typeof parsed.showNotes === 'boolean' ? parsed.showNotes : DEFAULT_PRAY_ALONG_PREFS.showNotes,
      arabicFirst:
        typeof parsed.arabicFirst === 'boolean' ? parsed.arabicFirst : DEFAULT_PRAY_ALONG_PREFS.arabicFirst,
      witrSurahInThird:
        typeof parsed.witrSurahInThird === 'boolean'
          ? parsed.witrSurahInThird
          : DEFAULT_PRAY_ALONG_PREFS.witrSurahInThird,
    };
  } catch {
    return DEFAULT_PRAY_ALONG_PREFS;
  }
}

/**
 * Lädt die Prefs einmalig beim Mount und schreibt bei jeder Änderung fort.
 * Persistenz-Fehler werden bewusst geschluckt — schlimmstenfalls gilt beim
 * nächsten Start wieder der Standard.
 */
export function usePrayAlongPrefs() {
  const [prefs, setPrefs] = useState<PrayAlongPrefs>(DEFAULT_PRAY_ALONG_PREFS);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PRAY_ALONG_PREFS_KEY)
      .then((raw) => {
        if (!cancelled) setPrefs(parsePrefs(raw));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<PrayAlongPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(PRAY_ALONG_PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { prefs, update };
}

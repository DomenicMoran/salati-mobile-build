// Lädt die in den Einstellungen gewählte Koran-Schrift und liefert den
// fertigen Text-Style dazu.
//
// Bewusst NACHLADEND statt alle vier Schriften beim Start: zusammen sind das
// rund 950 KB, die auf Home-, Gebetszeiten- und Lern-Screens niemand braucht.
// Geladen wird immer nur die aktive Schrift; solange sie nicht da ist, bleibt
// `fontFamily` undefiniert (System-Schrift) — dieselbe bewusste Entscheidung
// wie in app/_layout.tsx: lieber kurz die Systemschrift als ein leerer Frame.
//
// Die Dateien liegen trotzdem alle im Bundle (require unten): die App muss
// offline umschaltbar sein, ein Nachladen per Netz wäre keine Option.
import * as Font from 'expo-font';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { TextStyle } from 'react-native';

import { useSettings } from '@/features/settings/store';
import {
  ARABIC_FONT_FEATURES,
  adaptQuranText,
  arabicMetrics,
  quranFontDef,
  type ArabicMetrics,
  type QuranFontDef,
  type QuranFontId,
} from './fonts';

const FONT_ASSETS: Record<QuranFontId, number> = {
  kfgqpc: require('@/assets/fonts/kfgqpc-hafs.ttf'),
  'amiri-quran': require('@/assets/fonts/amiri-quran.ttf'),
  amiri: require('@/assets/fonts/amiri.ttf'),
  scheherazade: require('@/assets/fonts/scheherazade-new.ttf'),
  lateef: require('@/assets/fonts/lateef.ttf'),
  harmattan: require('@/assets/fonts/harmattan.ttf'),
  noto: require('@/assets/fonts/noto-naskh-arabic.ttf'),
  'noto-sans': require('@/assets/fonts/noto-sans-arabic.ttf'),
};

/** Fehlgeschlagene Ladeversuche merken, damit ein kaputtes Asset nicht bei
 *  jedem Render erneut versucht wird (und die Systemschrift stabil bleibt). */
const failed = new Set<QuranFontId>();
/** Wer auf „Schrift ist jetzt da" wartet (useSyncExternalStore-Abonnenten). */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Lädt eine Koran-Schrift einmalig. `Font.loadAsync` fasst parallele Aufrufe
 * für denselben Namen selbst zusammen, ein eigener Promise-Cache erübrigt sich.
 */
function ensureLoaded(id: QuranFontId): void {
  const def = quranFontDef(id);
  if (Font.isLoaded(def.family) || failed.has(id)) return;
  Font.loadAsync({ [def.family]: FONT_ASSETS[id] })
    .then(notify)
    .catch(() => {
      // Schrift nicht ladbar → Systemschrift. Kein Absturz, keine
      // Endlosschleife; der Text bleibt lesbar.
      failed.add(id);
    });
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * Familienname der Schrift, sobald sie geladen ist — sonst `undefined`
 * (Systemschrift).
 *
 * Bewusst über `useSyncExternalStore` statt über einen State, den ein Effekt
 * setzt: der Ladezustand von expo-font ist ein EXTERNER Zustand, den mehrere
 * Komponenten gleichzeitig lesen. Ein `setState` im Effekt würde zusätzlich
 * eine Render-Kaskade auslösen (Lint-Regel react-hooks/set-state-in-effect)
 * und beim statischen Web-Export den bekannten Hydrations-Sprung erzeugen.
 */
export function useQuranFontFamily(id: QuranFontId): string | undefined {
  const def = quranFontDef(id);
  const getSnapshot = useCallback(
    () => (Font.isLoaded(def.family) ? def.family : undefined),
    [def.family],
  );
  // Server-Snapshot identisch: beim Web-Vorrendern ist keine Schrift geladen,
  // der erste Client-Render muss dasselbe ergeben.
  const family = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureLoaded(id);
  }, [id]);

  return family;
}

export interface QuranFontResult {
  /** Definition der gewählten Schrift (auch wenn sie noch lädt). */
  def: QuranFontDef;
  /** Registrierter Familienname — `undefined`, solange die Schrift lädt. */
  family: string | undefined;
  /**
   * Fertiger Text-Style: Schriftfamilie + die arabischen OpenType-Merkmale
   * (auf Web explizit angefordert, nativ Standard des Shapers).
   */
  style: TextStyle;
  /** Schriftgrad/Zeilenhöhe der gewählten Schrift zu einem Basiswert. */
  metrics: (baseSize: number, baseLineHeight: number) => ArabicMetrics;
  /**
   * Schreibt Korantext in die Kodierung um, die die gewählte Schrift erwartet
   * (s. `adaptQuranText`). NUR fürs Rendern — gespeicherte Daten, Suche und
   * Wort-Abgleich bleiben in der Unicode-Schreibweise von api.quran.com.
   */
  text: (arabic: string) => string;
}

/**
 * Die aktuell eingestellte Koran-Schrift samt Style und Maßen.
 *
 * `override` setzt die Einstellung gezielt außer Kraft — gebraucht für das
 * IndoPak-Schriftbild, das nicht jede Schrift setzen kann
 * (s. `quranFontForScript`). `true` bleibt der Normalfall: die Einstellung gilt.
 */
export function useQuranFont(override?: QuranFontId): QuranFontResult {
  const { settings } = useSettings();
  const def = quranFontDef(override ?? settings.quranFont);
  const family = useQuranFontFamily(def.id);
  return {
    def,
    family,
    style: { fontFamily: family, ...ARABIC_FONT_FEATURES },
    // Solange die Schrift lädt, gelten die Maße der System-Schrift (Faktor 1) —
    // sonst springt der Text beim Nachladen zweimal in der Größe.
    metrics: (baseSize, baseLineHeight) =>
      family ? arabicMetrics(def.id, baseSize, baseLineHeight) : { fontSize: baseSize, lineHeight: baseLineHeight },
    // Solange die Schrift noch lädt, zeigt die Systemschrift den Text — die
    // versteht die KFGQPC-Schreibweise nicht und würde sie falsch darstellen.
    text: (arabic) => (family ? adaptQuranText(arabic, def, settings.quranSukun) : arabic),
  };
}

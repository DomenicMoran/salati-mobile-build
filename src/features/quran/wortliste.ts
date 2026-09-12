// Datei-Cache für die Wortliste einer Sure (quran.com, Wort-für-Wort-Ebene).
//
// WARUM DIESE SCHICHT ÜBERHAUPT: die Ablage des Query-Caches ist auf Android
// EINE AsyncStorage-Zeile (SQLite). CursorWindow liest eine Zeile höchstens
// ~2 MB groß, darüber verwirft der Persister den GESAMTEN abgelegten Cache
// ("the persisted cache will be discarded") — das Offline-Paket war dann bei
// jedem Start weg. Die Wortliste ist der mit Abstand größte Einzelposten:
// allein Sure 2 wog gemessen 1.078.748 Bytes, nach zwei gelesenen Suren lag
// die Zeile bei 1,83 MB. Sie einfach aus der Ablage zu nehmen hätte echte
// Offline-Fähigkeit gekostet, weil sie — anders als Morphologie
// (./morphologie.ts) und die Wort-für-Wort-Datensätze (./wbw.ts) — bisher
// keinen Datei-Cache hatte. Diese Datei schließt genau diese Lücke; danach
// darf lib/queryClient.ts (sollInDieAblage) ['quran','word-by-word',n]
// ausnehmen, ohne dass offline etwas verloren geht.
//
// MUSTER: wie ./wbw.ts und ./morphologie.ts — Cache im Dokumentverzeichnis
// prüfen, sonst laden, Inhalt validieren, kaputten Cache verwerfen statt
// abzustürzen, parallele Anfragen derselben Sure deduplizieren. Web hat kein
// Dateisystem; dort bleibt es beim reinen Netz-Abruf (React Query
// zwischenspeichert im Arbeitsspeicher, siehe ./hooks.ts).
//
// ---- WIE DIESER CACHE UNGÜLTIG WIRD (und warum anders als bei wbw.ts) ----
//
// Morphologie und Wort-für-Wort liegen unter einem VERSIONIERTEN, „immutable"
// ausgelieferten R2-Pfad: dieselbe URL liefert für immer denselben Inhalt,
// „veraltet" kann es dort nicht geben — entweder der Cache ist gültig oder er
// ist es nicht. Die quran.com-Antwort ist das ausdrücklich NICHT. Deshalb hat
// die abgelegte Datei drei voneinander unabhängige Ungültigkeits-Gründe:
//
//  1. `schema` — die FORM der abgelegten Daten. Gespeichert wird nicht die
//     rohe Antwort, sondern das Ergebnis von parseWordByWordResponse (./api.ts,
//     Typ QuranWord: arabic/translation/transliteration/audioUrl/tajweedRules).
//     Ändert sich dieser Typ oder die Umwandlung, wird
//     {@link WORTLISTE_SCHEMA_VERSION} hochgezählt und jede ältere Datei fällt
//     durch die Prüfung. (Der Pfad trägt die Version bewusst NICHT: anders als
//     bei einer CDN-URL überschreibt der nächste Lauf die Datei am selben Ort,
//     ein Versionsordner ließe nur unerreichbare Altlasten auf dem Gerät
//     liegen — gleiche Wahl wie beim lokalen Morphologie-Cache.)
//
//  2. `quelle` — die exakte Anfrage-URL ({@link wordByWordUrl}). Sie trägt die
//     angeforderten `word_fields` und `per_page`; wird dort ein Feld ergänzt
//     (oder der Host gewechselt), passt die alte Datei nicht mehr zur neuen
//     Anfrage und wird verworfen, statt stillschweigend ein fehlendes Feld
//     vorzutäuschen. Was in dieser URL bewusst NICHT vorkommt, ist genauso
//     wichtig: weder Übersetzungs-Edition noch Rezitator. quran.com liefert die
//     Wort-Bedeutung ausschließlich auf Englisch (weder `language` noch
//     `word_translation_language` ändern das, live geprüft — siehe ./api.ts),
//     und `audio_url` zeigt immer auf dieselben Einzelwort-Dateien unter
//     WORD_AUDIO_BASE, unabhängig vom gewählten Rezitator. Ein Übersetzer- oder
//     Rezitatorwechsel kann diesen Cache also gar nicht falsch machen; er darf
//     ihn deshalb auch nicht wegwerfen.
//
//  3. `geladenAm` + {@link WORTLISTE_MAX_ALTER_MS} — der einzige verbleibende
//     Weg, auf dem der Inhalt veralten kann: quran.com korrigiert seine Daten
//     unter unveränderter URL (Tippfehler in einer Glosse, ergänzte
//     Tajwid-Auszeichnung). Ohne Verfallsdatum hielte EIN Download die
//     Wortliste für immer auf dem Gerät fest — schlimmer als der Zustand vor
//     diesem Cache. Nach Ablauf wird deshalb neu geladen.
//
// RÜCKFALL AUF DEN VERALTETEN STAND (bewusste Abweichung von ./wbw.ts):
// scheitert die Auffrischung einer abgelaufenen Datei (kein Netz, 5xx), wird
// der alte Stand zurückgegeben statt ein Fehler geworfen. Das ist hier richtig
// und in wbw.ts falsch: dort gibt es keinen veralteten Stand, hier schon — und
// der Vergleichsmaßstab ist der Zustand VOR diesem Cache, wo der Eintrag nach
// QUERY_PERSIST_MAX_AGE (24 Tage) ohnehin aus der Ablage geflogen wäre und
// offline gar nichts mehr da war. Eine 31 Tage alte Wortliste ohne Netz ist in
// jedem Fall besser als keine; sobald das Netz wieder da ist, frischt der
// nächste Aufruf sie auf. Der Rückfall wird protokolliert (lib/errorLog.ts),
// damit er im Support-Fehlerbericht sichtbar ist und nicht still passiert.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { logError } from '@/lib/errorLog';

import { fetchSurahWordByWord, wordByWordUrl, type QuranWord } from './api';

/** Form der abgelegten Daten (nicht der Anfrage — die steckt in `quelle`).
 * Hochzählen, sobald QuranWord oder parseWordByWordResponse sich ändern. */
export const WORTLISTE_SCHEMA_VERSION = 1;

/** Ab diesem Alter wird die abgelegte Wortliste neu geladen. 30 Tage: quran.com
 * ändert an der Wort-Ebene praktisch nichts (Korrekturen einzelner Glossen),
 * gleichzeitig darf kein Gerät auf einem Stand festhängen. Der Wert liegt
 * bewusst ÜBER QUERY_PERSIST_MAX_AGE (24 Tage, lib/queryClient.ts) — die
 * Wortliste überdauert damit mindestens so lange wie vorher in der Ablage. */
export const WORTLISTE_MAX_ALTER_MS = 30 * 24 * 60 * 60 * 1000;

/** Was auf der Platte liegt: die geparsten Wörter je Vers plus die drei
 * Angaben, an denen die Gültigkeit hängt (siehe Kopf-Kommentar). */
export interface WortlisteDatei {
  schema: number;
  surah: number;
  /** Exakte Anfrage-URL, aus der der Inhalt stammt. */
  quelle: string;
  /** Zeitpunkt des Downloads (ms seit Epoche). */
  geladenAm: number;
  /** Wörter je Vers, Index = Vers-Reihenfolge (wie fetchSurahWordByWord). */
  verses: QuranWord[][];
}

/**
 * Ablageort der zwischengespeicherten Wortlisten (eine Datei je Sure).
 * Exportiert für die Speicherverwaltung (features/settings/storage.ts) — sie
 * rechnet Größe und Löschung über DIESEN Pfad statt ihn nachzubauen.
 */
export function wortlisteDatenVerzeichnis(): string {
  return `${FileSystem.documentDirectory}wortliste/`;
}

function cacheVerzeichnis(): string {
  return wortlisteDatenVerzeichnis();
}

export function wortlisteCachePfad(surah: number): string {
  return `${cacheVerzeichnis()}${surah}.json`;
}

/** Auf Web gibt es kein Dateisystem — dort bleibt es beim reinen Netz-Abruf. */
function hatDateisystem(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

function istWort(wort: unknown): boolean {
  if (!wort || typeof wort !== 'object') return false;
  const w = wort as Partial<QuranWord>;
  return (
    typeof w.arabic === 'string' &&
    typeof w.translation === 'string' &&
    typeof w.transliteration === 'string' &&
    (w.audioUrl === null || typeof w.audioUrl === 'string') &&
    Array.isArray(w.tajweedRules)
  );
}

/**
 * Schema, Sure, Anfrage-URL, Zeitstempel und Wortform prüfen — für Dateien von
 * der Platte gedacht. Geprüft wird JEDES Wort: die Prüfung besteht aus
 * `typeof`-Vergleichen und fällt neben dem JSON.parse derselben Datei nicht
 * ins Gewicht, fängt dafür aber auch eine halb geschriebene Datei (abgestürzt
 * mitten im Schreiben) und nicht nur einen falschen Kopf.
 */
export function istGueltigeWortliste(datei: unknown, surah: number): datei is WortlisteDatei {
  if (!datei || typeof datei !== 'object') return false;
  const d = datei as Partial<WortlisteDatei>;
  if (d.schema !== WORTLISTE_SCHEMA_VERSION) return false;
  if (d.surah !== surah) return false;
  if (d.quelle !== wordByWordUrl(surah)) return false;
  if (typeof d.geladenAm !== 'number' || !Number.isFinite(d.geladenAm)) return false;
  if (!Array.isArray(d.verses) || d.verses.length === 0) return false;
  return d.verses.every((vers) => Array.isArray(vers) && vers.length > 0 && vers.every(istWort));
}

/**
 * Ist die Datei jung genug, um ohne Netz-Abruf benutzt zu werden?
 *
 * Ein Zeitstempel aus der ZUKUNFT (`alter < 0`) gilt als nicht frisch: er
 * entsteht, wenn die Gerätezeit zurückgestellt wurde, und würde die Datei sonst
 * bis zum Erreichen dieses Datums unantastbar machen. Nicht frisch heißt hier
 * nur „neu laden versuchen" — offline bleibt der Stand über den Rückfall
 * trotzdem nutzbar.
 */
export function istFrischeWortliste(datei: WortlisteDatei, jetzt: number): boolean {
  const alter = jetzt - datei.geladenAm;
  return alter >= 0 && alter < WORTLISTE_MAX_ALTER_MS;
}

async function ausCacheLesen(surah: number): Promise<WortlisteDatei | null> {
  if (!hatDateisystem()) return null;
  const pfad = wortlisteCachePfad(surah);
  try {
    const info = await FileSystem.getInfoAsync(pfad);
    if (!info.exists || (info.size ?? 0) <= 0) return null;
    const roh = await FileSystem.readAsStringAsync(pfad);
    const datei = JSON.parse(roh) as unknown;
    if (!istGueltigeWortliste(datei, surah)) return null;
    return datei;
  } catch (err) {
    // Beschädigter Cache darf die Wort-Ansicht nicht lahmlegen: Datei weg,
    // danach neu laden — analog zu ./morphologie.ts und ./wbw.ts.
    void logError(err, `wortliste: Cache lesen (Sure ${surah})`);
    await FileSystem.deleteAsync(pfad, { idempotent: true }).catch(() => {});
    return null;
  }
}

async function inCacheSchreiben(surah: number, datei: WortlisteDatei): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.makeDirectoryAsync(cacheVerzeichnis(), { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(wortlisteCachePfad(surah), JSON.stringify(datei)).catch((err: unknown) =>
    // Nur protokollieren: ohne Cache wird beim nächsten Öffnen erneut geladen —
    // ärgerlich, aber kein Grund, die Wort-Ansicht zu blockieren.
    logError(err, `wortliste: Cache schreiben (Sure ${surah})`),
  );
}

const laufend = new Map<number, Promise<QuranWord[][]>>();

/**
 * Wortliste einer Sure: zuerst der lokale Cache (Dokumentverzeichnis), sonst
 * quran.com. Parallele Aufrufe derselben Sure lösen genau einen Abruf aus.
 *
 * Wirft nur, wenn es WEDER einen brauchbaren Cache NOCH eine Antwort gibt —
 * der Aufrufer (React Query, ./hooks.ts) zeigt dann den Fehlerzustand.
 */
export function ladeSurahWortliste(surah: number): Promise<QuranWord[][]> {
  const bereits = laufend.get(surah);
  if (bereits) return bereits;

  const auftrag = (async (): Promise<QuranWord[][]> => {
    try {
      const gecacht = await ausCacheLesen(surah);
      if (gecacht && istFrischeWortliste(gecacht, Date.now())) return gecacht.verses;

      try {
        const verses = await fetchSurahWordByWord(surah);
        await inCacheSchreiben(surah, {
          schema: WORTLISTE_SCHEMA_VERSION,
          surah,
          quelle: wordByWordUrl(surah),
          geladenAm: Date.now(),
          verses,
        });
        return verses;
      } catch (err) {
        if (!gecacht) throw err;
        void logError(err, `wortliste: Auffrischung fehlgeschlagen, veralteter Stand (Sure ${surah})`);
        return gecacht.verses;
      }
    } finally {
      laufend.delete(surah);
    }
  })();
  laufend.set(surah, auftrag);
  return auftrag;
}

/**
 * Löscht alle zwischengespeicherten Wortlisten. Verlustfrei: die Listen kommen
 * von quran.com und werden beim nächsten Aufruf neu geladen. Ohne Netz steht
 * die Wort-für-Wort-Ansicht danach bis zum nächsten erfolgreichen Abruf nicht
 * zur Verfügung.
 */
export async function wortlisteCacheLoeschen(): Promise<void> {
  if (!hatDateisystem()) return;
  await FileSystem.deleteAsync(wortlisteDatenVerzeichnis(), { idempotent: true }).catch(() => {});
}

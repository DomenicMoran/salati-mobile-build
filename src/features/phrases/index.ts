// Gebräuchliche islamische Formeln + Ablauf der Freitagspredigt.
//
// Warum als eigene Sektion und nicht in guides.json: die Guides beschreiben
// HANDLUNGEN (wie man Wudu macht, wie man betet). Hier geht es um SÄTZE — was
// gesagt wird, was es heißt und was man darauf antwortet. Der Guide „Das
// Freitagsgebet“ bleibt der Ablauf; diese Sektion ergänzt, was der Imam dabei
// spricht.
//
// Sprachabdeckung: VOLLSTÄNDIG in allen 14 App-Sprachen — arabischer Wortlaut
// und Umschrift sind ohnehin sprachunabhängig, Bedeutung/Anlass/Antwort liegen
// je Sprache vor. `phrases.test.ts` prüft das feldgenau über alle Sprachen
// (dieselbe Logik wie features/content-i18n.test.ts für die übrigen
// Inhaltsdateien): ein neuer Eintrag ohne Übersetzung lässt die Suite fallen,
// statt im UI still auf Englisch zurückzufallen.
import { resolveText, type LocalizedText } from '@/features/guides/hooks';
import phrasesData from './phrases.json';

export type { LocalizedText };
export { resolveText };

export interface PhraseReply {
  arabic: string;
  translit: string;
  meaning: LocalizedText;
}

export interface Phrase {
  id: string;
  /** Arabischer Wortlaut. Leer bei Einträgen, die nur einen Ablaufschritt
   *  beschreiben (z. B. das Sitzen zwischen den beiden Khutbas). */
  arabic: string;
  translit: string;
  meaning: LocalizedText;
  /** Wann und warum das gesagt wird. */
  when: LocalizedText;
  /** Feststehende Erwiderung, sofern es eine gibt. */
  reply?: PhraseReply;
  /** Klassischer Primärbeleg — gleiche Schreibweise wie in guides.json. */
  source?: string;
}

export interface PhraseGroup {
  id: string;
  icon: string;
  title: LocalizedText;
  intro: LocalizedText;
  items: Phrase[];
}

export const PHRASE_GROUPS: PhraseGroup[] = (phrasesData as { groups: PhraseGroup[] }).groups;
export const PHRASES_DATASET_NOTE: string = (phrasesData as { note: string }).note;

export function phraseGroupById(id: string): PhraseGroup | undefined {
  return PHRASE_GROUPS.find((g) => g.id === id);
}

// Zeigt einmalig ein Erklärungs-Sheet (IntroSheet-Muster, siehe
// components/ui/intro-sheet.tsx: "Was" + "Warum"), sobald jemand zum ERSTEN
// Mal eine Grammatik-Funktion des Readers einschaltet — einen Farbmodus
// (GrammarModeBar) ODER die Satzstruktur. Beide teilen sich denselben
// Hinweis: beide zeigen dieselbe zugrunde liegende QAC-Morphologie, nur auf
// Wort- bzw. Satzebene (Auftrag: "wenn jemand eine Grammatik-Funktion zum
// ersten Mal einschaltet, soll er verstehen, was er jetzt sieht"). Reopen
// jederzeit über den "?"-Button neben der Abschnittsüberschrift
// (IntroHelpButton-Muster, wie bei den Übungstypen in learn/quiz).
//
// Eigener, schlanker Speicher statt Wiederverwendung von useExerciseIntro:
// jener Hook zeigt automatisch beim MOUNT eines Screens — hier soll das
// Sheet dagegen genau beim ersten TOGGLE-Antippen erscheinen, nicht beim
// Öffnen des Readers.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'salati:quran:grammatikIntroSeen';

export interface UseGrammatikIntro {
  /** Sheet gerade sichtbar. */
  visible: boolean;
  /** Bei der ersten Aktivierung von Farbmodus/Satzstruktur aufrufen — öffnet
   * das Sheet nur, wenn es noch nie gesehen wurde (kein Effekt danach). */
  notifyActivated: () => void;
  /** Öffnet das Sheet erneut, unabhängig vom "gesehen"-Status (Reopen-Button). */
  show: () => void;
  /** Schließt das Sheet und merkt sich dauerhaft, dass es gesehen wurde. */
  dismiss: () => void;
}

export function useGrammatikIntro(): UseGrammatikIntro {
  const [visible, setVisible] = useState(false);
  // null = noch nicht aus dem Speicher geladen -> notifyActivated bleibt bis
  // dahin folgenlos, damit ein sehr schneller erster Toggle nicht doch
  // fälschlich ein zweites Mal aufpoppt.
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!cancelled) setSeen(v === '1');
      })
      .catch(() => {
        if (!cancelled) setSeen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function notifyActivated() {
    if (seen === false) setVisible(true);
  }

  function dismiss() {
    setVisible(false);
    setSeen(true);
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
  }

  function show() {
    setVisible(true);
  }

  return { visible, notifyActivated, show, dismiss };
}

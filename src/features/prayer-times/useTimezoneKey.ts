import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Zeitzone UND aktueller UTC-Versatz als ein String.
 *
 * Beides zusammen, weil sich beides unabhängig ändern kann: die Zonen-ID beim
 * Reisen bzw. beim Umstellen der Systemeinstellung, der Versatz zusätzlich bei
 * jeder Sommer-/Winterzeit-Umstellung innerhalb derselben Zone.
 */
export function computeTimezoneKey(now: Date = new Date()): string {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // Ältere Hermes-Builds ohne volles ICU liefern hier nichts — der Versatz
    // allein reicht dann als Erkennungsmerkmal.
  }
  return `${zone}|${now.getTimezoneOffset()}`;
}

/**
 * Liefert einen Schlüssel, der sich genau dann ändert, wenn das Gerät die
 * Zeitzone oder den UTC-Versatz wechselt.
 *
 * WOZU: geplante Benachrichtigungen sind absolute Zeitpunkte. Wer von Berlin
 * nach London fliegt, hat danach Alarme im Telefon, die noch auf den Berliner
 * Gebetszeiten stehen — sie erscheinen dann eine Stunde zu spät, ohne dass
 * irgendetwas an der App „kaputt" wäre. Bislang fiel das erst auf, wenn eine
 * andere Abhängigkeit zufällig eine Neuplanung auslöste. Als Teil des
 * react-query-Schlüssels und der Neuplanungs-Abhängigkeiten erzwingt dieser
 * Wert, dass Anzeige und Alarme sofort auf die neue Zone umgestellt werden.
 *
 * Geprüft wird beim Zurückkehren in den Vordergrund (der Zonenwechsel passiert
 * praktisch immer, während die App im Hintergrund ist) und zusätzlich im
 * Minutentakt — dieselbe Frequenz wie useDayKey, damit eine laufende App die
 * Zeitumstellung nicht verschläft.
 */
export function useTimezoneKey(): string {
  const [key, setKey] = useState(() => computeTimezoneKey());

  useEffect(() => {
    const pruefen = () => setKey((vorher) => {
      const jetzt = computeTimezoneKey();
      return vorher === jetzt ? vorher : jetzt;
    });
    const iv = setInterval(pruefen, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pruefen();
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, []);

  return key;
}

// Zeigt einen übersetzten grammatischen Fachbegriff zusammen mit seinem
// arabischen Original — Auflage des Auftraggebers: der arabische Begriff läuft
// ÜBERALL mit, wo ein grammatischer Fachbegriff genannt wird (Wortart,
// Ism-/Verb-Eigenschaften samt Werten, Fragmentrollen, POS-Tags, Relationen),
// nicht nur an ausgewählten Stellen.
//
// Gedämpfte Sekundärfarbe statt gleichrangigem Fließtext: ein bloßes
// <ThemedText type="default"> würde die eigene Schriftgröße des Typs erzwingen
// und damit die Größe/Gewichtung des umgebenden Textes überschreiben (React
// Natives Style-Vererbung für verschachtelten Text gilt nur, wenn das Kind
// KEINEN eigenen konkurrierenden Stil mitbringt) — deshalb ein rohes `Text`
// mit nur `color`/`writingDirection` überschrieben, alles andere erbt vom
// umgebenden Text.
//
// Entfällt bewusst, wenn `ar` mit `text` identisch ist: in den Sprachen mit
// arabischer Schrift (ar/fa/ur/ps) ist die Übersetzung selbst oft schon der
// arabische Begriff — eine Dopplung wie "حرف عطف — حرف عطف" hilft niemandem.
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface FachbegriffProps {
  /** Übersetzter Begriff in der App-Sprache. */
  text: string;
  /** Arabischer Fachbegriff, oder `null`/leer, wenn keiner vorliegt. */
  ar?: string | null;
}

export function Fachbegriff({ text, ar }: FachbegriffProps) {
  const theme = useTheme();
  const zeigen = !!ar && ar !== text;
  return (
    <>
      {text}
      {zeigen ? (
        <Text style={[styles.ar, { color: theme.textSecondary }]}>
          {' — '}
          {ar}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  ar: { writingDirection: 'rtl' },
});

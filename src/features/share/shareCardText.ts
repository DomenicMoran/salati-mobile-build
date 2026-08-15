// Text-Kürzung für die native Teilen-als-Bild-Karte (share-card.tsx): lange
// Hadithe (mehrere Absätze) würden die Karte sonst unlesbar überladen bzw.
// winzig schrumpfen lassen. Kürzere Koran-Verse bleiben durch die
// Zeichen-Obergrenze in der Praxis fast immer unangetastet.
/**
 * Kürzt `text` auf höchstens `maxChars` Zeichen, ohne mitten in einem Wort
 * abzuschneiden — bricht am letzten Leerzeichen vor der Grenze um und hängt
 * eine Ellipse an. Fällt hart auf `maxChars` zurück, wenn kein sinnvoller
 * Wortumbruch gefunden wird (z. B. ein einziges sehr langes "Wort").
 */
export function truncateForShareCard(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  // Nur am Wortende umbrechen, wenn dadurch nicht mehr als 40% des erlaubten
  // Textes verloren geht — sonst lieber hart abschneiden statt eine winzige
  // Restkarte zu zeigen.
  const safe = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trimEnd()}…`;
}

/**
 * Begleit-Bildunterschrift für "Als Bild teilen": Quelle + Deep-Link + kurzer
 * App-Hinweis, durch Leerzeilen getrennt (lesbar in WhatsApp/Telegram/etc.
 * Caption-Feldern). `expo-sharing`s `shareAsync` kann in Expo v57 Bild und
 * Text nicht in einem Aufruf teilen (`SharingOptions` hat kein Text-/Message-
 * Feld, nur `mimeType`/`UTI`/`dialogTitle`/`anchor`) — die Karte teilt daher
 * NUR das Bild, dieser Text landet stattdessen in der Zwischenablage
 * (s. share-card.tsx `handleShare`), damit er in der Zielapp eingefügt
 * werden kann.
 */
export function buildShareCaption(source: string, deepLink: string, footer: string): string {
  return `${source}\n\n${deepLink}\n\n${footer}`;
}

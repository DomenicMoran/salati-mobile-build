// Inhalt als Bild teilen (Web): zeichnet eine Share-Card (1080×1350, Instagram-
// Hochformat) auf ein Canvas — arabischer Text, optionale Umschrift (Duas),
// Übersetzung, Quelle, Branding — und öffnet das System-Share-Sheet (Fallback:
// PNG-Download). Wird von Quran-Vers, Weisheit und Dua auf dem Web genutzt;
// nativ übernimmt stattdessen die RN-View-Variante (components/share-card.tsx),
// weil DOM-Canvas nativ nicht verfügbar ist. Deshalb ist der Web-Pfad an
// `Platform.OS === 'web'` (canShareVerseImage) gebunden.
import { Platform } from 'react-native';

export const canShareVerseImage = Platform.OS === 'web';
/** Generischer Alias — der Canvas-Renderer ist nicht mehr vers-spezifisch,
 * neue Aufrufer (Weisheit/Dua) sollen den neutralen Namen verwenden. */
export const canShareContentImage = canShareVerseImage;

const W = 1080;
const H = 1350;
const MARGIN = 96;

// Schrift-Stack für den arabischen Text auf dem Canvas. Die ersten vier Namen
// sind die von expo-font registrierten Familien der App-Schriften
// (features/quran/fonts.ts) — auf Web legt expo-font dafür @font-face-Regeln
// an, sobald die jeweilige Schrift geladen ist. Geladen ist immer mindestens
// die in den Einstellungen gewählte; der Browser nimmt die erste verfügbare.
// Danach System-Schriften als letzter Rückfall.
const ARABIC_CANVAS_FONTS =
  'KFGQPCHafs, ScheherazadeNew, AmiriQuran, NotoNaskhArabic, "Traditional Arabic", "Geeza Pro", serif';

/** Bricht Text auf maxWidth um (Canvas hat keinen automatischen Umbruch). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface VerseCardInput {
  arabic: string;
  /** Lateinische Umschrift — nur Duas liefern das; zwischen Arabisch und
   * Übersetzung gezeichnet. Fehlt bei Vers/Hadith/Weisheit → Zeile entfällt. */
  transliteration?: string;
  translation: string;
  /** z. B. "Al-Baqara 2:153" */
  source: string;
  /** z. B. "salatibox://quran/2?ayah=153" (s. src/lib/deepLinks.ts). Anders
   * als der native Pfad (share-card.tsx, expo-sharing kennt kein Text-Feld)
   * erlaubt die Web Share API Level 2 Bild UND Text im selben `navigator
   * .share()`-Aufruf — hier also kein Kompromiss nötig. */
  deepLink?: string;
}

/** Zeichnet die Card und liefert sie als PNG-Blob. */
export function drawVerseCard(input: VerseCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas_unavailable'));

  // Hintergrund: tiefes Tinten-Schwarz mit dezentem Verlauf
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#101014');
  bg.addColorStop(1, '#0b0b0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Goldene Zierlinien oben/unten
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  const maxWidth = W - MARGIN * 2;

  // Arabischer Vers (RTL, zentriert)
  ctx.fillStyle = '#f7f3ea';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.font = `64px ${ARABIC_CANVAS_FONTS}`;
  const arabicLines = wrapText(ctx, input.arabic, maxWidth);
  const arabicLineHeight = 104;

  // Umschrift (optional, nur Duas) — zwischen Arabisch und Übersetzung
  ctx.direction = 'ltr';
  ctx.font = 'italic 30px Georgia, "Times New Roman", serif';
  const transliterationText = input.transliteration?.trim() ?? '';
  const transliterationLines = transliterationText ? wrapText(ctx, transliterationText, maxWidth) : [];
  const transliterationLineHeight = 44;

  // Übersetzung (leer bei rein arabischer Anzeige → Zeile entfällt)
  ctx.font = 'italic 34px Georgia, "Times New Roman", serif';
  const translationText = input.translation.trim();
  const translationLines = translationText ? wrapText(ctx, `„${translationText}“`, maxWidth) : [];
  const translationLineHeight = 50;

  // Vertikal zentrieren (Arabisch + Lücke + Umschrift + Übersetzung)
  const gap = 70;
  const blockHeight =
    arabicLines.length * arabicLineHeight +
    gap +
    transliterationLines.length * transliterationLineHeight +
    translationLines.length * translationLineHeight;
  let y = Math.max(MARGIN + 80, (H - blockHeight) / 2);

  ctx.direction = 'rtl';
  ctx.font = `64px ${ARABIC_CANVAS_FONTS}`;
  ctx.fillStyle = '#f7f3ea';
  for (const line of arabicLines) {
    ctx.fillText(line, W / 2, y);
    y += arabicLineHeight;
  }

  y += gap - arabicLineHeight / 2;
  ctx.direction = 'ltr';
  if (transliterationLines.length > 0) {
    ctx.font = 'italic 30px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#a8a08c';
    for (const line of transliterationLines) {
      ctx.fillText(line, W / 2, y);
      y += transliterationLineHeight;
    }
    y += 16;
  }
  ctx.font = 'italic 34px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#cfc8b8';
  for (const line of translationLines) {
    ctx.fillText(line, W / 2, y);
    y += translationLineHeight;
  }

  // Quelle in Gold
  y += 40;
  ctx.font = '600 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(input.source, W / 2, y);

  // Branding unten
  ctx.font = '26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#8a8474';
  ctx.fillText('Salati · salati.pro', W / 2, H - 84);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas_blob_failed'))), 'image/png');
  });
}

/** Share-Sheet mit der Bild-Datei; Fallback: Download. true = etwas ist passiert. */
export async function shareVerseImage(input: VerseCardInput): Promise<boolean> {
  if (!canShareVerseImage) return false;
  const blob = await drawVerseCard(input);
  const file = new File([blob], 'salati-vers.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], ...(input.deepLink ? { text: input.deepLink } : {}) });
      return true;
    } catch {
      // Nutzer hat abgebrochen oder Share nicht erlaubt → Download-Fallback
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'salati-vers.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Generischer Alias für neue Aufrufer (Weisheit/Dua) — identisches Verhalten
 * wie shareVerseImage, nur ohne vers-spezifische Benennung. */
export const shareContentImage = shareVerseImage;

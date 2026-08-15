// Wochen-Rückblick als teilbares Bild (Web): 1080×1080-Canvas mit Lektionen,
// Fragen, Bestwert und Lernserie als 2×2-Zahlen-Grid — System-Share-Sheet,
// Fallback PNG-Download. Gleiches Muster wie features/tracker/statsImage.ts
// (Gebets-Statistik-Card): dort ebenfalls nur Web, da React Native ohne
// zusätzliche Dependency (react-native-view-shot o. ä.) kein Canvas hat.
import { Platform } from 'react-native';

export const canShareWeeklyReviewImage = Platform.OS === 'web';

export interface WeeklyReviewCardInput {
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
}

const S = 1080;

export function drawWeeklyReviewCard(input: WeeklyReviewCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas_unavailable'));

  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#101014');
  bg.addColorStop(1, '#0b0b0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, S - 80, S - 80);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7f3ea';
  ctx.font = '600 52px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(input.title, S / 2, 108 + 52);

  ctx.fillStyle = '#cfc8b8';
  ctx.font = '32px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(input.subtitle, S / 2, 236);

  // 2×2-Grid mit den Kennzahlen
  const gridTop = 340;
  const gridBottom = 900;
  const cols = 2;
  const rows = Math.ceil(input.stats.length / cols);
  const cellW = (S - 160) / cols;
  const cellH = (gridBottom - gridTop) / rows;

  input.stats.forEach((stat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 80 + cellW * col + cellW / 2;
    const cy = gridTop + cellH * row + cellH / 2;

    ctx.fillStyle = '#d4af37';
    ctx.font = '700 84px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(stat.value, cx, cy);

    ctx.fillStyle = '#8a8474';
    ctx.font = '28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(stat.label, cx, cy + 52);
  });

  ctx.fillStyle = '#8a8474';
  ctx.font = '26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Salati · salati.pro', S / 2, S - 84);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas_blob_failed'))), 'image/png');
  });
}

/** Share-Sheet mit der Bild-Datei; Fallback: Download. true = etwas ist passiert. */
export async function shareWeeklyReviewImage(input: WeeklyReviewCardInput): Promise<boolean> {
  if (!canShareWeeklyReviewImage) return false;
  const blob = await drawWeeklyReviewCard(input);
  const file = new File([blob], 'salati-wochenrueckblick.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return true;
    } catch {
      // Nutzer hat abgebrochen oder Share nicht erlaubt → Download-Fallback
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'salati-wochenrueckblick.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

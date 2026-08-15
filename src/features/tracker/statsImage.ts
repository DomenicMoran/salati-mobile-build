// Gebets-Statistik als teilbares Bild (Web): 1080×1080-Canvas mit Streak,
// Heute-Stand und 7-Tage-Balken — System-Share-Sheet, Fallback PNG-Download.
// Nativ nicht verfügbar (kein Canvas) — Button wird dort nicht angezeigt.
import { Platform } from 'react-native';

export const canShareStatsImage = Platform.OS === 'web';

export interface StatsCardInput {
  title: string;
  streakLabel: string;
  todayLabel: string;
  /** 7 Einträge: Tag-Kürzel + erledigte Gebete (0-5), ältester zuerst. */
  week: { label: string; done: number }[];
}

const S = 1080;

export function drawStatsCard(input: StatsCardInput): Promise<Blob> {
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
  ctx.font = '600 56px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(input.title, S / 2, 108 + 56);

  ctx.fillStyle = '#d4af37';
  ctx.font = '600 44px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`🔥 ${input.streakLabel}`, S / 2, 260);

  ctx.fillStyle = '#cfc8b8';
  ctx.font = '36px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(input.todayLabel, S / 2, 330);

  // 7-Tage-Balken
  const chartTop = 420;
  const chartBottom = 840;
  const barMax = chartBottom - chartTop;
  const slot = (S - 240) / 7;
  input.week.forEach((d, i) => {
    const x = 120 + slot * i + slot / 2;
    const h = Math.max(10, (d.done / 5) * barMax);
    const w = 46;
    ctx.fillStyle = 'rgba(212,175,55,0.18)';
    roundRect(ctx, x - w / 2, chartTop, w, barMax, 14);
    ctx.fill();
    ctx.fillStyle = d.done > 0 ? '#d4af37' : 'rgba(212,175,55,0.28)';
    roundRect(ctx, x - w / 2, chartBottom - h, w, h, 14);
    ctx.fill();
    ctx.fillStyle = '#8a8474';
    ctx.font = '28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(d.label, x, chartBottom + 48);
  });

  ctx.fillStyle = '#8a8474';
  ctx.font = '26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Salati · salati.pro', S / 2, S - 84);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas_blob_failed'))), 'image/png');
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function shareStatsImage(input: StatsCardInput): Promise<boolean> {
  if (!canShareStatsImage) return false;
  const blob = await drawStatsCard(input);
  const file = new File([blob], 'salati-statistik.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return true;
    } catch {
      // abgebrochen → Download-Fallback
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'salati-statistik.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

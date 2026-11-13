import { formatHHMM, PRAYERS, type Prayer } from '@/features/prayer-times/next-prayer';
import type { WeekDayRow } from '@/features/prayer-times/week';

const WEEKDAY_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function buildPrintablePrayerWeekHtml(
  rows: WeekDayRow[],
  opts: { locale: 'de' | 'en'; timeFormat: '24h' | '12h'; locationLabel: string },
): string {
  const weekdays = opts.locale === 'de' ? WEEKDAY_DE : WEEKDAY_EN;
  const title = opts.locale === 'de' ? 'Gebetszeiten — Woche' : 'Prayer times — week';
  const head = PRAYERS.map((p) => `<th>${p}</th>`).join('');
  const body = rows
    .map((row) => {
      const wd = weekdays[row.weekdayIdx] ?? '';
      const cells = PRAYERS.map((p: Prayer) => `<td>${formatHHMM(row.timings[p], opts.timeFormat)}</td>`).join('');
      return `<tr><td>${wd} ${row.date.getDate()}.${row.date.getMonth() + 1}.</td>${cells}</tr>`;
    })
    .join('');
  return `<!DOCTYPE html><html lang="${opts.locale}"><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:center}th{background:#f4efe4}</style></head>
<body><h1>${title}</h1><p>${opts.locationLabel}</p>
<table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table>
<p style="font-size:12px;opacity:.7">${opts.locale === 'de' ? 'Lokal erzeugt — Salati' : 'Generated on-device — Salati'}</p></body></html>`;
}

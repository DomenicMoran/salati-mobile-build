// Iqama = Beginn des Gemeinschaftsgebets, eine konfigurierbare Karenzzeit
// NACH dem Adhan-Ruf (Moschee-Praxis: Fajr/Dhuhr/Asr/Isha meist 10-20 Min.,
// Maghrib deutlich kürzer, da das Zeitfenster bis Isha knapp ist). Reine
// Zeitrechnung auf Basis der bereits vorhandenen Adhan-Zeiten — kein
// zusätzlicher API-Call nötig.
import { formatClock, parseTimeOn, type TimeFormat } from './next-prayer';

/** Iqama-Zeitpunkt = Adhan-Zeit + Karenzzeit (Minuten), auf das Datum von `reference` bezogen. */
export function iqamaTime(adhanHHMM: string, offsetMinutes: number, reference: Date): Date {
  const adhan = parseTimeOn(adhanHHMM, reference);
  return new Date(adhan.getTime() + offsetMinutes * 60_000);
}

/** Iqama-Zeit direkt als "HH:MM"/"H:MM AM" formatiert (Zeit-Format aus den Einstellungen). */
export function formatIqama(
  adhanHHMM: string,
  offsetMinutes: number,
  reference: Date,
  format: TimeFormat,
): string {
  const d = iqamaTime(adhanHHMM, offsetMinutes, reference);
  return formatClock(d.getHours(), d.getMinutes(), format);
}

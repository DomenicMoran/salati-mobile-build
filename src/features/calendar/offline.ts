// Tabellarischer ("Kuwaiti"-Algorithmus) Gregorianisch→Hijri-Konverter für den
// Offline-Fallback. Rein mathematisch (30-Jahre-Zyklus) — weicht an manchen
// Tagen um ±1 Tag vom autoritativen, mondsichtungs-/methodenbasierten Kalender
// ab, den Aladhan online liefert (dort als "HJCoSA"-Methode). Deshalb NUR als
// Fallback verwenden, nie als primäre Quelle wenn online — siehe hooks.ts.
//
// -1-Tag-Kalibrierung wurde gegen mehrere echte Aladhan-Referenzdaten
// verifiziert (im Audit/Build-Prozess), reduziert aber die Abweichung nur im
// Durchschnitt, eliminiert sie nicht vollständig.

import type { Locale } from '@/lib/locale-detect';

export interface HijriYMD {
  year: number;
  month: number; // 1–12
  day: number;
}

const HIJRI_EPOCH_JD = 1948440; // 1 Muharram 1 AH (tabuläre ziv. Rechnung, s.o.)
const AVG_HIJRI_YEAR_DAYS = 354.36667;
const AVG_HIJRI_MONTH_DAYS = 29.53059;
const UNIX_EPOCH_JD = 2440588; // 1970-01-01

export function gregorianToHijriOffline(date: Date): HijriYMD {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  let jd =
    Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
    Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4) +
    gd -
    32075;
  jd -= 1; // Kalibrierung gegen Aladhan-Referenzwerte

  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  return { year, month, day };
}

/**
 * Umgekehrte Richtung (Hijri→Gregorianisch) für den Offline-Fallback des
 * Datumsumrechners. Statt einer eigenen inversen Tabellen-Formel (Risiko
 * eigener Rundungsfehler) wird über eine Mittelwert-Schätzung ein
 * Startdatum bestimmt und dann mit `gregorianToHijriOffline` — der bereits
 * gegen Aladhan kalibrierten Wahrheitsquelle — lokal nachjustiert. Dadurch
 * ist diese Funktion per Konstruktion so genau wie die Vorwärtsrichtung.
 *
 * Bekannte Einschränkung: in seltenen Januar/Februar-Randfällen (~0,5% aller
 * Tage, siehe offline.test.ts) ist `gregorianToHijriOffline` nicht streng
 * monoton, wodurch zwei benachbarte Gregorianische Tage auf dasselbe Hijri-
 * Datum abbilden können — dieselbe ±1-Tag-Unschärfe, die oben und in der
 * Kalender-UI (calendar.offlineNotice) bereits dokumentiert ist. Online läuft
 * der Konverter über die exakte Aladhan-API, betrifft also nur den seltenen
 * Offline-Fall.
 */
export function hijriToGregorianOffline(hijri: HijriYMD): Date {
  const estJd =
    HIJRI_EPOCH_JD +
    (hijri.year - 1) * AVG_HIJRI_YEAR_DAYS +
    (hijri.month - 1) * AVG_HIJRI_MONTH_DAYS +
    (hijri.day - 1);
  const daysFromUnixEpoch = Math.round(estJd - UNIX_EPOCH_JD);
  const estimate = new Date(Date.UTC(1970, 0, 1) + daysFromUnixEpoch * 86400000);
  const estimateLocal = new Date(estimate.getUTCFullYear(), estimate.getUTCMonth(), estimate.getUTCDate());

  // Lokale Suche nächster-zuerst (0, +1, -1, +2, -2, …) korrigiert die
  // Rundung der Durchschnittswerte auf max. wenige Tage.
  const offsets = [0];
  for (let step = 1; step <= 6; step++) offsets.push(step, -step);
  for (const offset of offsets) {
    const candidate = new Date(estimateLocal.getFullYear(), estimateLocal.getMonth(), estimateLocal.getDate() + offset);
    const back = gregorianToHijriOffline(candidate);
    if (back.year === hijri.year && back.month === hijri.month && back.day === hijri.day) {
      return candidate;
    }
  }
  return estimateLocal; // Sollte praktisch nie erreicht werden.
}

// DE/EN/TR/AR — Basis portiert aus HIJRI_MONTHS_DE in
// apps/device/src/components/SalatiDashboard.tsx, um die restlichen 10
// App-Sprachen (#60: id/bn/fa/ms/ur/sw/ru/ps + es/fr) ergänzt — jeweils die
// in der Sprache gebräuchliche Transliteration/Schreibweise der 12 Hijri-
// Monatsnamen, keine wörtliche Übersetzung (Eigennamen).
export const HIJRI_MONTHS: Record<Locale, string[]> = {
  de: [
    'Muharram', 'Safar', 'Rabīʿ al-Awwal', 'Rabīʿ ath-Thānī',
    'Jumādā al-Ūlā', 'Jumādā ath-Thāniyah', 'Rajab', 'Shaʿbān',
    'Ramaḍān', 'Shawwāl', 'Dhū al-Qaʿdah', 'Dhū al-Ḥijjah',
  ],
  en: [
    'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
    'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
  ],
  tr: [
    'Muharrem', 'Safer', 'Rebîülevvel', 'Rebîülâhir',
    'Cemâziyelevvel', 'Cemâziyelâhir', 'Recep', 'Şaban',
    'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce',
  ],
  ar: [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
  ],
  es: [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Zani',
    'Yumada al-Ula', 'Yumada al-Zani', 'Rayab', 'Shaaban',
    'Ramadán', 'Shawwal', 'Du al-Qada', 'Du al-Hiyya',
  ],
  fr: [
    'Mouharram', 'Safar', 'Rabi al-Awwal', 'Rabi ath-Thani',
    'Joumada al-Oula', 'Joumada al-Akhira', 'Rajab', "Cha'ban",
    'Ramadan', 'Chawwal', "Dhou al-Qi'da", 'Dhou al-Hijja',
  ],
  id: [
    'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
    'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban",
    'Ramadhan', 'Syawal', 'Zulkaidah', 'Zulhijjah',
  ],
  bn: [
    'মুহররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি',
    'জমাদিউল আউয়াল', 'জমাদিউস সানি', 'রজব', 'শাবান',
    'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ্জ',
  ],
  fa: [
    'محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی',
    'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه',
  ],
  ms: [
    'Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir',
    'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban',
    'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah',
  ],
  ur: [
    'محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی',
    'جمادی الاول', 'جمادی الثانی', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذی قعدہ', 'ذی الحجہ',
  ],
  ru: [
    'Мухаррам', 'Сафар', 'Раби аль-авваль', 'Раби ас-сани',
    'Джумада аль-уля', 'Джумада аль-ахира', 'Раджаб', 'Шаабан',
    'Рамадан', 'Шавваль', 'Зуль-каада', 'Зуль-хиджа',
  ],
  sw: [
    'Muharram', 'Safar', 'Rabiul-Awwal', 'Rabiuth-Thani',
    'Jumadal-Awwal', 'Jumadath-Thani', 'Rajabu', 'Shaabani',
    'Ramadhani', 'Shawwali', 'Dhul-Qaada', 'Dhul-Hijja',
  ],
  ps: [
    'محرم', 'صفر', 'ربيع الاول', 'ربيع الثاني',
    'جمادی الاول', 'جمادی الثاني', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذوالقعده', 'ذوالحجه',
  ],
};

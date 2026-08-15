// Löst einen VerseOfDayRef (pool.ts) in tatsächlichen Arabisch-/Übersetzungs-
// Text auf. Bewusst KEINE selbst geschriebenen Übersetzungen (s. Kommentar
// in pool.ts) — Verse kommen live vom selben Al-Quran-Cloud-Host, den
// features/quran/api.ts bereits nutzt (dort auch als Quelle für die
// "Ayah des Tages" in apps/device/src/components/SalatiDashboard.tsx
// dokumentiert), Hadithe über die bereits vorhandene fetchHadithCollection()
// (features/hadith/api.ts) — dieselbe Datenquelle, die auch die Hadith-Detail-
// Seite (app/hadith/[collection]/[number].tsx) für die "Teilen"-Funktion nutzt.
//
// Einzel-Ayah-Endpoint statt fetchSurahReading() (lädt IMMER die komplette
// Sure): für Ayat al-Kursi in Sure 2 wären das 286 Verse für einen einzigen
// benötigten — der leichte /ayah/{surah}:{ayah}/{edition}-Endpoint liefert
// direkt nur den einen Vers.
import { BEST_TRANSLATIONS } from '@/features/quran/api';
import { fetchHadithCollection, type HadithLang } from '@/features/hadith/api';
import { hadithDeepLink, quranAyahDeepLink } from '@/lib/deepLinks';
import { fetchJson } from '@/lib/fetchJson';
import type { VerseOfDayRef } from './pool';

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const ARABIC_EDITION = 'quran-uthmani';

// qcom.*-Editionen (s. BEST_TRANSLATIONS['ms']) laufen über eine andere API
// (quran.com) mit anderem Response-Format als der leichte alquran.cloud-
// /ayah-Endpoint hier — für diese eine Notification reicht ein Fallback auf
// Englisch statt eine zweite Übersetzungs-API einzubinden.
const QURANCOM_PREFIX = 'qcom.';

export interface VerseOfDayContent {
  arabic: string;
  translation: string;
  /** z. B. "Al-Baqara 2:255" oder "An-Nawawi 40 · Hadith 1" */
  source: string;
  deepLink: string;
}

interface AlQuranCloudAyahResponse {
  code: number;
  data?: {
    text: string;
    numberInSurah: number;
    surah: { number: number; englishName: string };
  };
}

async function fetchAyahEdition(surah: number, ayah: number, edition: string): Promise<AlQuranCloudAyahResponse> {
  return fetchJson<AlQuranCloudAyahResponse>(`${QURAN_API_BASE}/ayah/${surah}:${ayah}/${edition}`, {
    errorPrefix: 'alquran_cloud',
  });
}

async function resolveVerse(surah: number, ayah: number, locale: string): Promise<VerseOfDayContent> {
  const preferredEdition = BEST_TRANSLATIONS[locale] ?? BEST_TRANSLATIONS.en;
  const translationEdition = preferredEdition.startsWith(QURANCOM_PREFIX) ? BEST_TRANSLATIONS.en : preferredEdition;

  const [arabicRes, translationRes] = await Promise.all([
    fetchAyahEdition(surah, ayah, ARABIC_EDITION),
    fetchAyahEdition(surah, ayah, translationEdition),
  ]);
  if (!arabicRes.data || !translationRes.data) throw new Error('verse_of_day_ayah_missing');

  return {
    arabic: arabicRes.data.text,
    translation: translationRes.data.text,
    source: `${arabicRes.data.surah.englishName} ${surah}:${ayah}`,
    deepLink: quranAyahDeepLink(surah, ayah),
  };
}

async function resolveHadith(number: number, hadithLang: HadithLang): Promise<VerseOfDayContent> {
  const { hadiths } = await fetchHadithCollection('nawawi', hadithLang);
  const hadith = hadiths.find((h) => h.hadithnumber === number);
  if (!hadith) throw new Error('verse_of_day_hadith_missing');

  return {
    arabic: hadith.arabic,
    translation: hadith.translation,
    source: `An-Nawawi 40 · Hadith ${number}`,
    deepLink: hadithDeepLink('nawawi', number),
  };
}

export async function resolveVerseOfDayContent(
  ref: VerseOfDayRef,
  locale: string,
  hadithLang: HadithLang,
): Promise<VerseOfDayContent> {
  return ref.kind === 'verse' ? resolveVerse(ref.surah, ref.ayah, locale) : resolveHadith(ref.number, hadithLang);
}

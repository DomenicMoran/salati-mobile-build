import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadAllAudioProgress } from '@/features/progress/audioProgress';
import { chapterAtPage } from '@/features/bibliothek/allinone/chapterToc';
import { PDF_LESEFORTSCHRITT_STORAGE_KEY, parsePdfLesefortschrittStore } from '@/features/bibliothek/pdfLesefortschritt';
import { resolveReaderBook } from '@/features/bibliothek/readerBook';
import {
  LESEFORTSCHRITT_STORAGE_KEY,
  TAFSIR_LESEFORTSCHRITT_UPDATED_KEY,
  parseLesefortschritt,
  type Lesefortschritt,
} from '@/features/bibliothek/lesefortschritt';

export type HubContinueKind = 'tafsir' | 'pdf' | 'audio';

export type HubContinueReading =
  | {
      kind: 'tafsir';
      surah: number;
      block: number;
      updatedAt: string;
      labelKey: 'bibliothek.continueReading';
    }
  | {
      kind: 'pdf';
      bookId: string;
      title: string;
      page: number;
      chapterTitle: string;
      percent: number;
      updatedAt: string;
      labelKey: 'bibliothek.continueReading';
    }
  | {
      kind: 'audio';
      title: string;
      percent: number;
      updatedAt: string;
      href: string;
      labelKey: 'bibliothek.continueListening';
    };

function isoOrEmpty(value: string | undefined): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function audioContinueFromMap(
  map: Awaited<ReturnType<typeof loadAllAudioProgress>>,
): HubContinueReading | null {
  const entries = Object.values(map).filter((e) => e.positionSec >= 5);
  if (!entries.length) return null;
  const newest = entries.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
  const percent =
    newest.durationSec > 0
      ? Math.min(100, Math.max(0, Math.round((newest.positionSec / newest.durationSec) * 100)))
      : 0;
  let title = newest.id;
  let href = '/media';
  if (newest.kind === 'podcast' && newest.meta?.episodeNo) {
    title = `Podcast ${newest.meta.episodeNo}`;
    href = `/podcast/${newest.meta.episodeNo}`;
  } else if (newest.kind === 'audiobook' && newest.meta?.track && newest.meta.chapterNo) {
    title = `${newest.meta.track} · ${newest.meta.chapterNo}`;
    href = `/audiobooks/${newest.meta.track}/${newest.meta.chapterNo}?lang=${newest.meta.lang ?? 'de'}`;
  } else if (newest.kind === 'quran-listen' && newest.meta?.surah) {
    title = `Sure ${newest.meta.surah}`;
    href = `/quran/${newest.meta.surah}`;
  }
  return {
    kind: 'audio',
    title,
    percent,
    updatedAt: new Date(newest.updatedAt).toISOString(),
    href,
    labelKey: 'bibliothek.continueListening',
  };
}

export function pickHubContinueReading(
  tafsir: Lesefortschritt | null,
  tafsirUpdatedAt: string | null,
  pdfEntries: ReturnType<typeof parsePdfLesefortschrittStore>,
  audioMap?: Awaited<ReturnType<typeof loadAllAudioProgress>>,
): HubContinueReading | null {
  const audio = audioMap ? audioContinueFromMap(audioMap) : null;
  const audioAt = audio ? isoOrEmpty(audio.updatedAt) : '';
  const pdfList = Object.values(pdfEntries);
  const newestPdf = pdfList.reduce<(typeof pdfList)[number] | null>((best, cur) => {
    if (!best) return cur;
    return cur.updatedAt > best.updatedAt ? cur : best;
  }, null);

  const tafsirAt = isoOrEmpty(tafsirUpdatedAt ?? undefined);
  const pdfAt = isoOrEmpty(newestPdf?.updatedAt);

  if (audio && (!tafsirAt && !pdfAt) && audioAt) {
    return audio;
  }

  if (audio && audioAt && (!pdfAt || audioAt >= pdfAt) && (!tafsirAt || audioAt >= tafsirAt)) {
    return audio;
  }

  if (newestPdf && (!tafsir || (pdfAt && (!tafsirAt || pdfAt >= tafsirAt)))) {
    const config = resolveReaderBook(newestPdf.bookId);
    const chapter =
      config && newestPdf.page
        ? chapterAtPage(config.chapters, newestPdf.page)
        : config?.chapters.find((c) => c.slug === newestPdf.chapterSlug);
    const totalPages = config?.chapters.at(-1)?.endPage ?? 0;
    const percent =
      totalPages > 0 ? Math.min(100, Math.max(0, Math.round((newestPdf.page / totalPages) * 100))) : 0;
    return {
      kind: 'pdf',
      bookId: newestPdf.bookId,
      title: config?.title ?? newestPdf.chapterTitle,
      page: newestPdf.page,
      chapterTitle: chapter?.title ?? newestPdf.chapterTitle,
      percent,
      updatedAt: newestPdf.updatedAt,
      labelKey: 'bibliothek.continueReading',
    };
  }

  if (tafsir) {
    return {
      kind: 'tafsir',
      surah: tafsir.surah,
      block: tafsir.block,
      updatedAt: tafsirAt || new Date(0).toISOString(),
      labelKey: 'bibliothek.continueReading',
    };
  }

  return null;
}

export async function loadHubContinueReading(): Promise<HubContinueReading | null> {
  const [tafsirRaw, tafsirUpdatedRaw, pdfRaw, audioMap] = await Promise.all([
    AsyncStorage.getItem(LESEFORTSCHRITT_STORAGE_KEY).catch(() => null),
    AsyncStorage.getItem(TAFSIR_LESEFORTSCHRITT_UPDATED_KEY).catch(() => null),
    AsyncStorage.getItem(PDF_LESEFORTSCHRITT_STORAGE_KEY).catch(() => null),
    loadAllAudioProgress(),
  ]);
  const tafsir = parseLesefortschritt(tafsirRaw);
  const pdfStore = parsePdfLesefortschrittStore(pdfRaw);
  return pickHubContinueReading(tafsir, tafsirUpdatedRaw, pdfStore, audioMap);
}

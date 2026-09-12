import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { fetchSurahSecondTranslation } from '@/features/quran/api';

// Offline-Mandat (User-Direktive): alles einmal Geladene (Suren,
// Übersetzungen, Hadith-Bücher, Tafsir, Wort-Daten, Segmente, Radiolisten)
// bleibt über App-Neustarts hinweg verfügbar — der Query-Cache wird nach
// AsyncStorage persistiert (PersistQueryClientProvider in app/_layout.tsx).
// gcTime muss dafür mindestens so lang sein wie maxAge des Persisters.
const DAY_MS = 24 * 60 * 60 * 1000;

// ACHTUNG: gcTime läuft über setTimeout — Werte über 2^31-1 ms (~24,8 Tage)
// lassen den Timer SOFORT feuern, wodurch beobachterlose Queries (alle
// Prefetches, alle restaurierten Offline-Daten) direkt nach dem Laden
// weggeräumt werden. 4 Wochen (alt) lag darüber und machte das Offline-
// Paket unbrauchbar; 24 Tage bleiben sicher unter dem Limit.
const GC_TIME_MS = 24 * DAY_MS;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // 1h — Gebetszeiten/Editionen ändern sich selten
      gcTime: GC_TIME_MS,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Web: AsyncStorage = localStorage (~5 MB) — das Voll-Offline-Paket (114
// Suren) sprengt das Limit, setItem wirft QuotaExceededError und der
// Persister verwirft dann den GESAMTEN Snapshot. IndexedDB hat praktisch
// keine relevante Grenze, daher eigener Mini-Adapter (gleiches Interface).
function createIndexedDbStorage() {
  const DB = 'salatibox-query';
  const STORE = 'kv';
  function withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => open.result.close();
      };
    });
  }
  return {
    getItem: (key: string) =>
      withStore<string | undefined>('readonly', (s) => s.get(key)).then((v) => v ?? null),
    setItem: (key: string, value: string) =>
      withStore('readwrite', (s) => s.put(value, key)).then(() => undefined),
    removeItem: (key: string) => withStore('readwrite', (s) => s.delete(key)).then(() => undefined),
  };
}

const persistStorage =
  Platform.OS === 'web' && typeof indexedDB !== 'undefined' ? createIndexedDbStorage() : AsyncStorage;


// Exportiert (statt inline) - features/settings/storage.ts liest den
// persistierten Cache-String direkt aus AsyncStorage, um seine Byte-Größe für
// die Speicherverwaltung zu messen, ohne den Key hier zu duplizieren.
export const QUERY_CACHE_STORAGE_KEY = 'salatibox:query-cache';

export const queryPersister = createAsyncStoragePersister({
  storage: persistStorage,
  key: QUERY_CACHE_STORAGE_KEY,
  throttleTime: 2000,
});

// maxAge darf gcTime nicht überschreiten (sonst restauriert der Persister
// Einträge, die die GC sofort wieder entfernt).
export const QUERY_PERSIST_MAX_AGE = GC_TIME_MS;

// ---- Was NICHT in die Ablage des Query-Caches gehört ----
//
// Die Ablage ist auf Android EINE AsyncStorage-Zeile (SQLite). CursorWindow
// liest eine Zeile höchstens ~2 MB groß; darüber wirft das Lesen
// SQLiteBlobTooBigException, der Persister fängt das ab und verwirft den
// GESAMTEN abgelegten Cache ("the persisted cache will be discarded") — das
// Offline-Mandat oben war damit bei JEDEM Start wirkungslos, nicht nur für den
// zu großen Eintrag. Gemessen am Gerät lag die Zeile bei 5,65 MB.
//
// Der Löwenanteil ist reine DOPPELSPEICHERUNG: Morphologie/Wurzeln/Lemmata
// (features/quran/morphologie.ts) und die Wort-für-Wort-Datensätze
// (features/quran/wbw.ts) und die Wortliste von quran.com
// (features/quran/wortliste.ts) schreiben ihren Inhalt bereits als Datei ins
// Dokumentverzeichnis, die Lexikon-Daten kommen aus dem JS-Bundle
// (features/lexikon/*Loader.ts, dynamic import()). Alle diese Abfragen sind
// nach einem Neustart auch OHNE Ablage sofort und ohne Netz wieder da — ihr
// Platz in der Zeile kostet also nichts als das Offline-Paket aller anderen.
//
// Auch ['quran','word-by-word',n] (quran.com-Wortliste) gehört seither dazu.
// Sie blieb zunächst DRIN, weil sie als einzige keinen Datei-Cache hatte —
// blieb damit aber der größte Posten (Sure 2 allein 1.078.748 Bytes, nach zwei
// Suren lag die Zeile bei 1,83 MB und die Grenze wäre erneut gekippt).
// features/quran/wortliste.ts gibt ihr jetzt denselben Datei-Cache wie den
// anderen; damit ist auch sie eine reine Dopplung. Wie diese Datei verfällt
// (Schema, Anfrage-URL, Höchstalter — die quran.com-Antwort liegt anders als
// Morphologie/wbw NICHT unter einem unveränderlichen Pfad), steht dort.
export function istLokalOhneAblageVerfuegbar(queryKey: readonly unknown[]): boolean {
  const [bereich, art] = queryKey;
  // Das gesamte Lexikon lädt aus dem Bundle (Erklärungen, Paradigmen,
  // Wortlisten) oder über den Datei-Cache von morphologie.ts (roots/lemmas/
  // meta) — kein einziger Lexikon-Eintrag braucht die Ablage.
  if (bereich === 'lexikon') return true;
  if (bereich !== 'quran') return false;
  return art === 'morphologie' || art === 'wurzeln' || art === 'wbw' || art === 'word-by-word';
}

/**
 * `shouldDehydrateQuery` für den Persister (siehe app/_layout.tsx).
 *
 * Zwei Bedingungen, beide bewusst hier und nicht verstreut:
 * 1. `status === 'success'` — die Vorgabe von React Query, hier explizit
 *    festgeschrieben: ein FEHLGESCHLAGENER Abruf darf nie wie ein gültiges
 *    Ergebnis in der Ablage landen (sonst hielte ein einmaliger Timeout die
 *    App über Neustarts hinweg beim Rückfall fest).
 * 2. nicht doppelt gespeichert — siehe {@link istLokalOhneAblageVerfuegbar}.
 *
 * Im ARBEITSSPEICHER bleiben die ausgenommenen Einträge normal im Cache; nur
 * geschrieben wird sie nicht.
 */
export function sollInDieAblage(query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean {
  return query.state.status === 'success' && !istLokalOhneAblageVerfuegbar(query.queryKey);
}

// ---- Explizites "diese Übersetzung offline verfügbar machen" ----
// Das Offline-Mandat oben deckt nur ab, was der Nutzer schon einmal
// GEÖFFNET hat. Für eine Übersetzung, die er noch nie gelesen hat, gibt es
// bisher keine Aktion, die sie proaktiv in den (persistierten) Cache holt.
const QURAN_SURAH_COUNT = 114;
const TRANSLATION_PREFETCH_STALE_TIME = 7 * DAY_MS; // wie STATIC_STALE_TIME in features/quran/hooks.ts

/**
 * Lädt die Übersetzungstexte ALLER 114 Suren einer Edition vorab in den
 * persistierten Query-Cache. Nutzt bewusst denselben queryKey wie
 * useSurahSecondTranslation (['quran','translation2',surah,editionId]) über
 * fetchSurahSecondTranslation - diese Funktion braucht (anders als die
 * kombinierte Sure-Lese-Query aus useSurahReading) KEINE audioEdition, ist
 * also unabhängig vom gerade gewählten Rezitator nutzbar.
 * Sequentiell statt 114 parallele Requests (Netzwerk-/Rate-Limit-Schonung,
 * analog zu downloadFullMushafAudio in features/quran/offline-audio.ts).
 */
export async function prefetchTranslationOffline(
  editionId: string,
  onProgress?: (completedSurahs: number, totalSurahs: number) => void,
): Promise<void> {
  for (let surah = 1; surah <= QURAN_SURAH_COUNT; surah++) {
    await queryClient.prefetchQuery({
      queryKey: ['quran', 'translation2', surah, editionId],
      queryFn: () => fetchSurahSecondTranslation(surah, editionId),
      staleTime: TRANSLATION_PREFETCH_STALE_TIME,
    });
    onProgress?.(surah, QURAN_SURAH_COUNT);
  }
}

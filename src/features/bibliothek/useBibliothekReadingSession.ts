import { useEffect, useRef } from 'react';

import { recordBibliothekReadingSession, toDayString } from '@/features/bibliothek/readingStats';

const FLUSH_MS = 45_000;

function flush(
  startedAt: number,
  pagesThisSession: number,
): { pages: number; seconds: number } | null {
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  if (seconds < 3 && pagesThisSession === 0) return null;
  return { pages: pagesThisSession, seconds: Math.max(1, seconds) };
}

/** R25: Lesezeit + Seitenwechsel lokal erfassen. */
export function useBibliothekReadingSession(active: boolean, page: number) {
  const startedAt = useRef<number | null>(null);
  const lastPage = useRef<number | null>(null);
  const pagesThisSession = useRef(0);

  // Nur `active`-Wechsel startet/beendet die Session; Seitenwechsel separat.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `page` gehoert nicht in diese Lifecycle-Kante
  useEffect(() => {
    if (!active) {
      if (startedAt.current != null) {
        const tick = flush(startedAt.current, pagesThisSession.current);
        if (tick) {
          void recordBibliothekReadingSession({
            day: toDayString(Date.now()),
            pagesRead: tick.pages,
            secondsSpent: tick.seconds,
          });
        }
      }
      startedAt.current = null;
      lastPage.current = null;
      pagesThisSession.current = 0;
      return;
    }
    startedAt.current = Date.now();
    lastPage.current = page;
    pagesThisSession.current = 0;
    const id = setInterval(() => {
      if (startedAt.current == null) return;
      const tick = flush(startedAt.current, pagesThisSession.current);
      if (!tick) return;
      void recordBibliothekReadingSession({
        day: toDayString(Date.now()),
        pagesRead: tick.pages,
        secondsSpent: tick.seconds,
      });
      pagesThisSession.current = 0;
      startedAt.current = Date.now();
    }, FLUSH_MS);
    return () => {
      clearInterval(id);
      if (startedAt.current != null) {
        const tick = flush(startedAt.current, pagesThisSession.current);
        if (tick) {
          void recordBibliothekReadingSession({
            day: toDayString(Date.now()),
            pagesRead: tick.pages,
            secondsSpent: tick.seconds,
          });
        }
      }
    };
  }, [active]);

  useEffect(() => {
    if (!active || startedAt.current == null) return;
    if (lastPage.current != null && page !== lastPage.current) {
      pagesThisSession.current += 1;
    }
    lastPage.current = page;
  }, [active, page]);
}

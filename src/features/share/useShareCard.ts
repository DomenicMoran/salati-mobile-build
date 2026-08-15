import { useCallback, useState } from 'react';

import type { ShareCardContent } from '@/components/share-card';

/** Kleiner State-Controller für <ShareCardModal>, identisch von Quran-Reader
 * und Hadith-Detail genutzt, statt in jedem Screen dieselben drei Zeilen
 * useState/useCallback zu duplizieren. */
export function useShareCard() {
  const [content, setContent] = useState<ShareCardContent | null>(null);
  const open = useCallback((next: ShareCardContent) => setContent(next), []);
  const close = useCallback(() => setContent(null), []);
  return { content, open, close };
}

import { canonicalBibliothekReaderBookId } from '@/features/bibliothek/allinone/constants';
import { isHandoutDownloaded, localHandoutUri } from '@/features/handouts/downloads';

/**
 * Nutzt eine lokal heruntergeladene Handout-PDF wenn bookId mit Handout-id übereinstimmt
 * (z. B. salati-islam-lernwerk). Sonst Remote-URL.
 */
export async function resolveBibliothekPdfUrl(bookId: string, remoteUrl: string): Promise<string> {
  const id = canonicalBibliothekReaderBookId(bookId.trim());
  if (!id) return remoteUrl.trim();
  if (!(await isHandoutDownloaded(id))) return remoteUrl.trim();
  return localHandoutUri(id);
}

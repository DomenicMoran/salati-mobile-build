import shippedBooksManifest from '@/features/bibliothek/manifest/shipped-books.manifest.json';

type ManifestItem = { id?: string; reviewedAt?: string };

/** `reviewedAt` aus shipped-books für Hub-Regal „Zuletzt hinzugefügt“. */
export function manifestReviewedAtByHandoutId(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const item of (shippedBooksManifest.items ?? []) as ManifestItem[]) {
    if (item.id && typeof item.reviewedAt === 'string' && item.reviewedAt.trim()) {
      out[item.id] = item.reviewedAt.trim();
    }
  }
  return out;
}

/** Web: statische Shell unter /public/pdf-reader — keine Asset-requires (SSR-sicher). */
export async function resolvePdfReaderShellUri(): Promise<string> {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/pdf-reader/index.html`;
  }
  return '/pdf-reader/index.html';
}

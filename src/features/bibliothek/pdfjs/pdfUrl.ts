/** Entfernt `#page=`-Fragment und liefert 1-basierte Startseite für pdf.js. */
export function splitPdfUrlAndStartPage(pdfUrl: string): { url: string; startPage?: number } {
  const trimmed = pdfUrl.trim();
  if (!trimmed) return { url: '' };
  const hashIdx = trimmed.indexOf('#');
  const base = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  if (hashIdx < 0) return { url: base };
  const frag = trimmed.slice(hashIdx + 1);
  const match = /^page=(\d+)/i.exec(frag);
  if (!match) return { url: base };
  const page = Number.parseInt(match[1], 10);
  return {
    url: base,
    startPage: Number.isFinite(page) && page >= 1 ? page : undefined,
  };
}

import type { BibliothekBookDetails } from '@/features/bibliothek/bookManifestDetails';

export type BibliothekQuoteShareInput = {
  quote: string;
  page: number;
  book: Pick<
    BibliothekBookDetails,
    'title' | 'author' | 'translator' | 'license' | 'licenseLink' | 'sourceLink' | 'belegUrl'
  >;
};

function licenseLine(book: BibliothekQuoteShareInput['book']): string {
  const parts: string[] = [];
  if (book.license?.trim()) parts.push(book.license.trim());
  const link = book.licenseLink?.trim() || book.belegUrl?.trim() || book.sourceLink?.trim();
  if (link) parts.push(link);
  return parts.join(' · ');
}

/** R13: Zitat mit Quellenangabe (Werk, Autor/Uebersetzer, Seite, Lizenz). */
export function formatBibliothekQuoteShare(input: BibliothekQuoteShareInput): string {
  const quote = input.quote.trim();
  const lines: string[] = [`"${quote}"`, ''];
  const meta: string[] = [`${input.book.title}`, `S. ${input.page}`];
  const person = bookPersonLine(input.book);
  if (person) meta.push(person);
  lines.push(meta.join(' · '));
  const lic = licenseLine(input.book);
  if (lic) {
    lines.push('');
    lines.push(lic);
  }
  return lines.join('\n');
}

function bookPersonLine(book: BibliothekQuoteShareInput['book']): string {
  if (book.translator?.trim()) return book.translator.trim();
  if (book.author?.trim()) return book.author.trim();
  return '';
}

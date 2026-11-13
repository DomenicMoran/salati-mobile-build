import type { BibliothekPdfHighlight } from '@/features/bibliothek/pdfHighlights';

export type ExportBibliothekMarkdownInput = {
  bookTitle: string;
  bookId: string;
  highlights: readonly BibliothekPdfHighlight[];
  exportedAt?: string;
};

function escapeMdInline(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/** R12: Notizen und Markierungen als Markdown (Share-API / Datei-Export). */
export function buildBibliothekHighlightsMarkdown(input: ExportBibliothekMarkdownInput): string {
  const at = input.exportedAt ?? new Date().toISOString();
  const lines: string[] = [
    `# ${input.bookTitle}`,
    '',
    `_Buch-ID: ${input.bookId} · exportiert ${at}_`,
    '',
  ];
  if (input.highlights.length === 0) {
    lines.push('_Keine Markierungen._');
    return lines.join('\n');
  }
  const sorted = [...input.highlights].sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));
  for (const hl of sorted) {
    lines.push(`## Seite ${hl.page}`);
    lines.push('');
    lines.push(`> ${escapeMdInline(hl.text.trim())}`);
    if (hl.note?.trim()) {
      lines.push('');
      lines.push(`**Notiz:** ${escapeMdInline(hl.note.trim())}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

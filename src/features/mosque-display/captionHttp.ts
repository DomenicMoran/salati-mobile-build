/** Minimales HTTP/1.0 für Caption-Seite im LAN — ohne Abhängigkeit von Node. */

export const CAPTION_HTTP_PORT = 8799;

export function parseHttpRequestPath(raw: string): string {
  const first = raw.split('\r\n')[0] ?? '';
  const parts = first.split(' ');
  return parts[1] ?? '/';
}

export function buildCaptionHtml(opts: {
  title: string;
  caption: string;
  disclaimer: string;
  refreshSeconds?: number;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const refresh = opts.refreshSeconds ?? 3;
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="${refresh}" />
  <title>${esc(opts.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0b0b0d; color: #f5f5f5; }
    h1 { font-size: 1.25rem; color: #c9a227; }
    .cap { font-size: clamp(1.25rem, 4vw, 2.5rem); line-height: 1.4; margin: 1.5rem 0; }
    .disc { font-size: 0.85rem; opacity: 0.75; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>${esc(opts.title)}</h1>
  <p class="cap">${esc(opts.caption || '…')}</p>
  <p class="disc">${esc(opts.disclaimer)}</p>
</body>
</html>`;
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function httpHtmlResponse(html: string): string {
  const body = html;
  return (
    'HTTP/1.0 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Content-Length: ${utf8ByteLength(body)}\r\n` +
    'Connection: close\r\n' +
    '\r\n' +
    body
  );
}

export function httpNotFound(): string {
  return 'HTTP/1.0 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n';
}

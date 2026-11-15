/** Minimales HTTP/1.0 für Caption-Seite im LAN — ohne Abhängigkeit von Node. */

export const CAPTION_HTTP_PORT = 8799;

export const CAPTION_SSE_PATH = '/events';
export const CAPTION_LANGS = ['de', 'en', 'tr', 'ar'] as const;
export type CaptionLang = (typeof CAPTION_LANGS)[number];

export type CaptionSharePayload = {
  title: string;
  caption: string;
  disclaimer: string;
  updatedAt: number;
  langs?: Partial<Record<CaptionLang, string>>;
};

let shareSeq = 0;

export function nextCaptionEventId(): string {
  shareSeq += 1;
  return `cap-${shareSeq}`;
}

export function parseHttpRequestPath(raw: string): string {
  const first = raw.split('\r\n')[0] ?? '';
  const parts = first.split(' ');
  return (parts[1] ?? '/').split('?')[0] ?? '/';
}

export function parseHttpQuery(raw: string): Record<string, string> {
  const first = raw.split('\r\n')[0] ?? '';
  const parts = first.split(' ');
  const path = parts[1] ?? '/';
  const q = path.indexOf('?');
  if (q < 0) return {};
  const out: Record<string, string> = {};
  for (const kv of path.slice(q + 1).split('&')) {
    const [k, v] = kv.split('=');
    if (!k) continue;
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    } catch {
      /* ignore */
    }
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function captionPayloadJson(payload: CaptionSharePayload): string {
  return JSON.stringify(payload);
}

export function buildSseEvent(event: string, data: string, id?: string): string {
  const lines = data.split('\n').map((line) => `data: ${line}`);
  const idLine = id ? `id: ${id}\n` : '';
  return `event: ${event}\n${idLine}${lines.join('\n')}\n\n`;
}

export function httpSsePreamble(): string {
  return (
    'HTTP/1.0 200 OK\r\n' +
    'Content-Type: text/event-stream; charset=utf-8\r\n' +
    'Cache-Control: no-cache\r\n' +
    'Connection: keep-alive\r\n' +
    '\r\n'
  );
}

export function buildCaptionHtml(opts: {
  title: string;
  caption: string;
  disclaimer: string;
  hotspotHint?: string;
}): string {
  const langOpts = CAPTION_LANGS.map((l) => `<option value="${l}">${l}</option>`).join('');
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(opts.title)}</title>
  <style>
    :root { color-scheme: dark light; }
    body { font-family: system-ui, sans-serif; margin: 1.5rem; background: #0b0b0d; color: #f5f5f5; }
  body.light { background: #f7f3ea; color: #0b0b0d; }
    h1 { font-size: 1.1rem; color: #c9a227; margin-bottom: 0.5rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin: 0.75rem 0 1rem; }
    select, button { font-size: 1rem; padding: 0.35rem 0.6rem; border-radius: 8px; border: 1px solid #555; background: #1a1a1e; color: inherit; }
    .cap-wrap { max-height: 70vh; overflow-y: auto; scroll-behavior: smooth; }
    .cap { font-size: clamp(1.25rem, 4vw, 2.5rem); line-height: 1.45; margin: 0; white-space: pre-wrap; }
    .disc, .hint { font-size: 0.85rem; opacity: 0.8; margin-top: 1.25rem; }
    .status { font-size: 0.75rem; opacity: 0.65; }
    .offline { color: #e8a87c; }
  </style>
</head>
<body>
  <h1>${esc(opts.title)}</h1>
  <div class="toolbar">
    <label>Sprache <select id="lang" aria-label="Sprache">${langOpts}</select></label>
    <span id="status" class="status">SSE …</span>
  </div>
  <div class="cap-wrap" id="wrap"><p class="cap" id="cap">${esc(opts.caption || '…')}</p></div>
  <p class="disc">${esc(opts.disclaimer)}</p>
  ${opts.hotspotHint ? `<p class="hint">${esc(opts.hotspotHint)}</p>` : ''}
  <script>
(function(){
  var cap = document.getElementById('cap');
  var wrap = document.getElementById('wrap');
  var status = document.getElementById('status');
  var lang = document.getElementById('lang');
  var last = { caption: ${JSON.stringify(opts.caption)}, langs: {} };
  function show(text){
    if(!text) return;
    cap.textContent = text;
    wrap.scrollTop = wrap.scrollHeight;
  }
  function pick(p){
    var code = lang && lang.value;
    if (p.langs && code && p.langs[code]) return p.langs[code];
    return p.caption || '';
  }
  var es = new EventSource('${CAPTION_SSE_PATH}');
  es.addEventListener('caption', function(e){
    try {
      var p = JSON.parse(e.data);
      last = p;
      show(pick(p));
      status.textContent = 'live';
      status.classList.remove('offline');
    } catch(err) {}
  });
  es.onerror = function(){
    status.textContent = 'getrennt — gleiches WLAN?';
    status.classList.add('offline');
  };
  if (lang) lang.addEventListener('change', function(){ show(pick(last)); });
})();
  </script>
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
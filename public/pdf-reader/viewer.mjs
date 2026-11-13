import * as pdfjsLib from '/pdf-reader/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-reader/pdf.worker.min.mjs';

const wrap = document.getElementById('wrap');
const statusEl = document.getElementById('status');
const findLayer = document.getElementById('find-layer');

/** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
let pdfDoc = null;
let pageCount = 0;
let currentPage = 1;
let scale = 1.15;
let scrollMode = 'page';
let theme = 'day';
let loadStartedAt = 0;
let rendering = false;
let renderQueue = null;

function post(message) {
  const raw = JSON.stringify(message);
  if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
    window.ReactNativeWebView.postMessage(raw);
    return;
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ salatiPdfBridge: raw }, '*');
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function applyTheme(next) {
  theme = next;
  document.body.classList.remove('theme-day', 'theme-night', 'theme-sepia');
  document.body.classList.add(`theme-${next}`);
}

function applyScrollMode(mode) {
  scrollMode = mode === 'scroll' ? 'scroll' : 'page';
  wrap.classList.toggle('scroll-mode', scrollMode === 'scroll');
}

async function renderPage(pageNum) {
  if (!pdfDoc || rendering) {
    renderQueue = pageNum;
    return;
  }
  rendering = true;
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const shell = document.createElement('div');
    shell.className = 'page-shell';
    shell.dataset.page = String(pageNum);
    shell.appendChild(canvas);
    if (scrollMode === 'page') {
      wrap.replaceChildren(shell);
    } else {
      const existing = wrap.querySelector(`[data-page="${pageNum}"]`);
      if (existing) existing.remove();
      wrap.appendChild(shell);
    }
    await page.render({ canvasContext: ctx, viewport }).promise;
    setStatus('');
    post({ type: 'pagechange', page: pageNum, pageCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'render_failed';
    post({ type: 'error', code: 'render', message });
  } finally {
    rendering = false;
    if (renderQueue != null) {
      const next = renderQueue;
      renderQueue = null;
      void renderPage(next);
    }
  }
}

async function renderAllPagesLazy() {
  wrap.replaceChildren();
  for (let p = 1; p <= pageCount; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    await renderPage(p);
  }
}

async function loadOutline() {
  if (!pdfDoc) return;
  try {
    const outline = await pdfDoc.getOutline();
    if (!outline?.length) {
      post({ type: 'outline', items: [] });
      return;
    }
    const flat = [];
    const walk = (items, depth = 0) => {
      for (const item of items) {
        flat.push({
          title: typeof item.title === 'string' ? item.title : 'Kapitel',
          depth,
        });
        if (item.items?.length) walk(item.items, depth + 1);
      }
    };
    walk(outline);
    post({ type: 'outline', items: flat });
  } catch {
    post({ type: 'outline', items: [] });
  }
}

async function loadPdf(url, startPage) {
  loadStartedAt = performance.now();
  setStatus('PDF wird geladen…');
  wrap.replaceChildren();
  try {
    if (pdfDoc) {
      await pdfDoc.destroy();
      pdfDoc = null;
    }
    const task = pdfjsLib.getDocument({ url, withCredentials: false });
    pdfDoc = await task.promise;
    pageCount = pdfDoc.numPages;
    const safePage = Number.isInteger(startPage) && startPage >= 1 ? Math.min(startPage, pageCount) : 1;
    currentPage = safePage;
    const ttfpMs = Math.round(performance.now() - loadStartedAt);
    if (scrollMode === 'scroll') {
      void renderAllPagesLazy();
    } else {
      await renderPage(currentPage);
    }
    void loadOutline();
    post({ type: 'ready', page: currentPage, pageCount, ttfpMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'load_failed';
    post({ type: 'error', code: 'load', message });
    setStatus('Fehler beim Laden.');
  }
}

async function goToPage(page) {
  if (!pdfDoc) return;
  const target = Math.max(1, Math.min(pageCount, Math.floor(page)));
  currentPage = target;
  if (scrollMode === 'scroll') {
    const el = wrap.querySelector(`[data-page="${target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      await renderPage(target);
      wrap.querySelector(`[data-page="${target}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    post({ type: 'pagechange', page: target, pageCount });
    return;
  }
  await renderPage(target);
}

async function runSearch(query) {
  if (!pdfDoc || !query?.trim()) {
    post({ type: 'searchHit', query: query ?? '', total: 0, matches: [] });
    return;
  }
  const q = query.trim().toLowerCase();
  const matches = [];
  for (let p = 1; p <= pageCount; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdfDoc.getPage(p);
    // eslint-disable-next-line no-await-in-loop
    const text = await page.getTextContent();
    const joined = text.items.map((it) => ('str' in it ? it.str : '')).join(' ').toLowerCase();
    if (joined.includes(q)) {
      matches.push({ page: p, excerpt: joined.slice(Math.max(0, joined.indexOf(q) - 24), joined.indexOf(q) + q.length + 24) });
      if (matches.length >= 25) break;
    }
  }
  post({ type: 'searchHit', query, total: matches.length, matches });
  if (matches[0]) await goToPage(matches[0].page);
}

function onTextSelection() {
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? '';
  if (text.length < 2) return;
  post({ type: 'textSelected', page: currentPage, text: text.slice(0, 2000) });
}

function handleCommand(data) {
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
  switch (data.type) {
    case 'load':
      applyTheme(data.theme === 'night' || data.theme === 'sepia' ? data.theme : 'day');
      if (typeof data.zoom === 'number' && data.zoom > 0.5 && data.zoom < 4) scale = data.zoom;
      applyScrollMode(data.scrollMode);
      void loadPdf(String(data.pdfUrl ?? ''), data.page);
      break;
    case 'goToPage':
      void goToPage(Number(data.page));
      break;
    case 'search':
      void runSearch(String(data.query ?? ''));
      break;
    case 'setTheme':
      applyTheme(data.theme === 'night' || data.theme === 'sepia' ? data.theme : 'day');
      if (pdfDoc) void renderPage(currentPage);
      break;
    case 'setZoom':
      if (typeof data.zoom === 'number' && data.zoom > 0.5 && data.zoom < 4) {
        scale = data.zoom;
        if (pdfDoc) void renderPage(currentPage);
      }
      break;
    case 'setScrollMode':
      applyScrollMode(data.mode);
      break;
    default:
      break;
  }
}

function parseIncoming(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

document.addEventListener('message', (ev) => {
  handleCommand(parseIncoming(ev.data));
});
window.addEventListener('message', (ev) => {
  if (ev.data && typeof ev.data === 'object' && typeof ev.data.salatiPdfBridge === 'string') {
    handleCommand(parseIncoming(ev.data.salatiPdfBridge));
    return;
  }
  if (typeof ev.data === 'string') handleCommand(parseIncoming(ev.data));
});

document.addEventListener('selectionchange', () => {
  onTextSelection();
});

post({ type: 'ready', page: 0, pageCount: 0, ttfpMs: 0, shell: true });

// Standalone-Aufruf /pdf-reader ohne Bridge-„load“: kein ewiges „wird vorbereitet“.
if (typeof window !== 'undefined' && window.parent === window) {
  window.setTimeout(() => {
    if (!pdfDoc) {
      setStatus(
        'Kein Buch geöffnet. Wähle ein PDF in der Bibliothek oder unter Lernunterlagen.',
      );
    }
  }, 1200);
}

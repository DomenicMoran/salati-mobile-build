/* Salati Service Worker — schlank und ohne Build-Schritt.
 *
 * Hintergrund (Audit 2026-07-27, WEBSITE-MEDIEN.md): die Startseite wirbt mit
 * "offline nutzbar", die Web-Fassung hatte aber keinen Service Worker
 * (GET /sw.js -> 404). Nativ stimmte die Aussage, auf Web nicht.
 *
 * Strategie
 *   - Navigationen (HTML): network-first mit Cache-Fallback. Damit ist die
 *     Seite immer aktuell, funktioniert aber offline weiter. Fällt auch die
 *     konkrete Route aus, greift die gecachte Startseite.
 *   - /_expo/static/** und /assets/**: cache-first. Diese Dateien tragen den
 *     Content-Hash im Namen (vercel.json setzt dort max-age=31536000,
 *     immutable) — eine Änderung erzeugt einen neuen Pfad, alte Einträge
 *     werden beim Versionswechsel weggeräumt.
 *   - übrige gleichnamige GETs (Daten wie manifest/Icons): stale-while-
 *     revalidate — sofort aus dem Cache, im Hintergrund erneuern.
 *   - NICHT angefasst: /models/** (102 MB ONNX-Whisper), /rag/** (2,7 MB
 *     Embeddings) und alle Fremd-Origins (api.aladhan.com, R2, Supabase).
 *     Die bringen eigene Caches mit bzw. würden das Cache-Kontingent sprengen.
 *
 * Aktualisierung: kein skipWaiting. Ein neuer Worker übernimmt beim nächsten
 * vollständigen Laden — nie mitten in einer Sitzung. Die Registrierung im
 * HTML meldet `salati:sw-update`, sobald eine neue Version bereitsteht.
 */
const VERSION = 'v1';
const SHELL_CACHE = `salati-shell-${VERSION}`;
const ASSET_CACHE = `salati-assets-${VERSION}`;
const DATA_CACHE = `salati-data-${VERSION}`;

// App-Shell: Einstiegspunkte, die offline sofort da sein müssen.
const SHELL_URLS = ['/', '/prayer', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Einzeln statt addAll: eine fehlende Datei darf die Installation nicht
      // komplett scheitern lassen.
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        ),
      ),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

function isHashedAsset(url) {
  return url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/');
}

function isExcluded(url) {
  return url.pathname.startsWith('/models/') || url.pathname.startsWith('/rag/');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = (await cache.match(request)) || (await cache.match('/'));
    if (hit) return hit;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isExcluded(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isHashedAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

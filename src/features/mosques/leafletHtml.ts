// Gemeinsame Leaflet/OSM-Konstanten + HTML-Generator für die Moscheen-Karte.
//
// Native (MosquesMapView.tsx) rendert Leaflet in einer react-native-webview,
// Web (MosquesMapView.web.tsx) lädt dasselbe Leaflet-Bundle direkt ins DOM.
// Beide Wege nutzen bewusst Leaflet.js + OSM-Tiles via CDN statt einer
// nativen Maps-Bibliothek (react-native-maps lädt auf Android IMMER das
// native Google-Maps-SDK, auch bei reinen OSM-Overlays - GitHub-Issue
// #5156/#5245 - und crasht dort ohne kostenpflichtigen Google-Maps-Key,
// siehe Commit d42ea25). Eine WebView/ein <script>-Tag initialisiert kein
// natives SDK und kann strukturell nicht denselben Crash auslösen.
import type { Mosque } from './overpass';

const LEAFLET_VERSION = '1.9.4';
export const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
export const LEAFLET_JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

// OSM-Tile-Nutzungsrichtlinie (https://operations.osmfoundation.org/policies/tiles/):
// Attribution ist Pflicht (im UI sichtbar, nicht nur im Quellcode) - bei
// diesem Nutzungsumfang (paar hundert Tile-Requests je Nutzer, kein Bulk-
// Download) unkritisch für den Fair-Use-Rahmen des Tile-Servers.
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** JSON für die Einbettung in ein <script>-Tag - neutralisiert "</" gegen vorzeitiges Tag-Ende. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Baut das komplette lokale HTML-Dokument für die WebView-Karte (nativ).
 * Marker-Namen/-Adressen werden HTML-escaped, bevor sie in Popups landen
 * (Overpass-Daten sind Fremddaten, könnten theoretisch "<"/"&" enthalten).
 */
export function buildLeafletHtml(
  userLat: number,
  userLon: number,
  mosques: (Mosque & { distanceKm: number })[],
  routeLabel: string,
): string {
  const points = mosques.map((m) => ({
    id: m.id,
    lat: m.lat,
    lon: m.lon,
    name: escHtml(m.name),
    address: m.address ? escHtml(m.address) : '',
    km: m.distanceKm.toFixed(1),
  }));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS_URL}">
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; }
  .salati-mosque-icon { font-size: 22px; line-height: 22px; text-align: center; }
  .salati-user-dot { width: 14px; height: 14px; border-radius: 7px; background: #1a73e8; border: 2px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,.4); }
  .leaflet-popup-content { font-family: system-ui, sans-serif; font-size: 13px; }
  .salati-route-btn { display: inline-block; margin-top: 6px; padding: 6px 10px; background: #0b6b53; color: #fff; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 12.5px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET_JS_URL}"></script>
<script>
(function () {
  var points = ${jsonForScript(points)};
  var routeLabel = ${jsonForScript(routeLabel)};
  var userLat = ${userLat};
  var userLon = ${userLon};

  var map = L.map('map', { zoomControl: true });
  L.tileLayer('${OSM_TILE_URL}', { maxZoom: 19, attribution: '${OSM_ATTRIBUTION}' }).addTo(map);

  L.marker([userLat, userLon], {
    icon: L.divIcon({ className: '', html: '<div class="salati-user-dot"></div>', iconSize: [14, 14] }),
    keyboard: false,
  }).addTo(map);

  var mosqueIcon = L.divIcon({ className: 'salati-mosque-icon', html: '🕌', iconSize: [24, 24], popupAnchor: [0, -10] });

  var bounds = L.latLngBounds([[userLat, userLon]]);
  points.forEach(function (p) {
    var marker = L.marker([p.lat, p.lon], { icon: mosqueIcon }).addTo(map);
    bounds.extend([p.lat, p.lon]);
    var html = '<b>' + p.name + '</b>';
    if (p.address) html += '<br>' + p.address;
    html += '<br>' + p.km + ' km';
    // p.id ist seit Audit 2026-07-27 (O2) eine Zeichenkette ("node/123") —
    // roh eingesetzt ergaebe das ungueltiges JS. JSON.stringify erzeugt das
    // Literal inkl. Anfuehrungszeichen und escapt Sonderzeichen.
    html += '<br><a class="salati-route-btn" href="#" onclick="window.ReactNativeWebView \\u0026\\u0026 window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'route\\',id:' + JSON.stringify(p.id).replace(/"/g, '&quot;') + '})); return false;">' + routeLabel + '</a>';
    marker.bindPopup(html);
  });

  if (points.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  } else {
    map.setView([userLat, userLon], 13);
  }
})();
</script>
</body>
</html>`;
}

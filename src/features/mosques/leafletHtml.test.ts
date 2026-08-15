/**
 * Der Routen-Knopf im Karten-Popup ist generiertes JavaScript in einem
 * HTML-Attribut — der einzige Teil der App, dessen Korrektheit weder
 * TypeScript noch der Linter prueft. Mit der zusammengesetzten `Mosque.id`
 * (Audit 2026-07-27, O2) haette die bisherige rohe Einsetzung
 * `id:way/240094030` ergeben: syntaktisch gueltiges, semantisch kaputtes JS
 * (Bezeichner `way` geteilt durch eine Zahl) — der Knopf haette beim Klick
 * mit einem ReferenceError abgebrochen, ohne Spur im UI.
 *
 * Deshalb fuehrt dieser Test das erzeugte Skript wirklich aus (mit einem
 * Leaflet-Stub) und klickt den Knopf. Gegen den Stand vor dem Fix ist
 * „meldet die vollstaendige id zurueck" rot.
 */
import { buildLeafletHtml } from './leafletHtml';
import type { Mosque } from './overpass';

function mosque(over: Partial<Mosque> = {}): Mosque & { distanceKm: number } {
  return { id: 'node/1', lat: 52.5, lon: 13.4, name: 'Moschee', distanceKm: 1.234, ...over };
}

interface Marker {
  addTo: () => Marker;
  bindPopup: (html: string) => void;
}

/** Fuehrt das erzeugte <script> mit einem Leaflet-Stub aus und liefert die
 *  Popup-HTML jedes Markers zurueck. */
function runScript(html: string): string[] {
  const source = /<script>\n([\s\S]*?)<\/script>/.exec(html.split('leaflet.js"></script>')[1] ?? '');
  if (!source) throw new Error('kein eingebettetes Skript gefunden');
  const popups: string[] = [];
  const marker = (): Marker => {
    const m: Marker = {
      addTo: () => m,
      bindPopup: (popupHtml: string) => {
        popups.push(popupHtml);
      },
    };
    return m;
  };
  const L = {
    map: () => ({ fitBounds: () => {}, setView: () => {} }),
    tileLayer: () => ({ addTo: () => {} }),
    marker,
    divIcon: () => ({}),
    latLngBounds: () => ({ extend: () => {} }),
  };
  // Bewusst ausgefuehrt statt im Quelltext gemustert: genau das ist der Zweck
  // dieses Tests. Die Eingabe ist ein Fixture aus dieser Datei, keine
  // Fremddaten.
  new Function('L', source[1])(L);
  return popups;
}

/** Klickt den Routen-Knopf eines Popups und liefert die gesendete Nachricht. */
function pressRouteButton(popupHtml: string): unknown {
  const onclick = /onclick="([^"]*)"/.exec(popupHtml);
  if (!onclick) throw new Error('kein Routen-Knopf im Popup');
  // Der Browser dekodiert HTML-Entities im Attribut, BEVOR der Inhalt als JS
  // gelesen wird — dasselbe hier.
  const code = onclick[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
  let received: unknown;
  const win = { ReactNativeWebView: { postMessage: (m: string) => { received = JSON.parse(m); } } };
  new Function('window', code)(win);
  return received;
}

describe('buildLeafletHtml — Routen-Knopf', () => {
  it('meldet die vollstaendige id zurueck (Typ + Zahl)', () => {
    const html = buildLeafletHtml(52.52, 13.405, [mosque({ id: 'way/240094030' })], 'Route');
    const [popup] = runScript(html);
    expect(pressRouteButton(popup)).toEqual({ type: 'route', id: 'way/240094030' });
  });

  it('haelt node und way mit derselben Zahl auseinander', () => {
    const html = buildLeafletHtml(
      52.52,
      13.405,
      [mosque({ id: 'node/240094030' }), mosque({ id: 'way/240094030', name: 'Zweite' })],
      'Route',
    );
    const popups = runScript(html);
    expect(popups).toHaveLength(2);
    expect(pressRouteButton(popups[0])).toEqual({ type: 'route', id: 'node/240094030' });
    expect(pressRouteButton(popups[1])).toEqual({ type: 'route', id: 'way/240094030' });
  });
});

describe('buildLeafletHtml — Fremddaten', () => {
  it('escaped Namen und Adressen aus OSM', () => {
    const html = buildLeafletHtml(
      52.52,
      13.405,
      [mosque({ name: '<script>x</script>', address: 'A & B' })],
      'Route',
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
  });

  it('uebernimmt jede Moschee genau einmal in die Punkteliste', () => {
    const html = buildLeafletHtml(
      52.52,
      13.405,
      [mosque({ id: 'node/1' }), mosque({ id: 'way/1', name: 'Zweite' })],
      'Route',
    );
    expect(html).toContain('"id":"node/1"');
    expect(html).toContain('"id":"way/1"');
  });

  it('kommt ohne Treffer aus (setView statt fitBounds)', () => {
    expect(runScript(buildLeafletHtml(52.52, 13.405, [], 'Route'))).toEqual([]);
  });
});

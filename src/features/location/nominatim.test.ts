import { nominatimResultToLocation, type NominatimLocation, type NominatimResult } from './nominatim';

// Das Ergebnis landet direkt in settings.location und damit in JEDER
// Gebetszeit-Berechnung. Falsche Koordinaten heißen falsche Gebetszeiten —
// deshalb hier explizit die Zahl-Konvertierung, das Vorzeichen (Süd/West) und
// die Beschriftung.

function result(over: Partial<NominatimResult> = {}): NominatimResult {
  return {
    place_id: 1,
    display_name: 'Berlin, Deutschland',
    lat: '52.5200066',
    lon: '13.404954',
    address: { country: 'Deutschland', country_code: 'de' },
    ...over,
  };
}

/** Erwartet einen brauchbaren Treffer — sonst schlaegt der Test hier fehl
 *  statt spaeter mit einer nichtssagenden Null-Meldung. */
function ok(r: NominatimResult): NominatimLocation {
  const loc = nominatimResultToLocation(r);
  if (!loc) throw new Error('erwartete einen brauchbaren Standort');
  return loc;
}

describe('nominatimResultToLocation', () => {
  it('nimmt den ersten Teil des display_name als Stadt', () => {
    const loc = ok(result({ display_name: 'Köln, Nordrhein-Westfalen, Deutschland' }));
    expect(loc.city).toBe('Köln');
  });

  it('wandelt Koordinaten in Zahlen um', () => {
    const loc = ok(result());
    expect(loc.lat).toBeCloseTo(52.5200066, 6);
    expect(loc.lon).toBeCloseTo(13.404954, 6);
  });

  it('behält negative Koordinaten (Südhalbkugel / westliche Länge)', () => {
    const loc = ok(result({ lat: '-6.7924', lon: '39.2083', display_name: 'Daressalam, Tansania' }));
    expect(loc.lat).toBeCloseTo(-6.7924, 4);
    expect(loc.lon).toBeCloseTo(39.2083, 4);
  });

  it('setzt den Ländercode in Großbuchstaben', () => {
    expect(ok(result({ address: { country_code: 'tr', country: 'Türkiye' } })).country).toBe(
      'TR',
    );
  });

  it('baut das Label als "Stadt, Land"', () => {
    expect(ok(result()).label).toBe('Berlin, Deutschland');
  });

  it('lässt bei fehlendem Ländernamen nur die Stadt im Label stehen', () => {
    const loc = ok(result({ display_name: 'Mekka', address: { country_code: 'sa' } }));
    expect(loc.label).toBe('Mekka');
    expect(loc.country).toBe('SA');
  });

  it('trimmt Leerzeichen aus dem display_name', () => {
    expect(ok(result({ display_name: '  Kairo , Ägypten' })).city).toBe('Kairo');
  });

  it('kommt mit nicht-lateinischen Ortsnamen klar', () => {
    const loc = ok(result({ display_name: 'القاهرة, مصر', address: { country_code: 'eg', country: 'مصر' } }));
    expect(loc.city).toBe('القاهرة');
    expect(loc.label).toBe('القاهرة, مصر');
  });

  it('nutzt bei komplett fehlender Adresse den dokumentierten DE-Standard', () => {
    // Dokumentiert das aktuelle Verhalten: `country` ist nur ein Anzeige-/
    // Gruppierungswert, die Gebetszeiten rechnen ausschließlich mit lat/lon.
    expect(ok(result({ address: undefined })).country).toBe('DE');
  });
});

/**
 * Audit 2026-07-27, Befund O4.
 *
 * Vor dem Fix ging jeder dieser Faelle als `{ lat: NaN, lon: NaN }` durch und
 * wurde von settings.tsx/onboarding.tsx ungeprueft in `settings.location`
 * geschrieben — ab da rechneten Gebetszeiten, Qibla und Hijri-Tage still mit
 * NaN. Gegen den alten Stand ist jede Zeile unten rot (`toBeNull()` gegen ein
 * Objekt).
 */
describe('unbrauchbare Koordinaten (O4)', () => {
  it.each([
    ['leere Zeichenkette', '', '13.4'],
    ['Text', 'keine-zahl', '13.4'],
    ['nur ein Minus', '-', '13.4'],
    ['NaN als Wort', 'NaN', '13.4'],
    ['kaputte Laenge', '52.5', 'null'],
  ])('lehnt %s ab statt NaN zu liefern', (_name, lat, lon) => {
    expect(nominatimResultToLocation(result({ lat, lon }))).toBeNull();
  });

  it.each([
    ['Breite ueber 90', '91', '13.4'],
    ['Breite unter -90', '-90.1', '13.4'],
    ['Laenge ueber 180', '52.5', '180.5'],
    ['Laenge unter -180', '52.5', '-181'],
  ])('lehnt %s ab — ausserhalb des Wertebereichs', (_name, lat, lon) => {
    expect(nominatimResultToLocation(result({ lat, lon }))).toBeNull();
  });

  it('laesst die Grenzwerte selbst zu (Pol / Datumsgrenze)', () => {
    expect(ok(result({ lat: '90', lon: '180' })).lat).toBe(90);
    expect(ok(result({ lat: '-90', lon: '-180' })).lon).toBe(-180);
  });

  it('akzeptiert weiterhin die Nachkomma-Schreibweise von Nominatim', () => {
    expect(ok(result({ lat: '52.5200066', lon: '13.404954' })).lat).toBeCloseTo(52.52, 2);
  });
});

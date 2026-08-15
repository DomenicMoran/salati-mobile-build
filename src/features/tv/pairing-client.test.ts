import { PAIR_DEFAULT_PORT, parseManualPair, parsePairPayload, tvSyncNutzlast } from './pairing-client';

// react-native-tcp-socket registriert beim Import einen NativeEventEmitter —
// in Jest gibt es kein natives Modul, deshalb ein minimaler Mock (babel-jest
// hebt jest.mock ohnehin über die Imports). Getestet wird ausschließlich der
// reine QR-Parser; der Rest des Moduls ist Socket-I/O.
jest.mock('react-native-tcp-socket', () => ({ __esModule: true, default: { connect: jest.fn() } }));

// Die QR-Nutzlast kommt aus der Kamera — also aus einer beliebigen Quelle.
// Ein zu großzügiger Parser würde die App dazu bringen, eine TCP-Verbindung
// zu einem fremden Host aufzubauen und dorthin ein Token zu schicken.

describe('parsePairPayload — gültige Nutzlasten', () => {
  it('parst Host, Port und Token', () => {
    expect(parsePairPayload('salatitv://pair?host=192.168.1.42&port=8765&token=abc123')).toEqual({
      host: '192.168.1.42',
      port: 8765,
      token: 'abc123',
    });
  });

  it('ist unabhängig von der Parameter-Reihenfolge', () => {
    expect(parsePairPayload('salatitv://pair?token=t&port=1&host=h')).toEqual({
      host: 'h',
      port: 1,
      token: 't',
    });
  });

  it('dekodiert prozentkodierte Werte', () => {
    expect(parsePairPayload('salatitv://pair?host=fe80%3A%3A1&port=8765&token=a%2Bb%3Dc')).toEqual({
      host: 'fe80::1',
      port: 8765,
      token: 'a+b=c',
    });
  });

  it('ignoriert unbekannte Zusatzparameter', () => {
    expect(parsePairPayload('salatitv://pair?host=h&port=1&token=t&v=2&x=')).toEqual({
      host: 'h',
      port: 1,
      token: 't',
    });
  });
});

describe('parsePairPayload — abgelehnte Nutzlasten', () => {
  it.each([
    ['leerer String', ''],
    ['fremdes Schema', 'https://example.com/pair?host=h&port=1&token=t'],
    ['anderes Salati-Schema', 'salatibox://quran/2?ayah=1'],
    ['Präfix ohne Query', 'salatitv://pair'],
    ['Host fehlt', 'salatitv://pair?port=1&token=t'],
    ['Host leer', 'salatitv://pair?host=&port=1&token=t'],
    ['Token fehlt', 'salatitv://pair?host=h&port=1'],
    ['Token leer', 'salatitv://pair?host=h&port=1&token='],
    ['Port fehlt', 'salatitv://pair?host=h&token=t'],
    ['Port keine Zahl', 'salatitv://pair?host=h&port=abc&token=t'],
    ['Port 0', 'salatitv://pair?host=h&port=0&token=t'],
    ['Port negativ', 'salatitv://pair?host=h&port=-1&token=t'],
  ])('lehnt ab: %s', (_label, raw) => {
    expect(parsePairPayload(raw)).toBeNull();
  });

  it('lehnt eine getarnte Nutzlast ab, die das Schema nur enthält statt damit zu beginnen', () => {
    expect(parsePairPayload('https://evil.example/?u=salatitv://pair?host=h&port=1&token=t')).toBeNull();
  });

  // Audit 2026-07-27: decodeURIComponent('%') wirft einen URIError. Der
  // Aufrufer ist der onBarcodeScanned-Callback (app/tv-connect.tsx) ohne
  // try/catch — ein geworfener Fehler riss dort den Scan-Screen mit.
  it.each([
    ['einzelnes Prozentzeichen im Host', 'salatitv://pair?host=%&port=1&token=t'],
    ['abgeschnittene Kodierung im Token', 'salatitv://pair?host=h&port=1&token=ab%2'],
    ['ungültige Hex-Ziffern', 'salatitv://pair?host=%zz&port=1&token=t'],
    ['kaputter Parametername', 'salatitv://pair?%=x&host=h&port=1&token=t'],
  ])('gibt bei kaputter Prozentkodierung (%s) null zurück statt zu werfen', (_label, raw) => {
    expect(() => parsePairPayload(raw)).not.toThrow();
    expect(parsePairPayload(raw)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Einstellungs-Uebertragung ans TV. Die Feldnamen und Wertformen muessen exakt
// zu apps/tv/src/lib/settings.applyRemoteSettings passen — weicht eine Seite
// ab, rechnet der Fernseher still mit seinen eigenen Vorgaben weiter (genau
// der Befund aus docs/audit-2026-07-27/HANDY-TV-ABGLEICH.md).
describe('tvSyncNutzlast', () => {
  const basis = {
    location: { lat: 48.137, lon: 11.575, label: 'München, Deutschland', city: 'München', country: 'DE' },
    method: 3,
    school: 1 as const,
    highLatitudeRule: 'twilightAngle',
    prayerTimeOffsets: { fajr: -2, sunrise: 0, dhuhr: 1, asr: 0, maghrib: 0, isha: 3 },
    timeFormat: '12h' as const,
  };

  it('bildet Ort, Methode und Madhab auf die TV-Felder ab', () => {
    expect(tvSyncNutzlast(basis)).toEqual({
      t: 'einstellungen',
      location: {
        lat: 48.137,
        lon: 11.575,
        label: 'München, Deutschland',
        method: 3,
        madhab: 'hanafi',
      },
      is24h: false,
      highLatitude: 'twilightAngle',
      offsets: { fajr: -2, sunrise: 0, dhuhr: 1, asr: 0, maghrib: 0, isha: 3 },
    });
  });

  it('uebersetzt school 0 nach shafi und 24h-Format nach is24h', () => {
    const n = tvSyncNutzlast({ ...basis, school: 0, timeFormat: '24h' });
    expect(n.location.madhab).toBe('shafi');
    expect(n.is24h).toBe(true);
  });

  it('schickt keine Sprache mit — der Fernseher behaelt seine eigene', () => {
    expect(Object.keys(tvSyncNutzlast(basis))).toEqual([
      't',
      'location',
      'is24h',
      'highLatitude',
      'offsets',
    ]);
  });
});

/**
 * Manuelle Eingabe (2026-08-08). Der Fernseher zeigte seit jeher eine Zeile
 * „Manuell: host:port · Code …", mit der das Handy nichts anfangen konnte — es
 * kannte nur die Kamera. Wer eine verschmutzte Linse hat, die Kamera-
 * Berechtigung abgelehnt hat oder zu weit weg sitzt, stand vor einer
 * Sackgasse, obwohl alle Angaben gross auf dem Schirm standen.
 */
describe('parseManualPair', () => {
  it('liest host:port und Code', () => {
    expect(parseManualPair('192.168.1.50:8787', 'ABC123')).toEqual({
      host: '192.168.1.50',
      port: 8787,
      token: 'ABC123',
    });
  });

  it('nimmt den Standard-Port, wenn keiner angegeben ist', () => {
    expect(parseManualPair('192.168.1.50', 'ABC123')).toEqual({
      host: '192.168.1.50',
      port: PAIR_DEFAULT_PORT,
      token: 'ABC123',
    });
  });

  it('macht aus Kleinbuchstaben den Code, den der Fernseher zeigt', () => {
    // Fernbedienungs-Tastaturen schreiben oft klein; der Fernseher zeigt gross.
    expect(parseManualPair('10.0.0.5', 'abc123')?.token).toBe('ABC123');
  });

  it('ignoriert Leerzeichen um die Eingaben', () => {
    expect(parseManualPair('  10.0.0.5:9000  ', '  XY7  ')).toEqual({
      host: '10.0.0.5',
      port: 9000,
      token: 'XY7',
    });
  });

  it('behandelt einen unbrauchbaren Port als „nicht angegeben"', () => {
    // „:port" ist Teil eines Hostnamens nur, wenn dahinter eine Zahl steht.
    expect(parseManualPair('tv.local:abc', 'T1')).toEqual({
      host: 'tv.local:abc',
      port: PAIR_DEFAULT_PORT,
      token: 'T1',
    });
  });

  it.each([
    ['', 'ABC'],
    ['10.0.0.5', ''],
    ['   ', 'ABC'],
    ['192.168.1.50 · Code', 'ABC'],
    ['nicht/erlaubt', 'ABC'],
  ])('weist unbrauchbare Eingaben ab (%s / %s)', (host, code) => {
    expect(parseManualPair(host, code)).toBeNull();
  });

  it('laesst einen Port ausserhalb des gueltigen Bereichs nicht durch', () => {
    expect(parseManualPair('10.0.0.5:70000', 'T1')?.port).toBe(PAIR_DEFAULT_PORT);
  });
});

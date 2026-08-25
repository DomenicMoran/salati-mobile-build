import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadAllVideoProgress, loadVideoProgress, saveVideoProgress } from './progress';

// "Weiterschauen" ist Nutzer-Fortschritt: eine falsch gespeicherte Position
// lässt eine Folge entweder am Ende wieder aufspringen oder verliert die
// Stelle ganz. Die Grenzen (<5 s Anfang, >=95 % Ende) sind daher explizit
// beidseitig geprüft.

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('saveVideoProgress / loadVideoProgress', () => {
  it('merkt eine Position mitten in der Folge', async () => {
    await saveVideoProgress(4, 120, 600);
    expect(await loadVideoProgress(4)).toBe(120);
  });

  it('merkt Position und Dauer für die Fortschrittsanzeige', async () => {
    await saveVideoProgress(4, 120, 600);
    expect(await loadAllVideoProgress()).toEqual({
      '4': { position: 120, duration: 600, updatedAt: expect.any(Number) },
    });
  });

  it('liefert 0 für eine nie angesehene Folge', async () => {
    expect(await loadVideoProgress(99)).toBe(0);
  });
});

describe('Anfangs-Grenze (5 s)', () => {
  it('speichert unter 5 s nichts', async () => {
    await saveVideoProgress(1, 4.9, 600);
    expect(await loadVideoProgress(1)).toBe(0);
  });

  it('speichert ab genau 5 s', async () => {
    await saveVideoProgress(1, 5, 600);
    expect(await loadVideoProgress(1)).toBe(5);
  });

  it('löscht eine bestehende Position, wenn der Nutzer zurück an den Anfang springt', async () => {
    await saveVideoProgress(1, 300, 600);
    await saveVideoProgress(1, 2, 600);
    expect(await loadVideoProgress(1)).toBe(0);
    expect(await loadAllVideoProgress()).toEqual({});
  });
});

describe('Ende-Grenze (95 %)', () => {
  it('speichert knapp unter 95 %', async () => {
    await saveVideoProgress(2, 569, 600); // 94,8 %
    expect(await loadVideoProgress(2)).toBe(569);
  });

  it('speichert ab 95 % nichts mehr — die Folge gilt als gesehen', async () => {
    await saveVideoProgress(2, 570, 600); // exakt 95 %
    expect(await loadVideoProgress(2)).toBe(0);
  });

  // Seit 2026-08-25: der Eintrag bleibt und traegt `completedAt`. Vorher wurde
  // er geloescht - eine fertig geschaute Folge hinterliess keine Spur, und die
  // Frage "wieviel habe ich schon geschaut" war gar nicht beantwortbar.
  it('setzt die Position zurueck, sobald der Nutzer bis zum Ende schaut', async () => {
    await saveVideoProgress(2, 300, 600);
    await saveVideoProgress(2, 600, 600);
    expect(await loadVideoProgress(2)).toBe(0);
  });

  it('merkt sich den Abschluss, damit der Kursfortschritt ihn zaehlen kann', async () => {
    await saveVideoProgress(2, 600, 600);
    const map = await loadAllVideoProgress();
    expect(map['2']?.completedAt).toEqual(expect.any(Number));
  });

  it('behaelt den Abschluss, wenn die Folge spaeter nur kurz neu angetippt wird', async () => {
    await saveVideoProgress(2, 600, 600);
    await saveVideoProgress(2, 1, 600); // unter der Anfangsschwelle
    const map = await loadAllVideoProgress();
    expect(map['2']?.completedAt).toEqual(expect.any(Number));
    expect(map['2']?.position).toBe(0);
  });
});

describe('Robustheit gegen kaputte Player-Werte', () => {
  it('ignoriert NaN/Infinity als Position', async () => {
    await saveVideoProgress(3, Number.NaN, 600);
    await saveVideoProgress(3, Number.POSITIVE_INFINITY, 600);
    expect(await loadVideoProgress(3)).toBe(0);
  });

  it('speichert bei noch unbekannter Dauer (0) trotzdem die Position', async () => {
    // duration === 0 heißt "Metadaten noch nicht geladen", nicht "fertig".
    await saveVideoProgress(3, 42, 0);
    expect(await loadVideoProgress(3)).toBe(42);
  });

  it('liefert bei kaputtem Speicherinhalt eine leere Tabelle statt zu werfen', async () => {
    await AsyncStorage.setItem('salatibox:video-progress', 'kein json');
    expect(await loadAllVideoProgress()).toEqual({});
    expect(await loadVideoProgress(1)).toBe(0);
  });

  // Audit 2026-07-27 (O5): JSON.parse-Ergebnis wurde ungeprueft auf
  // ProgressMap gecastet. Gueltiges JSON, das KEIN Objekt ist, kam damit
  // unveraendert durch — `saveVideoProgress` warf danach beim Schreiben
  // ("Cannot set properties of null"). Gegen den Stand vor dem Fix sind alle
  // drei Faelle unten rot.
  it.each([
    ['null', 'null'],
    ['eine Liste', '[]'],
    ['eine Zahl', '7'],
    ['eine Zeichenkette', '"kaputt"'],
  ])('faellt bei %s im Speicher auf eine leere Tabelle zurueck', async (_name, stored) => {
    await AsyncStorage.setItem('salatibox:video-progress', stored);
    expect(await loadAllVideoProgress()).toEqual({});
    expect(await loadVideoProgress(1)).toBe(0);
    // Der eigentliche Absturz: Schreiben auf den kaputten Bestand.
    await expect(saveVideoProgress(1, 30, 600)).resolves.toBeUndefined();
    expect(await loadVideoProgress(1)).toBe(30);
  });
});

describe('Mehrere Folgen', () => {
  it('hält die Folgen unabhängig voneinander', async () => {
    await saveVideoProgress(1, 30, 600);
    await saveVideoProgress(2, 60, 600);
    await saveVideoProgress(1, 90, 600);
    expect(await loadVideoProgress(1)).toBe(90);
    expect(await loadVideoProgress(2)).toBe(60);
  });

  it('setzt beim Fertigschauen nur die betroffene Folge zurueck', async () => {
    await saveVideoProgress(1, 30, 600);
    await saveVideoProgress(2, 60, 600);
    await saveVideoProgress(2, 600, 600);
    expect(await loadVideoProgress(1)).toBe(30);
    expect(await loadVideoProgress(2)).toBe(0);
    expect((await loadAllVideoProgress())['1']?.completedAt).toBeUndefined();
  });
});

import { LEERER_QURAN_LOG, eintragen, parseQuranLog, tagesSchluessel } from './quranLog';

describe('tagesSchluessel', () => {
  it('nimmt den LOKALEN Kalendertag, nicht UTC', () => {
    // Die Testlaeufe stehen auf Europe/Berlin (jest.config.js). Am 15.08. um
    // 23:30 Ortszeit ist es in UTC schon der 15.08. — aber am 01.01. um 00:30
    // Ortszeit waere es in UTC noch der Vortag. Genau das darf nicht passieren,
    // sonst zaehlte eine Lesesitzung kurz nach Mitternacht auf den falschen Tag.
    expect(tagesSchluessel(new Date(2027, 0, 1, 0, 30))).toBe('2027-01-01');
    expect(tagesSchluessel(new Date(2026, 7, 15, 23, 59))).toBe('2026-08-15');
  });

  it('fuellt Monat und Tag zweistellig auf', () => {
    expect(tagesSchluessel(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseQuranLog', () => {
  it('liefert den Leerstand fuer alles Unbrauchbare', () => {
    expect(parseQuranLog(null)).toEqual(LEERER_QURAN_LOG);
    expect(parseQuranLog('kein json')).toEqual(LEERER_QURAN_LOG);
    expect(parseQuranLog('42')).toEqual(LEERER_QURAN_LOG);
  });

  it('verwirft kaputte Tage und Suren ausserhalb 1 bis 114', () => {
    const log = parseQuranLog(
      JSON.stringify({ tage: ['2026-08-01', 'gestern', 42], suren: [1, 0, 115, 114, 2.5] }),
    );
    expect(log.tage).toEqual(['2026-08-01']);
    expect(log.suren).toEqual([1, 114]);
  });

  it('entfernt Doppel und sortiert', () => {
    const log = parseQuranLog(
      JSON.stringify({ tage: ['2026-08-02', '2026-08-01', '2026-08-01'], suren: [9, 2, 9] }),
    );
    expect(log.tage).toEqual(['2026-08-01', '2026-08-02']);
    expect(log.suren).toEqual([2, 9]);
  });
});

describe('eintragen', () => {
  it('ergaenzt Tag und Sure', () => {
    const log = eintragen(LEERER_QURAN_LOG, 18, '2026-08-16');
    expect(log.tage).toEqual(['2026-08-16']);
    expect(log.suren).toEqual([18]);
  });

  it('gibt bei nichts Neuem DASSELBE Objekt zurueck', () => {
    // Daran erkennt merkeGelesen(), dass nicht geschrieben werden muss —
    // sonst gaebe es bei jedem Verlassen eines Sure-Bildschirms einen
    // Schreibvorgang.
    const eins = eintragen(LEERER_QURAN_LOG, 18, '2026-08-16');
    expect(eintragen(eins, 18, '2026-08-16')).toBe(eins);
  });

  it('zaehlt einen zweiten Tag mit derselben Sure als neuen Lesetag', () => {
    const eins = eintragen(LEERER_QURAN_LOG, 18, '2026-08-16');
    const zwei = eintragen(eins, 18, '2026-08-17');
    expect(zwei.tage).toEqual(['2026-08-16', '2026-08-17']);
    expect(zwei.suren).toEqual([18]);
  });

  it('haelt die Suren sortiert', () => {
    let log = eintragen(LEERER_QURAN_LOG, 114, '2026-08-16');
    log = eintragen(log, 2, '2026-08-16');
    expect(log.suren).toEqual([2, 114]);
  });

  it('ignoriert unmoegliche Surennummern, traegt den Tag aber ein', () => {
    const log = eintragen(LEERER_QURAN_LOG, 0, '2026-08-16');
    expect(log.suren).toEqual([]);
    expect(log.tage).toEqual(['2026-08-16']);
  });
});

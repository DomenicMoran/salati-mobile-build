import { SUPPORTED_LOCALES } from '@/lib/locale-detect';
import de from '@/locales/de.json';

import {
  HERAUSFORDERUNGEN,
  KATEGORIEN,
  KLEINSTES_ZIEL,
  VORLAGEN,
  herausforderungMitId,
  herausforderungenDerKategorie,
  kategorieTextSchluessel,
  vorlageTextSchluessel,
} from './katalog';

function auswerten(quelle: unknown, pfad: string): string | undefined {
  return pfad.split('.').reduce<unknown>((knoten, teil) => {
    if (knoten && typeof knoten === 'object') return (knoten as Record<string, unknown>)[teil];
    return undefined;
  }, quelle) as string | undefined;
}

describe('Katalog der Herausforderungen', () => {
  it('vergibt jede Vorlagen-ID nur einmal', () => {
    const ids = VORLAGEN.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('vergibt jede Herausforderungs-ID nur einmal', () => {
    const ids = HERAUSFORDERUNGEN.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('erzeugt vier Stufen je Vorlage', () => {
    expect(HERAUSFORDERUNGEN.length).toBe(VORLAGEN.length * 4);
    for (const v of VORLAGEN) {
      expect(HERAUSFORDERUNGEN.filter((h) => h.vorlageId === v.id)).toHaveLength(4);
    }
  });

  it('haelt die Stufen streng aufsteigend', () => {
    for (const v of VORLAGEN) {
      for (let i = 1; i < v.stufen.length; i++) {
        expect(v.stufen[i]).toBeGreaterThan(v.stufen[i - 1]!);
      }
    }
  });

  it('setzt kein Ziel unter dem kleinsten erlaubten Wert', () => {
    // Die Vorlagen-Saetze setzen den Platzhalter vor ein Hauptwort in der
    // Mehrzahl. Bei 1 stand da "1 Suren gelesen", bei 2 kaeme im Arabischen
    // der Dual dazwischen — Begruendung an KLEINSTES_ZIEL.
    for (const h of HERAUSFORDERUNGEN) {
      expect(h.ziel).toBeGreaterThanOrEqual(KLEINSTES_ZIEL);
    }
  });

  it('belegt jede Kategorie mit mindestens drei Vorlagen', () => {
    for (const k of KATEGORIEN) {
      expect(VORLAGEN.filter((v) => v.kategorie === k).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('findet jede Herausforderung ueber ihre ID wieder', () => {
    for (const h of HERAUSFORDERUNGEN) expect(herausforderungMitId(h.id)).toBe(h);
    expect(herausforderungMitId('gibt-es-nicht')).toBeUndefined();
  });

  it('liefert je Kategorie genau deren Herausforderungen', () => {
    const summe = KATEGORIEN.reduce((n, k) => n + herausforderungenDerKategorie(k).length, 0);
    expect(summe).toBe(HERAUSFORDERUNGEN.length);
  });
});

// Ohne diesen Test faellt eine vergessene Sprache still auf Deutsch zurueck —
// genau der Befund des Audits 2026-07-27 bei den Benachrichtigungen.
describe('Texte in allen Sprachen', () => {
  for (const locale of SUPPORTED_LOCALES) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamischer Pfad
    const dict = require(`@/locales/${locale}.json`);

    it(`${locale}: jede Vorlage hat einen Satz mit Platzhalter`, () => {
      const fehlend = VORLAGEN.filter((v) => {
        const text = auswerten(dict, vorlageTextSchluessel(v.id));
        return typeof text !== 'string' || text.trim() === '' || !text.includes('{n}');
      }).map((v) => v.id);
      expect(fehlend).toEqual([]);
    });

    it(`${locale}: jede Kategorie hat einen Namen`, () => {
      const fehlend = KATEGORIEN.filter((k) => {
        const text = auswerten(dict, kategorieTextSchluessel(k));
        return typeof text !== 'string' || text.trim() === '';
      });
      expect(fehlend).toEqual([]);
    });

    if (locale !== 'de') {
      it(`${locale}: die Kategorienamen stehen nicht auf Deutsch`, () => {
        const gleich = KATEGORIEN.filter(
          (k) => auswerten(dict, kategorieTextSchluessel(k)) === auswerten(de, kategorieTextSchluessel(k)),
        );
        // "Dhikr" und "Quran"/"Koran" sind Eigennamen und duerfen gleich sein.
        expect(gleich.filter((k) => k !== 'dhikr' && k !== 'quran')).toEqual([]);
      });
    }
  }

  it('die deutschen Saetze sind eindeutig (kein Copy-Paste-Duplikat)', () => {
    const saetze = VORLAGEN.map((v) => auswerten(de, vorlageTextSchluessel(v.id)));
    expect(new Set(saetze).size).toBe(saetze.length);
  });
});

import paradigmenNachtrag from '@/features/lexikon/data/paradigmen-nachtrag.json';
import paradigmenWeitere from '@/features/lexikon/data/paradigmen-weitere.json';

import {
  FORM_I_PARADIGM_ID,
  SARF_GROSSFAMILIEN_IDS,
  erklaerungBegriffId,
  istGueltigeVerbform,
  paradigmenTabelleId,
} from './sarfFamilie';

const ALLE_TABELLEN_IDS = new Set([
  ...(paradigmenWeitere as { tables: { id: string }[] }).tables.map((t) => t.id),
  ...(paradigmenNachtrag as { tables: { id: string }[] }).tables.map((t) => t.id),
]);

describe('sarfFamilie — verbForm → Paradigmen-ID', () => {
  it('mappt Form I auf kleine-familie-nasara', () => {
    expect(paradigmenTabelleId(1)).toBe(FORM_I_PARADIGM_ID);
    expect(ALLE_TABELLEN_IDS.has(FORM_I_PARADIGM_ID)).toBe(true);
  });

  it.each([
    [2, 'sarf-familie-1-allama'],
    [3, 'sarf-familie-2-jaadala'],
    [4, 'sarf-familie-3-akhbara'],
    [5, 'sarf-familie-4-taallama'],
    [6, 'sarf-familie-5-tasaaala'],
    [7, 'sarf-familie-6-inkasara'],
    [8, 'sarf-familie-7-iqtaraba'],
    [10, 'sarf-familie-8-istaghfara'],
  ])('mappt Form %i auf %s', (form, erwarteteId) => {
    expect(paradigmenTabelleId(form)).toBe(erwarteteId);
    expect(ALLE_TABELLEN_IDS.has(erwarteteId)).toBe(true);
  });

  it('liefert für Form IX bewusst null (keine Großfamilien-Tabelle im Bestand)', () => {
    expect(paradigmenTabelleId(9)).toBeNull();
  });

  it('liefert für unbekannte Formen null', () => {
    expect(paradigmenTabelleId(0)).toBeNull();
    expect(paradigmenTabelleId(11)).toBeNull();
  });

  it('deckt alle acht Sarf-Großfamilien-IDs ab', () => {
    for (const id of SARF_GROSSFAMILIEN_IDS) {
      expect(ALLE_TABELLEN_IDS.has(id)).toBe(true);
    }
  });

  it('ordnet erklaerungBegriffId Form 1–10 den Lexikon-Schlüsseln form1…form10 zu', () => {
    for (let form = 1; form <= 10; form += 1) {
      expect(erklaerungBegriffId(form)).toBe(`form${form}`);
    }
    expect(erklaerungBegriffId(0)).toBeNull();
  });

  it('kennt nur die gültigen Verbformen 1–10', () => {
    expect(istGueltigeVerbform(1)).toBe(true);
    expect(istGueltigeVerbform(10)).toBe(true);
    expect(istGueltigeVerbform(9)).toBe(true);
    expect(istGueltigeVerbform(0)).toBe(false);
    expect(istGueltigeVerbform(11)).toBe(false);
  });
});

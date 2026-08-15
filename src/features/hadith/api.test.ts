/**
 * Seit dem Lizenz-Audit vom 30.07.2026 gibt es nur noch EINE Sammlung, und die
 * kommt aus dem eigenen Repo: An-Nawawi 40. Die zehn Sammlungen von
 * fawazahmed0 und die drei von AhmedBaset wurden entfernt, weil sich bei ihren
 * UEBERSETZUNGEN die Rechtekette nicht bis zum Ursprung belegen liess (die
 * arabischen Grundtexte sind unstrittig gemeinfrei, die Uebersetzungen nicht).
 * Alles Weitere laeuft ueber HadeethEnc, dessen Bedingungen der Anbieter
 * ausdruecklich nennt — siehe docs/LIZENZ-AUDIT-2026-07-30.md.
 *
 * Diese Datei prueft daher zweierlei: dass die entfernten Quellen wirklich
 * nicht mehr angefragt werden, und dass der verbliebene lokale Bestand
 * vollstaendig ist.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  COLLECTIONS,
  fetchHadithCollection,
  hadithLangsForCollection,
  isHadithTranslationFallback,
  istBekannteSammlung,
  resolveHadithLang,
} from './api';
import { localNawawiCollection } from './nawawi-local';
import { SUPPORTED_LOCALES } from '@/lib/locale-detect';

describe('Die entfernten Fremdquellen sind wirklich weg', () => {
  const quelle = readFileSync(path.join(__dirname, 'api.ts'), 'utf8');

  it('ruft weder fawazahmed0 noch AhmedBaset auf', () => {
    // Im Kopfkommentar stehen die Namen als Begruendung — geprueft wird, dass
    // keine URL mehr darauf zeigt.
    expect(quelle).not.toMatch(/cdn\.jsdelivr\.net/);
    expect(quelle).not.toMatch(/https?:\/\/[^\s'"]*hadith-(api|json)/);
  });

  it('bietet nur noch die lokale Sammlung an', () => {
    expect(COLLECTIONS.map((c) => c.id)).toEqual(['nawawi']);
    expect(istBekannteSammlung('nawawi')).toBe(true);
    expect(istBekannteSammlung('bukhari')).toBe(false);
  });

  it('liefert fuer eine entfernte Sammlung einen Fehler statt eines Netzabrufs', async () => {
    await expect(fetchHadithCollection('bukhari', 'de')).rejects.toThrow(/unbekannte_sammlung/);
  });

  it('braucht fuer die verbliebene Sammlung nirgends einen Englisch-Ersatz', () => {
    for (const lang of SUPPORTED_LOCALES) {
      expect(resolveHadithLang('nawawi', lang)).toBe(lang);
      expect(isHadithTranslationFallback('nawawi', lang)).toBe(false);
    }
    expect(hadithLangsForCollection('nawawi').sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });
});

describe('localNawawiCollection', () => {
  it('liefert 42 Hadithe mit arabischem Original und deutscher Übersetzung', () => {
    const de = localNawawiCollection('de');
    expect(de.hadiths).toHaveLength(42);
    expect(de.hadiths[0].hadithnumber).toBe(1);
    expect(de.hadiths[0].arabic).toContain('الأَعْمَالُ');
    expect(de.hadiths[0].translation).toMatch(/Absicht/);
    expect(de.hadiths[0].grades[0].name).toContain('an-Nawaw');
  });

  it('nummeriert lückenlos 1-42 ohne Dubletten und mit Belegkette', () => {
    // An-Nawawi 40 kommt als einzige Sammlung aus Repo-Daten — eine
    // übersprungene oder doppelte Nummer würde hier niemand von außen
    // korrigieren (Audit 2026-07-27).
    const hadiths = localNawawiCollection('de').hadiths;
    const numbers = hadiths.map((h) => h.hadithnumber);
    expect(numbers).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    for (const hadith of hadiths) {
      expect(hadith.arabic.trim()).not.toBe('');
      expect(hadith.grades[0]?.name.trim()).toBeTruthy();
      expect(hadith.reference.hadith).toBe(hadith.hadithnumber);
    }
  });

  it('zeigt bei ar den arabischen Text als Übersetzung', () => {
    const ar = localNawawiCollection('ar');
    expect(ar.hadiths[0].translation).toBe(ar.hadiths[0].arabic);
  });

  it('hat in allen 14 App-Sprachen eine eigene Übersetzung', () => {
    const arabicOnly = localNawawiCollection('ar').hadiths.map((h) => h.arabic);
    for (const lang of SUPPORTED_LOCALES) {
      if (lang === 'ar') continue;
      const hadiths = localNawawiCollection(lang).hadiths;
      expect(hadiths).toHaveLength(42);
      for (let i = 0; i < hadiths.length; i++) {
        expect(hadiths[i].translation.trim()).not.toBe('');
        expect(hadiths[i].translation).not.toBe(arabicOnly[i]);
      }
    }
  });
});

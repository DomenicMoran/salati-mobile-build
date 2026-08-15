/**
 * Al Quran Cloud gibt die Übersetzungen unter einer Auflage weiter:
 * „If you republish a translation, please attribute the translator by name."
 * (alquran.cloud/terms-and-conditions, geprüft 2026-07-30). Unabhängig davon
 * ist die Namensnennung das Urheberpersönlichkeitsrecht des Übersetzers
 * (§ 13 UrhG).
 *
 * Bis 1.41.0 war die Auflage nicht erfüllt: die Lizenzseite nannte allein die
 * Ausgabe Bubenheim, während der Reader jede der über hundert Ausgaben aus der
 * Schnittstelle anzeigen kann. Eine statische Liste kann das nicht heilen —
 * deshalb steht der Name jetzt unter der Vers-Liste, dort wo der Text gelesen
 * wird.
 *
 * Geprüft wird der Quelltext, weil die Alternative ein vollständiges Rendern
 * des Reader-Screens samt Netz-, Audio- und Speicher-Attrappen wäre. Der Test
 * hält die Zusicherung fest, nicht die Optik.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const READER = path.join(__dirname, '..', '..', 'app', '(tabs)', 'quran', '[surah].tsx');
const quelle = readFileSync(READER, 'utf8');

describe('Der Koran-Reader nennt die Übersetzer', () => {
  it('zeigt eine Fußzeile unter der Vers-Liste', () => {
    expect(quelle).toContain('ListFooterComponent');
    expect(quelle).toContain('uebersetzerZeilen');
  });

  it('nimmt den Anzeigenamen aus den Editionsdaten, nicht aus einer festen Liste', () => {
    // editionDisplayName faengt die Ausgaben ab, bei denen die Schnittstelle
    // "Unknown" als englishName liefert.
    expect(quelle).toMatch(/editionDisplayName\(erste\)/);
    expect(quelle).toMatch(/editionDisplayName\(zweite\)/);
  });

  it('nennt auch die zweite Übersetzung, wenn sie eingeblendet ist', () => {
    expect(quelle).toMatch(/showSecondTranslation \? finde\(settings\.quranTranslation2\)/);
  });

  it('haengt die Namen an die tatsaechlich eingestellten Ausgaben', () => {
    expect(quelle).toMatch(/finde\(settings\.quranTranslation\)/);
  });
});

describe('Die Lizenzseite nennt die Anbieter der Texte', () => {
  const lizenzen = readFileSync(path.join(__dirname, '..', '..', 'app', 'lizenzen.tsx'), 'utf8');

  it('nennt alquran.cloud und Quran.com als Bezugsquellen', () => {
    expect(lizenzen).toContain('alquran.cloud');
    expect(lizenzen).toContain('Quran.com');
  });

  it('weist die Rechte der Rezitatoren aus', () => {
    // Der Anbieter stellt ausdruecklich klar: "copyrights lie with the
    // reciters and they may ask you to remove the content".
    expect(lizenzen).toContain('@reciterRights');
  });

  it('legt die Freigabeerklaerung des deutschen Tafsirs bei', () => {
    expect(lizenzen).toContain('ib-rassoul-tafsir');
  });
});

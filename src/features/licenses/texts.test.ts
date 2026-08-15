import {
  LICENSE_TEXT_IDS,
  LICENSE_TEXT_TITLES,
  LICENSE_TEXT_WORKS,
  licenseText,
  licenseTextUrl,
} from './index';
import TEXTS from './texts.json';

/**
 * Die Lizenz-Volltexte liegen doppelt: als .txt in public/licenses (kommt beim
 * Web-Export nach dist/licenses/ und ist auf der Webseite abrufbar) und als
 * texts.json (kommt ins App-Bundle, damit die Texte offline dabei sind).
 *
 * Die byteweise Gleichheit beider Seiten prueft
 * `node scripts/build-license-texts.mjs --check` (laeuft in `pnpm build` vor
 * dem Web-Export; ein Dateisystem-Zugriff ist hier nicht moeglich, weil das
 * Projekt bewusst ohne @types/node arbeitet). Dieser Test sichert die andere
 * Haelfte ab: dass ueberhaupt alle Texte da sind, keiner leer oder abgeschnitten
 * ist und die Klauseln, die die Pflicht ausloesen, woertlich drinstehen.
 */
const dateiFuer = (id: string) => (id === 'notice' ? 'NOTICE.txt' : `${id}.txt`);

describe('Lizenz-Volltexte', () => {
  it('texts.json enthaelt genau die bekannten Lizenz-IDs', () => {
    expect(Object.keys(TEXTS).sort()).toEqual([...LICENSE_TEXT_IDS].sort());
  });

  it.each(LICENSE_TEXT_IDS)('%s hat Titel, Werkliste und Web-Adresse', (id) => {
    expect(LICENSE_TEXT_TITLES[id]).toBeTruthy();
    expect(LICENSE_TEXT_WORKS[id]).toBeTruthy();
    expect(licenseTextUrl(id)).toBe(`https://www.salati.pro/licenses/${dateiFuer(id)}`);
  });

  it.each(LICENSE_TEXT_IDS)('%s ist vorhanden und nicht abgeschnitten', (id) => {
    const text = licenseText(id);
    expect(typeof text).toBe('string');
    // Kuerzeste beigelegte Lizenz (0BSD) hat ~700 Zeichen; alles darunter waere
    // ein Kopierfehler.
    expect(text.length).toBeGreaterThan(600);
    expect(text.endsWith('\n')).toBe(true);
    // Windows-Zeilenenden wuerden im <ThemedText> als Kaestchen erscheinen.
    expect(text).not.toContain('\r');
  });

  it('gibt die Klauseln unveraendert wieder, die die Pflicht ausloesen', () => {
    expect(licenseText('apache-2.0')).toContain(
      'You must give any other recipients of the Work or\n          Derivative Works a copy of this License',
    );
    expect(licenseText('apache-2.0')).toContain(
      'You must cause any modified files to carry prominent notices',
    );
    expect(licenseText('mit')).toContain(
      'The above copyright notice and this permission notice shall be included in all\ncopies',
    );
    expect(licenseText('bsd-2-clause')).toContain(
      'Redistributions in binary form must reproduce the above copyright notice',
    );
    expect(licenseText('bsd-3-clause')).toContain(
      'Neither the name of the copyright holder nor the names of its contributors',
    );
    expect(licenseText('isc')).toContain(
      'copyright notice and this permission notice appear in all copies',
    );
    expect(licenseText('odbl-1.0')).toContain('ODC Open Database License (ODbL)');
    expect(licenseText('kfgqpc-hafs-font-eula')).toContain(
      'to any person obtaining a copy of this Font accompanying this license',
    );
  });

  it('nennt im NOTICE die Rechteinhaber der Werke, die wir selbst weitergeben', () => {
    const notice = licenseText('notice');
    expect(notice).toContain('Copyright 2024 Alibaba Cloud');
    expect(notice).toContain('tarteel-ai/whisper-base-ar-quran');
    expect(notice).toContain('King Fahd Glorious Quran Printing Complex');
    expect(notice).toContain('Copyright (c) Meta Platforms, Inc. and affiliates.');
    expect(notice).toContain('Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)');
    expect(notice).toContain('Copyright (c) 2015-present Ionic (http://ionic.io/)');
    expect(notice).toContain('Copyright (c) 2023-2024 The ggml authors');
    // Apache-2.0 §4(b): Aenderungshinweis fuer beide selbst konvertierten Modelle.
    expect(notice).toContain('Changes (Apache-2.0 section 4(b))');
  });
});

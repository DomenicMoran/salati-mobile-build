import { router } from 'expo-router';

import { eindeutigeQuellen, quellenZiel } from './quellen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const push = router.push as unknown as jest.Mock;

function oeffne(doc: Parameters<typeof quellenZiel>[0]) {
  const ziel = quellenZiel(doc);
  if (ziel.art !== 'route') throw new Error('Route erwartet');
  ziel.oeffne();
  return push.mock.calls[push.mock.calls.length - 1]![0];
}

describe('quellenZiel', () => {
  beforeEach(() => push.mockClear());

  it('öffnet einen Koran-Vers im Reader', () => {
    expect(oeffne({ id: 'q:2:255', src: 'Koran 2:255', t: '…' })).toEqual({
      pathname: '/quran/[surah]',
      params: { surah: '2', ayah: '255' },
    });
  });

  it('öffnet einen Nawawi-Hadith ohne führende Null', () => {
    expect(oeffne({ id: 'h-nawawi-03', src: 'an-Nawawī Nr. 3', t: '…' })).toEqual({
      pathname: '/hadith/[collection]/[number]',
      params: { collection: 'nawawi', number: '3' },
    });
  });

  it('öffnet Praxis-Guide, Kurslektion und Dua-Kategorie über das Routen-Feld', () => {
    expect(oeffne({ id: 'g-wudu', src: 'Salati-Praxis: Wudu', t: '…', u: '/guides/wudu' })).toEqual({
      pathname: '/guides/[guide]',
      params: { guide: 'wudu' },
    });
    expect(oeffne({ id: 'k-aqida-aqida-01-0', src: 'Salati-Kurs Aqida', t: '…', u: '/study/aqida/aqida-01' })).toEqual({
      pathname: '/study/[course]/[lesson]',
      params: { course: 'aqida', lesson: 'aqida-01' },
    });
    expect(oeffne({ id: 'd:waking-up', src: 'Dua: …', t: '…', u: '/duas/morning' })).toEqual({
      pathname: '/duas/[category]',
      params: { category: 'morning' },
    });
  });

  it('zeigt Wissenseinträge als Text an — sie haben keinen eigenen Screen', () => {
    expect(quellenZiel({ id: 'w-tauhid', src: 'Salati-Wissen: Tauhid', t: '…' })).toEqual({ art: 'text' });
  });

  it('fällt auf Text zurück, wenn die Route unbekannt ist', () => {
    expect(quellenZiel({ id: 'x-neu', src: 'Neu', t: '…', u: '/etwas/anderes' })).toEqual({ art: 'text' });
  });
});

describe('eindeutigeQuellen', () => {
  it('zeigt jede Quellenangabe nur einmal, beste Passage zuerst', () => {
    const docs = [
      { id: 'g-wudu', src: 'Salati-Praxis: Wudu', t: 'a' },
      { id: 'g-wudu-1', src: 'Salati-Praxis: Wudu', t: 'b' },
      { id: 'q:5:6', src: 'Koran 5:6', t: 'c' },
    ];
    expect(eindeutigeQuellen(docs).map((d) => d.id)).toEqual(['g-wudu', 'q:5:6']);
  });
});

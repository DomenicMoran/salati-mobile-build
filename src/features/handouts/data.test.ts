import { formatSizeKb, groupHandoutsByCategory, gviewUrl, type Handout } from './data';

function h(id: string, category: string, category_title = ''): Handout {
  return { id, title: id, category, category_title, pdf_url: `https://example/${id}.pdf` };
}

describe('groupHandoutsByCategory', () => {
  it('gruppiert nach Kategorie in Erst-Auftritts-Reihenfolge', () => {
    const groups = groupHandoutsByCategory([
      h('a', 'tajwid', 'Tadschwid'),
      h('b', 'grammar', 'Grammatik'),
      h('c', 'tajwid', 'Tadschwid'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['tajwid', 'grammar']);
    expect(groups[0].handouts.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('fällt ohne category_title auf die Kategorie-Kennung zurück', () => {
    expect(groupHandoutsByCategory([h('a', 'grammar')])[0].title).toBe('grammar');
  });

  it('sammelt Einträge ohne Kategorie in einer Default-Gruppe', () => {
    const groups = groupHandoutsByCategory([h('a', ''), h('b', '   ')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('__default__');
  });

  it('verliert keinen Eintrag', () => {
    const handouts = [h('a', 'x'), h('b', ''), h('c', 'y'), h('d', 'x')];
    expect(groupHandoutsByCategory(handouts).flatMap((g) => g.handouts)).toHaveLength(4);
  });

  it('liefert für eine leere Liste keine Gruppen', () => {
    expect(groupHandoutsByCategory([])).toEqual([]);
  });
});

describe('formatSizeKb', () => {
  it('zeigt Kilobyte unter 1024 gerundet', () => {
    expect(formatSizeKb(820)).toBe('820 KB');
    expect(formatSizeKb(1023.6)).toBe('1024 KB');
  });

  it('schaltet ab 1024 KB auf Megabyte mit deutschem Dezimalkomma um', () => {
    expect(formatSizeKb(1024)).toBe('1,0 MB');
    expect(formatSizeKb(1434)).toBe('1,4 MB');
  });

  it('liefert null, wenn keine Größe bekannt ist (Zeile entfällt)', () => {
    expect(formatSizeKb(undefined)).toBeNull();
    expect(formatSizeKb(0)).toBeNull();
    expect(formatSizeKb(-5)).toBeNull();
  });
});

describe('gviewUrl', () => {
  it('kodiert die PDF-URL vollständig als Query-Parameter', () => {
    expect(gviewUrl('https://example.com/a b.pdf?x=1&y=2')).toBe(
      'https://docs.google.com/gview?embedded=1&url=https%3A%2F%2Fexample.com%2Fa%20b.pdf%3Fx%3D1%26y%3D2',
    );
  });

  it('lässt die eingebettete URL nicht aus dem Query-Parameter ausbrechen', () => {
    // Ein unkodiertes "&" würde einen zusätzlichen gview-Parameter erzeugen.
    const url = gviewUrl('https://example.com/x.pdf&embedded=0');
    expect(url.split('&')).toHaveLength(2);
  });
});

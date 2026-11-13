import { parsePdfBridgeInbound, serializePdfBridgeOutbound } from './bridge';

describe('parsePdfBridgeInbound', () => {
  it('lehnt ungueltiges JSON ab', () => {
    expect(parsePdfBridgeInbound('{')).toBeNull();
    expect(parsePdfBridgeInbound(null)).toBeNull();
  });

  it('parst ready', () => {
    expect(
      parsePdfBridgeInbound(JSON.stringify({ type: 'ready', page: 3, pageCount: 829, ttfpMs: 420 })),
    ).toEqual({ type: 'ready', page: 3, pageCount: 829, ttfpMs: 420, shell: false });
  });

  it('parst pagechange', () => {
    expect(parsePdfBridgeInbound(JSON.stringify({ type: 'pagechange', page: 10, pageCount: 100 }))).toEqual({
      type: 'pagechange',
      page: 10,
      pageCount: 100,
    });
  });

  it('parst outline', () => {
    expect(
      parsePdfBridgeInbound(
        JSON.stringify({
          type: 'outline',
          items: [{ title: 'Kapitel 1', depth: 0 }, { title: 'Unter', depth: 1 }],
        }),
      ),
    ).toEqual({
      type: 'outline',
      items: [
        { title: 'Kapitel 1', depth: 0 },
        { title: 'Unter', depth: 1 },
      ],
    });
  });

  it('parst searchHit', () => {
    expect(
      parsePdfBridgeInbound(
        JSON.stringify({
          type: 'searchHit',
          query: 'salah',
          total: 1,
          matches: [{ page: 5, excerpt: '…salah…' }],
        }),
      ),
    ).toEqual({
      type: 'searchHit',
      query: 'salah',
      total: 1,
      matches: [{ page: 5, excerpt: '…salah…' }],
    });
  });

  it('parst textSelected', () => {
    expect(parsePdfBridgeInbound(JSON.stringify({ type: 'textSelected', page: 2, text: 'Hallo' }))).toEqual({
      type: 'textSelected',
      page: 2,
      text: 'Hallo',
    });
  });

  it('parst error', () => {
    expect(parsePdfBridgeInbound(JSON.stringify({ type: 'error', code: 'load', message: 'x' }))).toEqual({
      type: 'error',
      code: 'load',
      message: 'x',
    });
  });

  it('serialisiert load', () => {
    expect(
      JSON.parse(
        serializePdfBridgeOutbound({ type: 'load', pdfUrl: 'https://example.test/a.pdf', page: 2, theme: 'night' }),
      ),
    ).toMatchObject({ type: 'load', pdfUrl: 'https://example.test/a.pdf', page: 2, theme: 'night' });
  });

  it('serialisiert goto (goToPage)', () => {
    expect(JSON.parse(serializePdfBridgeOutbound({ type: 'goToPage', page: 42 }))).toEqual({
      type: 'goToPage',
      page: 42,
    });
  });
});

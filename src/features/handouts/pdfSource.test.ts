import { pdfWebViewStrategy, pdfWebViewStrategyForUrl, resolvePdfWebViewUri } from './pdfSource';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('pdfSource / BL-P1-004', () => {
  const sample = 'https://example.com/x.pdf';

  it('prefers direct on Android for remote PDF URLs', () => {
    expect(pdfWebViewStrategyForUrl(sample)).toBe('direct');
    expect(resolvePdfWebViewUri(sample, null, 'direct')).toBe(sample);
  });

  it('falls back to gview when requested', () => {
    expect(pdfWebViewStrategy()).toBe('gview');
    expect(resolvePdfWebViewUri(sample, null, 'gview')).toContain('docs.google.com/gview');
  });
});

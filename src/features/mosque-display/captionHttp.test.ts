import { buildCaptionHtml, httpHtmlResponse, parseHttpRequestPath } from './captionHttp';

describe('captionHttp', () => {
  it('parses GET path', () => {
    expect(parseHttpRequestPath('GET /khutba HTTP/1.1\r\nHost: x')).toBe('/khutba');
  });

  it('builds HTML with escaped caption', () => {
    const html = buildCaptionHtml({ title: 'Khutba', caption: '<b>x</b>', disclaimer: 'Test' });
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('Khutba');
  });

  it('wraps HTML in HTTP response', () => {
    const res = httpHtmlResponse('<p>ok</p>');
    expect(res).toMatch(/^HTTP\/1\.0 200/);
    expect(res).toContain('<p>ok</p>');
  });
});

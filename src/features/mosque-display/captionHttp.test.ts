import {
  buildCaptionHtml,
  buildSseEvent,
  CAPTION_SSE_PATH,
  httpHtmlResponse,
  httpSsePreamble,
  parseHttpRequestPath,
} from './captionHttp';

describe('captionHttp', () => {
  it('parses GET path', () => {
    expect(parseHttpRequestPath('GET /khutba HTTP/1.1\r\nHost: x')).toBe('/khutba');
  });

  it('builds HTML with escaped caption and SSE client', () => {
    const html = buildCaptionHtml({ title: 'Khutba', caption: '<b>x</b>', disclaimer: 'Test' });
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('Khutba');
    expect(html).toContain(CAPTION_SSE_PATH);
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).toContain('EventSource');
  });

  it('wraps HTML in HTTP response', () => {
    const res = httpHtmlResponse('<p>ok</p>');
    expect(res).toMatch(/^HTTP\/1\.0 200/);
    expect(res).toContain('<p>ok</p>');
  });

  it('builds SSE frames', () => {
    expect(httpSsePreamble()).toContain('text/event-stream');
    const ev = buildSseEvent('caption', '{"caption":"a"}', '1');
    expect(ev).toContain('event: caption');
    expect(ev).toContain('data: {"caption":"a"}');
  });
});

import { decodeBase64, encodeBase64 } from './base64';

describe('encodeBase64 / decodeBase64', () => {
  it('round-trips plain ASCII', () => {
    const input = 'Hello, Salati!';
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it('round-trips JSON with special characters', () => {
    const input = JSON.stringify({ a: 1, b: [true, null, 'x/y+z'] });
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it('round-trips Arabic and other multi-byte Unicode text', () => {
    const input = 'بِسْمِ ٱللَّهِ — Café — 日本語';
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it('round-trips an empty string', () => {
    expect(decodeBase64(encodeBase64(''))).toBe('');
  });

  it('matches known base64 output for a simple case', () => {
    expect(encodeBase64('Man')).toBe('TWFu');
  });

  it('ignores whitespace/newlines inserted by manual copy-paste', () => {
    const code = encodeBase64('test string');
    const withNewlines = code.slice(0, 4) + '\n' + code.slice(4);
    expect(decodeBase64(withNewlines)).toBe('test string');
  });
});

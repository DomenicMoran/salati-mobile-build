import {
  containsArabicScript,
  pickDictionaryToken,
  resolveDictionaryLookupTarget,
  systemDictionarySearchUrl,
} from './dictionaryLookup';

describe('dictionaryLookup', () => {
  it('routes Arabic to lexicon', () => {
    expect(containsArabicScript('الله')).toBe(true);
    const target = resolveDictionaryLookupTarget('قال الله');
    expect(target).toEqual({ kind: 'lexicon', query: 'قال' });
  });

  it('routes Latin to system', () => {
    const target = resolveDictionaryLookupTarget('"Wahrlich," sagte er');
    expect(target?.kind).toBe('system');
    expect(pickDictionaryToken('  hello,  ')).toBe('hello');
  });

  it('builds DE search url', () => {
    expect(systemDictionarySearchUrl('Gebet', 'de')).toContain('duden.de');
  });
});

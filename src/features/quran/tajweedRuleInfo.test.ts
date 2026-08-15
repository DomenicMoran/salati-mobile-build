import { wordTajweedRuleFamilies } from './tajweedRuleInfo';

describe('wordTajweedRuleFamilies', () => {
  it('maps known rule names to their explanation family', () => {
    expect(wordTajweedRuleFamilies(['laam_shamsiyah'])).toEqual(['sunLetter']);
    expect(wordTajweedRuleFamilies(['qalaqah'])).toEqual(['qalqalah']);
  });

  it('collapses the different madd variants into one "madd" family', () => {
    expect(wordTajweedRuleFamilies(['madda_obligatory_monfasel'])).toEqual(['madd']);
    expect(wordTajweedRuleFamilies(['madda_obligatory_mottasel'])).toEqual(['madd']);
    expect(wordTajweedRuleFamilies(['madda_necessary'])).toEqual(['madd']);
  });

  it('deduplicates families when several rule names map to the same family', () => {
    expect(wordTajweedRuleFamilies(['idgham_ghunnah', 'idgham_shafawi'])).toEqual(['idghamGhunnah']);
  });

  it('preserves first-occurrence order across distinct families', () => {
    expect(wordTajweedRuleFamilies(['slnt', 'ghunnah'])).toEqual(['silentLetter', 'ghunnah']);
  });

  it('silently skips unknown rule names instead of inventing an explanation', () => {
    expect(wordTajweedRuleFamilies(['some_future_rule_name'])).toEqual([]);
  });

  it('returns an empty array for undefined/empty input', () => {
    expect(wordTajweedRuleFamilies(undefined)).toEqual([]);
    expect(wordTajweedRuleFamilies([])).toEqual([]);
  });
});

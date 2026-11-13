import { filterLicensedForProduction, isMediaLicenseProductionVisible } from './license-meta';

describe('isMediaLicenseProductionVisible', () => {
  it('hides pending license status', () => {
    expect(isMediaLicenseProductionVisible({ licenseStatus: 'pending' })).toBe(false);
    expect(isMediaLicenseProductionVisible({ licenseStatus: 'cleared', license: 'salati-original' })).toBe(true);
    expect(isMediaLicenseProductionVisible(undefined)).toBe(true);
  });
});

describe('filterLicensedForProduction', () => {
  it('drops handouts marked pending', () => {
    const out = filterLicensedForProduction([
      { id: 'a', licenseStatus: 'cleared' },
      { id: 'b', licenseStatus: 'pending' },
    ]);
    expect(out.map((x) => x.id)).toEqual(['a']);
  });
});

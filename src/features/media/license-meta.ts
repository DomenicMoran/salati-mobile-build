/** Maschinenlesbare Rechts-Metadaten fuer Medien-Indizes (Audit VP-A-002..004). */

export type LicenseStatus = 'cleared' | 'pending';

export interface MediaLicenseMeta {
  /** Kurz-ID, z. B. `salati-original`, `ib-rassoul-release`, `CC-BY-4.0`. */
  license?: string;
  licenseStatus?: LicenseStatus;
  rightsHolder?: string;
  sourceUrl?: string | null;
}

/** Produktion/UI: `pending` ausblenden; fehlendes Feld = Legacy-Index (sichtbar). */
export function isMediaLicenseProductionVisible(meta?: MediaLicenseMeta | null): boolean {
  if (!meta?.licenseStatus) return true;
  return meta.licenseStatus === 'cleared';
}

export interface LicensedItem extends MediaLicenseMeta {
  id?: string;
  track?: string;
}

export function filterLicensedForProduction<T extends LicensedItem>(items: readonly T[]): T[] {
  return items.filter((item) => isMediaLicenseProductionVisible(item));
}

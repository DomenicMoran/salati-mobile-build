/**
 * Phase C gates for shipped-books.manifest.json (shared by Jest + node script).
 */

export const MANIFEST_CATEGORIES = new Set([
  'Aqida',
  'Ibadah',
  'Arabisch',
  "Qur'an",
  'Seerah',
  'Hadith',
  'Akhlaq',
  'Familie',
  'Lernpfad',
]);

const LICENSE_STATUS = new Set(['cleared', 'pending']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/i;

export type ShippedBooksManifest = {
  schema?: number;
  stand?: string;
  items?: ManifestItem[];
  audiobookPdfTracks?: ManifestTrack[];
  tafsir?: ManifestTafsir[];
};

export type ManifestItem = {
  id?: string;
  title?: string;
  license?: string;
  lizenz?: string;
  licenseStatus?: string;
  rightsHolder?: string;
  category?: string;
  sourceUrl?: string;
  beleg_url?: string;
  reviewer?: string;
  reviewedAt?: string;
  islamicNota?: string;
  pdf_url?: string;
  pdf_local?: string;
  buildManifest?: string;
  visible?: boolean;
  releaseStatus?: string;
  pages?: number;
  sha256?: string;
  notes?: string;
  lang?: string;
};

type ManifestTrack = { track?: string; licenseStatus?: string; [key: string]: unknown };
type ManifestTafsir = { id?: string; [key: string]: unknown };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function effectiveLicense(item: ManifestItem): string | null {
  const license = item.license?.trim();
  const lizenz = item.lizenz?.trim();
  if (license && lizenz && license !== lizenz) return null;
  return license ?? lizenz ?? null;
}

/** Lizenznachweis: explizites `beleg_url` oder dokumentierter Repo-/HTTP-Pfad in `sourceUrl`. */
export function effectiveBelegUrl(item: ManifestItem): string | null {
  if (isNonEmptyString(item.beleg_url)) return item.beleg_url.trim();
  const src = item.sourceUrl?.trim() ?? '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.includes('/licenses/') || src.startsWith('apps/mobile/public/licenses/')) return src;
  if (src.startsWith('public/licenses/')) return src;
  return null;
}

function isVisibleShipped(item: ManifestItem): boolean {
  if (item.visible === false) return false;
  if (item.licenseStatus === 'pending') return false;
  if (item.releaseStatus === 'draft') return false;
  return true;
}

function requireFields(obj: Record<string, unknown>, fields: string[], label: string, errors: string[]) {
  for (const f of fields) {
    if (!isNonEmptyString(obj[f])) {
      errors.push(`${label}: missing or empty "${f}"`);
    }
  }
}

function validateItem(item: ManifestItem, errors: string[]) {
  const label = `items[${item.id ?? '?'}]`;
  requireFields(
    item as Record<string, unknown>,
    [
      'id',
      'title',
      'rightsHolder',
      'category',
      'sourceUrl',
      'reviewer',
      'reviewedAt',
      'islamicNota',
    ],
    label,
    errors,
  );

  const lic = effectiveLicense(item);
  if (!lic) {
    errors.push(`${label}: requires license or lizenz (must match if both set)`);
  }

  if (item.licenseStatus && !LICENSE_STATUS.has(item.licenseStatus)) {
    errors.push(`${label}: invalid licenseStatus "${item.licenseStatus}"`);
  }

  if (item.category && !MANIFEST_CATEGORIES.has(item.category)) {
    errors.push(`${label}: invalid category "${item.category}"`);
  }

  if (item.reviewedAt && !ISO_DATE.test(item.reviewedAt)) {
    errors.push(`${label}: reviewedAt must be YYYY-MM-DD`);
  }

  const hasDist = isNonEmptyString(item.pdf_url) || isNonEmptyString(item.pdf_local);
  if (!hasDist && item.id !== 'salati-islam-lernwerk') {
    errors.push(`${label}: requires pdf_url or pdf_local`);
  }
  if (item.id === 'salati-islam-lernwerk') {
    if (!isNonEmptyString(item.pdf_local) && !isNonEmptyString(item.pdf_url)) {
      errors.push(`${label}: All-in-One requires pdf_local or pdf_url`);
    }
    if (!isNonEmptyString(item.buildManifest)) {
      errors.push(`${label}: All-in-One requires buildManifest`);
    }
  }

  if (item.licenseStatus === 'pending' && item.visible === true) {
    errors.push(`${label}: visible:true forbidden when licenseStatus is pending`);
  }
  if (item.licenseStatus === 'pending' && item.visible === undefined) {
    errors.push(`${label}: pending items must set visible:false explicitly`);
  }
  if (item.releaseStatus === 'draft' && item.visible === true) {
    errors.push(`${label}: visible:true forbidden when releaseStatus is draft`);
  }

  if (isVisibleShipped(item)) {
    if (!lic) {
      errors.push(`${label}: visible shipped item requires license/lizenz`);
    }
    if (!effectiveBelegUrl(item)) {
      errors.push(`${label}: visible shipped item requires beleg_url (or license sourceUrl)`);
    }
    if (item.license?.startsWith('LicenseRef-') || item.lizenz?.startsWith('LicenseRef-')) {
      const sha = item.sha256?.trim();
      if (!sha || !SHA256.test(sha)) {
        const rawNotes = (item as { notes?: string }).notes;
        const notes = typeof rawNotes === 'string' ? rawNotes : '';
        if (!/sha256\s+[a-f0-9]{64}/i.test(notes)) {
          errors.push(`${label}: third-party visible/staging PD item requires sha256 field or notes hash`);
        }
      }
    }
  }
}

function validateAudiobookTrack(track: ManifestTrack, errors: string[]) {
  const label = `audiobookPdfTracks[${track.track ?? '?'}]`;
  requireFields(
    track as Record<string, unknown>,
    [
      'track',
      'license',
      'licenseStatus',
      'rightsHolder',
      'category',
      'sourceUrl',
      'reviewer',
      'reviewedAt',
      'islamicNota',
    ],
    label,
    errors,
  );
  if (track.licenseStatus === 'pending') {
    errors.push(`${label}: tracks must be cleared in manifest`);
  }
}

function validateTafsir(entry: ManifestTafsir, errors: string[]) {
  const label = `tafsir[${entry.id ?? '?'}]`;
  requireFields(
    entry as Record<string, unknown>,
    [
      'id',
      'license',
      'licenseStatus',
      'rightsHolder',
      'category',
      'sourceUrl',
      'reviewer',
      'reviewedAt',
      'islamicNota',
    ],
    label,
    errors,
  );
}

export function validateShippedBooksManifest(data: ShippedBooksManifest): string[] {
  const errors: string[] = [];

  if (data.schema !== 1) errors.push('root: schema must be 1');
  if (!isNonEmptyString(data.stand)) errors.push('root: missing stand');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('root: items must be a non-empty array');
  }

  const ids = new Set<string>();
  for (const item of data.items ?? []) {
    if (item.id && ids.has(item.id)) errors.push(`duplicate item id "${item.id}"`);
    if (item.id) ids.add(item.id);
    validateItem(item, errors);
  }

  for (const track of data.audiobookPdfTracks ?? []) {
    validateAudiobookTrack(track, errors);
  }
  for (const t of data.tafsir ?? []) {
    validateTafsir(t, errors);
  }

  return errors;
}

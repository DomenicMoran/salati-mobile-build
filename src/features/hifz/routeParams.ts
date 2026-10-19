/** Missing/malformed deep links open the first surah, never NaN state.
 * NaN !== NaN made the gap-test render synchronizer loop indefinitely. */
export function parseSurahNumber(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 114 ? n : 1;
}

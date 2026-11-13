import AsyncStorage from '@react-native-async-storage/async-storage';

const MOSQUE_PREFIX = 'salatibox:mosques:';
const HALAL_PREFIX = 'salatibox:halal:';

export type MosquePackStats = {
  mosqueEntries: number;
  halalEntries: number;
  approxBytes: number;
};

export async function readMosquePackStats(): Promise<MosquePackStats> {
  const keys = await AsyncStorage.getAllKeys();
  let mosqueEntries = 0;
  let halalEntries = 0;
  let approxBytes = 0;
  const relevant = keys.filter((k) => k.startsWith(MOSQUE_PREFIX) || k.startsWith(HALAL_PREFIX));
  if (relevant.length === 0) {
    return { mosqueEntries: 0, halalEntries: 0, approxBytes: 0 };
  }
  const pairs = await AsyncStorage.multiGet(relevant);
  for (const [key, value] of pairs) {
    if (!value) continue;
    approxBytes += value.length;
    if (key.startsWith(MOSQUE_PREFIX)) mosqueEntries += 1;
    if (key.startsWith(HALAL_PREFIX)) halalEntries += 1;
  }
  return { mosqueEntries, halalEntries, approxBytes };
}

/** OSM/ODbL — Hinweistext für UI (keine neue Datenquelle). */
export const MOSQUE_PACK_LICENSE_NOTE = {
  de: 'Gecachte Moscheen/Halal-Suchen stammen aus OpenStreetMap (ODbL). Namensnennung: © OpenStreetMap-Mitwirkende.',
  en: 'Cached mosque/halal searches come from OpenStreetMap (ODbL). Attribution: © OpenStreetMap contributors.',
};

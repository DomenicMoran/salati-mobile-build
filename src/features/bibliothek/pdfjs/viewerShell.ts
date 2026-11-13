import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const NATIVE_FILE_NAMES = ['index.html', 'viewer.mjs', 'pdf.min.mjs', 'pdf.worker.min.mjs'] as const;

const nativeModules: Record<(typeof NATIVE_FILE_NAMES)[number], number> = {
  'index.html': require('../../../../assets/pdf-reader/index.html'),
  'viewer.mjs': require('../../../../assets/pdf-reader/viewer.mjs'),
  'pdf.min.mjs': require('../../../../assets/pdf-reader/pdf.min.mjs'),
  'pdf.worker.min.mjs': require('../../../../assets/pdf-reader/pdf.worker.min.mjs'),
};

let nativeBaseUriPromise: Promise<string> | null = null;

async function ensureNativePdfReaderBundle(): Promise<string> {
  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) throw new Error('pdf_reader_no_cache');
  const cacheDir = `${root}salati-pdf-reader/`;
  const marker = `${cacheDir}.ready-v1`;
  const markerInfo = await FileSystem.getInfoAsync(marker);
  if (markerInfo.exists) return cacheDir;

  await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  for (const name of NATIVE_FILE_NAMES) {
    const asset = Asset.fromModule(nativeModules[name]);
    await asset.downloadAsync();
    const from = asset.localUri;
    if (!from) throw new Error(`pdf_reader_asset_missing:${name}`);
    const to = `${cacheDir}${name}`;
    const exists = await FileSystem.getInfoAsync(to);
    if (exists.exists) await FileSystem.deleteAsync(to, { idempotent: true });
    await FileSystem.copyAsync({ from, to });
  }
  await FileSystem.writeAsStringAsync(marker, new Date().toISOString());
  return cacheDir;
}

/** Basis-URL für den gebündelten pdf.js-HTML-Shell (ohne CDN). */
export async function resolvePdfReaderShellUri(): Promise<string> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/pdf-reader/index.html`;
    }
    return '/pdf-reader/index.html';
  }
  if (!nativeBaseUriPromise) {
    nativeBaseUriPromise = ensureNativePdfReaderBundle().then((dir) => `${dir}index.html`);
  }
  return nativeBaseUriPromise;
}

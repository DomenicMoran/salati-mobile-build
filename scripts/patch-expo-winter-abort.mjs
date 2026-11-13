/**
 * Hermes: globales AbortSignal oft noch nicht da, wenn expo/src/winter laeuft.
 * Gradle export:embed nutzt teils ohne Metro-Shims — Patch direkt am aufgeloesten expo-Paket.
 */
import fs from 'node:fs';

const abortSignalRel = 'src/winter/AbortSignal.ts';
const runtimeRel = 'src/winter/runtime.native.ts';
const urlRel = 'src/winter/url.ts';
const installGlobalRel = 'src/winter/installGlobal.ts';

const abortSignalNeedle = `export function installAbortSignalPatch(
  abortSignal: AbortSignalConstructor
): AbortSignalConstructor {
  if (abortSignal.timeout == null) {`;

const abortSignalReplacement = `export function installAbortSignalPatch(
  abortSignal: AbortSignalConstructor | undefined
): AbortSignalConstructor | undefined {
  if (abortSignal == null) {
    return abortSignal;
  }
  if (abortSignal.timeout == null) {`;

const runtimeNeedle = `installFormDataPatch(FormData);
installAbortSignalPatch(AbortSignal);`;

const runtimeReplacement = `installFormDataPatch(FormData);
if (typeof AbortSignal !== 'undefined' && AbortSignal != null) {
  installAbortSignalPatch(AbortSignal);
}`;

const urlImportNeedle = `import { URL, URLSearchParams } from 'whatwg-url-minimum';`;
const urlImportReplacement = `import * as WhatwgUrl from 'whatwg-url-minimum';

const URL = WhatwgUrl.URL;
const URLSearchParams = WhatwgUrl.URLSearchParams;`;

const installGlobalNeedle = `      const value = getValue();
      Object.defineProperty(value, BUILTIN_SYMBOL, {`;
const installGlobalReplacement = `      const value = getValue();
      if (value == null) {
        return value as T;
      }
      Object.defineProperty(value, BUILTIN_SYMBOL, {`;

const urlNeedle = `URL.createObjectURL = function createObjectURL(
  blob: Blob & { data?: { blobId: string; offset: number } }
) {
  if (getBlobUrlPrefix() == null) {
    throw new Error('Cannot create URL for blob');
  }
  return \`\${getBlobUrlPrefix()}\${encodeURIComponent(blob.data!.blobId)}?offset=\${encodeURIComponent(
    blob.data!.offset
  )}&size=\${encodeURIComponent(blob.size)}\`;
};

URL.revokeObjectURL = function revokeObjectURL(_url) {
  // Do nothing.
};`;

const urlReplacement = `if (typeof URL !== 'undefined' && URL != null) {
  URL.createObjectURL = function createObjectURL(
    blob: Blob & { data?: { blobId: string; offset: number } }
  ) {
    if (getBlobUrlPrefix() == null) {
      throw new Error('Cannot create URL for blob');
    }
    return \`\${getBlobUrlPrefix()}\${encodeURIComponent(blob.data!.blobId)}?offset=\${encodeURIComponent(
      blob.data!.offset
    )}&size=\${encodeURIComponent(blob.size)}\`;
  };

  URL.revokeObjectURL = function revokeObjectURL(_url) {
    // Do nothing.
  };
}`;

function patchFile(root) {
  const abortPath = `${root}/${abortSignalRel}`;
  const runtimePath = `${root}/${runtimeRel}`;
  if (!fs.existsSync(abortPath) || !fs.existsSync(runtimePath)) return false;

  let abortSrc = fs.readFileSync(abortPath, 'utf8');
  if (!abortSrc.includes('if (abortSignal == null)')) {
    if (!abortSrc.includes(abortSignalNeedle)) {
      console.warn(`[patch-expo-winter-abort] unexpected AbortSignal.ts at ${abortPath}`);
      return false;
    }
    abortSrc = abortSrc.replace(abortSignalNeedle, abortSignalReplacement);
    fs.writeFileSync(abortPath, abortSrc);
  }

  const installGlobalPath = `${root}/${installGlobalRel}`;
  if (fs.existsSync(installGlobalPath)) {
    let installSrc = fs.readFileSync(installGlobalPath, 'utf8');
    if (!installSrc.includes('if (value == null)')) {
      if (installSrc.includes(installGlobalNeedle)) {
        installSrc = installSrc.replace(installGlobalNeedle, installGlobalReplacement);
        fs.writeFileSync(installGlobalPath, installSrc);
      }
    }
  }

  const urlPath = `${root}/${urlRel}`;
  if (fs.existsSync(urlPath)) {
    let urlSrc = fs.readFileSync(urlPath, 'utf8');
    if (!urlSrc.includes('WhatwgUrl')) {
      if (urlSrc.includes(urlImportNeedle)) {
        urlSrc = urlSrc.replace(urlImportNeedle, urlImportReplacement);
      }
    }
    if (!urlSrc.includes('typeof URL !==')) {
      if (!urlSrc.includes(urlNeedle)) {
        console.warn(`[patch-expo-winter-abort] unexpected url.ts at ${urlPath}`);
      } else {
        urlSrc = urlSrc.replace(urlNeedle, urlReplacement);
        fs.writeFileSync(urlPath, urlSrc);
      }
    }
  }

  let runtimeSrc = fs.readFileSync(runtimePath, 'utf8');
  if (!runtimeSrc.includes('typeof AbortSignal !==')) {
    if (!runtimeSrc.includes(runtimeNeedle)) {
      console.warn(`[patch-expo-winter-abort] unexpected runtime.native.ts at ${runtimePath}`);
      return false;
    }
    runtimeSrc = runtimeSrc.replace(runtimeNeedle, runtimeReplacement);
    fs.writeFileSync(runtimePath, runtimeSrc);
  }

  console.log(`[patch-expo-winter-abort] patched ${root}`);
  return true;
}

let root;
try {
  root = `${import.meta.dirname}/../node_modules/expo`.replace(/\\/g, '/');
  const resolved = fs.realpathSync(root);
  patchFile(resolved.replace(/\\/g, '/'));
} catch (e) {
  console.warn('[patch-expo-winter-abort] skip:', e instanceof Error ? e.message : e);
}

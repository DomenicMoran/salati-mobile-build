const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// pdf-reader-native `.mjs` als Asset; whatwg-url-minimum explizit als Source (siehe resolveRequest).
config.resolver.assetExts = [...config.resolver.assetExts, 'mjs', 'html'];

const ensureAbortSignalGlobals = path.resolve(__dirname, 'src/lib/ensureAbortSignalGlobals.ts');
const expoWinterAbortSignalShim = path.resolve(
  __dirname,
  'src/lib/expoWinterAbortSignal.ts',
);
const edgeToEdgeWebShim = path.resolve(__dirname, 'src/lib/reactNativeIsEdgeToEdge.web.ts');
const edgeToEdgeNativeShim = path.resolve(__dirname, 'src/lib/reactNativeIsEdgeToEdge.native.ts');
const mergeOptionsWebShim = path.resolve(__dirname, 'src/lib/mergeOptions.web.ts');

const defaultBeforeMain = config.serializer.getModulesRunBeforeMainModule;
config.serializer.getModulesRunBeforeMainModule = () => {
  const before = defaultBeforeMain ? defaultBeforeMain() : [];
  const mapped = before.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/');
    return !normalized.endsWith('/src/lib/ensureAbortSignalGlobals.ts');
  });
  return [ensureAbortSignalGlobals, ...mapped];
};

function isPdfReaderMjsAsset(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('pdf-reader/') && normalized.endsWith('.mjs');
}

function resolvePdfReaderMjsAsset(context, moduleName) {
  if (typeof moduleName !== 'string' || !moduleName.includes('pdf-reader') || !moduleName.endsWith('.mjs')) {
    return null;
  }
  const candidate = path.resolve(path.dirname(context.originModulePath), moduleName);
  if (isPdfReaderMjsAsset(candidate)) {
    return { type: 'assetFiles', filePaths: [candidate] };
  }
  return null;
}

function isExpoWinterAbortSignalRequest(originModulePath, moduleName) {
  const origin = originModulePath?.replace(/\\/g, '/') ?? '';
  return (
    moduleName === './AbortSignal' &&
    (/\/expo\/(src|build)\/winter\//.test(origin) || /\/expoWinterAbortSignal/.test(origin))
  );
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'whatwg-url-minimum') {
    const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [__dirname] }));
    const pkg = require.resolve('whatwg-url-minimum/package.json', { paths: [expoRoot, __dirname] });
    const filePath = path.join(path.dirname(pkg), 'dist/whatwg-url-minimum.js');
    return { type: 'sourceFile', filePath };
  }

  if (isExpoWinterAbortSignalRequest(context.originModulePath, moduleName)) {
    return { type: 'sourceFile', filePath: expoWinterAbortSignalShim };
  }

  const pdfReaderAsset = resolvePdfReaderMjsAsset(context, moduleName);
  if (pdfReaderAsset) {
    return pdfReaderAsset;
  }

  if (moduleName === 'react-native-is-edge-to-edge') {
    return {
      type: 'sourceFile',
      filePath: platform === 'web' ? edgeToEdgeWebShim : edgeToEdgeNativeShim,
    };
  }

  if (platform === 'web' && moduleName === 'merge-options') {
    return { type: 'sourceFile', filePath: mergeOptionsWebShim };
  }

  const resolution = defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);

  if (resolution?.type === 'sourceFile' && isPdfReaderMjsAsset(resolution.filePath)) {
    return { type: 'assetFiles', filePaths: [resolution.filePath] };
  }

  const assetPath = resolution?.filePaths?.[0]?.replace(/\\/g, '/') ?? '';
  if (resolution?.type === 'assetFiles' && assetPath.includes('whatwg-url-minimum')) {
    const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [__dirname] }));
    const pkg = require.resolve('whatwg-url-minimum/package.json', { paths: [expoRoot, __dirname] });
    return {
      type: 'sourceFile',
      filePath: path.join(path.dirname(pkg), 'dist/whatwg-url-minimum.js'),
    };
  }

  return resolution;
};

module.exports = config;

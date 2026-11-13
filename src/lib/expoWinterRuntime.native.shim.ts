// Expo winter/runtime.native mit Hermes-sicherem AbortSignal (siehe metro.config.js).
import './ensureAbortSignalGlobals';
import 'react-native/Libraries/Core/InitializeCore';

import { installAbortSignalPatch } from './expoWinterAbortSignal';
import { installFormDataPatch } from 'expo/src/winter/FormData';
import { installGlobal as install } from 'expo/src/winter/installGlobal';

install('TextDecoder', () => require('expo/src/winter/TextDecoder').TextDecoder);
install('TextDecoderStream', () => require('expo/src/winter/TextDecoderStream').TextDecoderStream);
install('TextEncoderStream', () => require('expo/src/winter/TextDecoderStream').TextEncoderStream);
install('URL', () => require('expo/src/winter/url').URL);
install('URLSearchParams', () => require('expo/src/winter/url').URLSearchParams);
install('DOMException', () => require('expo/src/winter/DOMException').DOMException);
install('__ExpoImportMetaRegistry', () => require('expo/src/winter/ImportMetaRegistry').ImportMetaRegistry);
install('structuredClone', () => require('@ungap/structured-clone').default);

installFormDataPatch(FormData);
if (typeof AbortSignal !== 'undefined' && AbortSignal != null) {
  installAbortSignalPatch(AbortSignal);
}

// @ts-expect-error Hermes optional global
Symbol.asyncIterator ??= Symbol.for('Symbol.asyncIterator');

import { Platform } from 'react-native';

const useRnFetch =
  Platform.OS === 'android' ||
  process.env.EXPO_PUBLIC_USE_RN_FETCH === '1' ||
  process.env.EXPO_PUBLIC_USE_RN_FETCH === 'true';

if (!useRnFetch) {
  if (!globalThis.Headers) {
    throw new Error(
      "expo/fetch expected `globalThis.Headers` to be installed by React Native's fetch polyfill.",
    );
  }
  install('fetch', () => require('expo/src/winter/fetch').fetch);
}

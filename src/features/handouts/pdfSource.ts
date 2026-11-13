import { Platform } from 'react-native';

import { gviewUrl } from './data';

/** BL-P1-004: iOS direkt; Android versucht Remote-PDF in der App-Huelle, sonst gview. */
export type PdfWebViewStrategy = 'direct' | 'gview';

function isRemotePdfUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return /\.pdf(\?|$)/i.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return false;
  }
}

export function pdfWebViewStrategyForUrl(pdfUrl: string): PdfWebViewStrategy {
  if (Platform.OS === 'ios') return 'direct';
  if (Platform.OS === 'web') return 'gview';
  if (Platform.OS === 'android' && isRemotePdfUrl(pdfUrl)) return 'direct';
  return 'gview';
}

/** @deprecated Prefer {@link pdfWebViewStrategyForUrl} when the URL is known. */
export function pdfWebViewStrategy(): PdfWebViewStrategy {
  return Platform.OS === 'ios' ? 'direct' : 'gview';
}

/** URI fuer WebView/PDF — Android Remote zuerst direkt, gview per Fallback im Viewer. */
export function resolvePdfWebViewUri(
  pdfUrl: string,
  localFileUri: string | null,
  strategy?: PdfWebViewStrategy,
): string {
  const effective = strategy ?? pdfWebViewStrategyForUrl(pdfUrl);
  if (effective === 'gview') return gviewUrl(pdfUrl);
  return localFileUri ?? pdfUrl;
}

/** BL-P2-004: WebView load error — Android remote tries direct first, then gview. */
export function pdfStrategyAfterWebViewError(
  current: PdfWebViewStrategy,
): PdfWebViewStrategy | null {
  if (current === 'direct') return 'gview';
  return null;
}

/** 1-based PDF page hint for direct viewers (iOS WKWebView / ARV). */
export function pdfUrlWithStartPage(pdfUrl: string, page: number | undefined): string {
  const url = pdfUrl.trim();
  if (!url || page == null || !Number.isInteger(page) || page < 2) return url;
  const base = url.split('#')[0] ?? url;
  return `${base}#page=${page}`;
}

export type KhutbaTranslateLang = 'ar' | 'de' | 'en' | 'tr';

export type TranslateModelInfo = {
  source: KhutbaTranslateLang;
  target: KhutbaTranslateLang;
  bytes?: number;
};

export function khutbaTranslateSupported(): boolean {
  return false;
}

export function estimateModelBytes(): number {
  return 0;
}

export async function ensureTranslateModels(): Promise<void> {}

export async function translateKhutbaLine(text: string): Promise<string> {
  return text.trim();
}
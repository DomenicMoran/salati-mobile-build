export interface TafsirBlock {
  from: number;
  to: number;
  text: string;
}

export interface TafsirSurahPayload {
  blocks?: TafsirBlock[];
}

export interface TafsirTocEntry {
  surah: number;
}

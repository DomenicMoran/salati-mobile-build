// Themen-Vers-Sammlungen ("Self-Discovery"): kuratierte Listen von
// Vers-Referenzen zu Lebensthemen. Die Koran-Verse selbst sind Text ohne
// eigenes Urheberrecht (Reader lädt sie wie überall in der App live über
// api.alquran.cloud); die AUSWAHL und die kurze Einordnung je Thema sind
// selbst formuliert (nicht aus einer anderen App/Quelle übernommen). Jede
// Referenz wurde einzeln gegen api.alquran.cloud geprüft (existiert, passt
// inhaltlich), siehe Commit-Beschreibung.
import type { IconName } from '@/components/ui/icon-symbol';

export interface ThemeVerse {
  surah: number;
  ayah: number;
}

export interface ThemeCollection {
  id: string;
  icon: IconName;
  /** i18n-Key für den Thementitel, z. B. 'themes.collections.patience.title'. */
  titleKey: string;
  /** i18n-Key für die kurze, selbst geschriebene Einordnung (2-3 Sätze). */
  introKey: string;
  verses: ThemeVerse[];
}

// Reihenfolge = Anzeige-Reihenfolge im Themen-Hub.
export const THEME_COLLECTIONS: ThemeCollection[] = [
  {
    id: 'patience',
    icon: 'hourglass-outline',
    titleKey: 'themes.collections.patience.title',
    introKey: 'themes.collections.patience.intro',
    verses: [
      { surah: 2, ayah: 153 },
      { surah: 2, ayah: 155 },
      { surah: 3, ayah: 200 },
      { surah: 39, ayah: 10 },
      { surah: 2, ayah: 45 },
      { surah: 8, ayah: 46 },
      { surah: 16, ayah: 127 },
      { surah: 25, ayah: 75 },
      { surah: 31, ayah: 17 },
      { surah: 103, ayah: 3 },
    ],
  },
  {
    id: 'gratitude',
    icon: 'sunny-outline',
    titleKey: 'themes.collections.gratitude.title',
    introKey: 'themes.collections.gratitude.intro',
    verses: [
      { surah: 14, ayah: 7 },
      { surah: 16, ayah: 18 },
      { surah: 2, ayah: 152 },
      { surah: 31, ayah: 12 },
      { surah: 16, ayah: 78 },
      { surah: 27, ayah: 40 },
      { surah: 34, ayah: 13 },
      { surah: 39, ayah: 66 },
      { surah: 55, ayah: 13 },
      { surah: 93, ayah: 11 },
    ],
  },
  {
    id: 'worry',
    icon: 'heart-outline',
    titleKey: 'themes.collections.worry.title',
    introKey: 'themes.collections.worry.intro',
    verses: [
      { surah: 13, ayah: 28 },
      { surah: 2, ayah: 286 },
      { surah: 3, ayah: 139 },
      { surah: 65, ayah: 3 },
      { surah: 3, ayah: 173 },
      { surah: 9, ayah: 40 },
      { surah: 9, ayah: 51 },
      { surah: 10, ayah: 62 },
      { surah: 20, ayah: 46 },
      { surah: 21, ayah: 87 },
    ],
  },
  {
    id: 'family',
    icon: 'people-outline',
    titleKey: 'themes.collections.family.title',
    introKey: 'themes.collections.family.intro',
    verses: [
      { surah: 17, ayah: 23 },
      { surah: 17, ayah: 24 },
      { surah: 31, ayah: 14 },
      { surah: 30, ayah: 21 },
      { surah: 2, ayah: 83 },
      { surah: 4, ayah: 1 },
      { surah: 25, ayah: 74 },
      { surah: 31, ayah: 15 },
      { surah: 46, ayah: 15 },
      { surah: 66, ayah: 6 },
    ],
  },
  {
    id: 'forgiveness',
    icon: 'leaf-outline',
    titleKey: 'themes.collections.forgiveness.title',
    introKey: 'themes.collections.forgiveness.intro',
    verses: [
      { surah: 39, ayah: 53 },
      { surah: 3, ayah: 135 },
      { surah: 42, ayah: 40 },
      { surah: 24, ayah: 22 },
      { surah: 4, ayah: 110 },
      { surah: 7, ayah: 199 },
      { surah: 11, ayah: 3 },
      { surah: 25, ayah: 70 },
      { surah: 64, ayah: 14 },
      { surah: 71, ayah: 10 },
    ],
  },
  {
    id: 'hope',
    icon: 'compass-outline',
    titleKey: 'themes.collections.hope.title',
    introKey: 'themes.collections.hope.intro',
    verses: [
      { surah: 94, ayah: 5 },
      { surah: 94, ayah: 6 },
      { surah: 12, ayah: 87 },
      { surah: 3, ayah: 159 },
      { surah: 2, ayah: 186 },
      { surah: 15, ayah: 56 },
      { surah: 29, ayah: 69 },
      { surah: 40, ayah: 60 },
      { surah: 93, ayah: 4 },
      { surah: 93, ayah: 5 },
    ],
  },
];

export function themeCollectionById(id: string): ThemeCollection | undefined {
  return THEME_COLLECTIONS.find((c) => c.id === id);
}

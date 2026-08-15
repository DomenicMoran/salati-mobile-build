// Themen-Leseplaene ("Journeys"): kuratierte TAGES-Plaene zu einem Thema -
// im Unterschied zu THEME_COLLECTIONS (collections.ts, freies Stoebern ohne
// Struktur) hat hier jeder Tag eine feste, kleine Vers-Auswahl (1-3 Verse)
// + einen kurzen, selbst formulierten Reflexionstext. Die Koran-Verse selbst
// sind Text ohne eigenes Urheberrecht (Reader laedt sie wie ueberall in der
// App live ueber api.alquran.cloud); AUSWAHL, TAGES-EINTEILUNG und die
// Reflexionstexte sind selbst formuliert (nicht aus einer anderen App
// uebernommen). Jede Referenz wurde einzeln gegen api.alquran.cloud geprueft
// (existiert, Textinhalt passt zur Tages-Aussage), siehe Commit-Beschreibung.
import type { IconName } from '@/components/ui/icon-symbol';
import type { ThemeVerse } from './collections';

export type { ThemeVerse } from './collections';

export interface JourneyDay {
  verses: ThemeVerse[];
  /** i18n-Key für den kurzen Tagestitel, z. B. 'journeys.items.sabrJourney.days.0.title'. */
  titleKey: string;
  /** i18n-Key für den selbst geschriebenen Reflexionstext (2-3 Sätze). */
  textKey: string;
}

export interface Journey {
  id: string;
  icon: IconName;
  /** i18n-Key für den Reisetitel, z. B. 'journeys.items.sabrJourney.title'. */
  titleKey: string;
  /** i18n-Key für die kurze Beschreibung der Reise. */
  subtitleKey: string;
  days: JourneyDay[];
}

function items(id: string, dayCount: number): { titleKey: string; subtitleKey: string; days: JourneyDay[] } {
  const base = `journeys.items.${id}`;
  return {
    titleKey: `${base}.title`,
    subtitleKey: `${base}.subtitle`,
    days: Array.from({ length: dayCount }, (_, i) => ({
      verses: [] as ThemeVerse[],
      titleKey: `${base}.days.${i}.title`,
      textKey: `${base}.days.${i}.text`,
    })),
  };
}

function withVerses(day: JourneyDay, verses: ThemeVerse[]): JourneyDay {
  return { ...day, verses };
}

const selfDiscoveryBase = items('selfDiscovery', 10);
const sabrJourneyBase = items('sabrJourney', 7);
const gratitudeJourneyBase = items('gratitudeJourney', 5);
const newBeginningBase = items('newBeginning', 7);
const ramadanPrepBase = items('ramadanPrep', 10);
const griefLossBase = items('griefLoss', 7);
const examTimeBase = items('examTime', 7);
const rizqWorkBase = items('rizqWork', 7);

// Reihenfolge = Anzeige-Reihenfolge im Tages-Pläne-Hub.
export const JOURNEYS: Journey[] = [
  {
    id: 'selfDiscovery',
    icon: 'person-outline',
    titleKey: selfDiscoveryBase.titleKey,
    subtitleKey: selfDiscoveryBase.subtitleKey,
    days: [
      withVerses(selfDiscoveryBase.days[0], [{ surah: 51, ayah: 56 }]),
      withVerses(selfDiscoveryBase.days[1], [
        { surah: 91, ayah: 7 },
        { surah: 91, ayah: 8 },
      ]),
      withVerses(selfDiscoveryBase.days[2], [
        { surah: 51, ayah: 20 },
        { surah: 51, ayah: 21 },
      ]),
      withVerses(selfDiscoveryBase.days[3], [{ surah: 29, ayah: 2 }]),
      withVerses(selfDiscoveryBase.days[4], [{ surah: 84, ayah: 6 }]),
      withVerses(selfDiscoveryBase.days[5], [
        { surah: 26, ayah: 88 },
        { surah: 26, ayah: 89 },
      ]),
      withVerses(selfDiscoveryBase.days[6], [{ surah: 1, ayah: 6 }]),
      withVerses(selfDiscoveryBase.days[7], [{ surah: 25, ayah: 67 }]),
      withVerses(selfDiscoveryBase.days[8], [
        { surah: 91, ayah: 9 },
        { surah: 91, ayah: 10 },
      ]),
      withVerses(selfDiscoveryBase.days[9], [{ surah: 50, ayah: 16 }]),
    ],
  },
  {
    id: 'sabrJourney',
    icon: 'walk-outline',
    titleKey: sabrJourneyBase.titleKey,
    subtitleKey: sabrJourneyBase.subtitleKey,
    days: [
      withVerses(sabrJourneyBase.days[0], [
        { surah: 103, ayah: 1 },
        { surah: 103, ayah: 2 },
        { surah: 103, ayah: 3 },
      ]),
      withVerses(sabrJourneyBase.days[1], [
        { surah: 41, ayah: 34 },
        { surah: 41, ayah: 35 },
      ]),
      withVerses(sabrJourneyBase.days[2], [
        { surah: 2, ayah: 155 },
        { surah: 2, ayah: 156 },
      ]),
      withVerses(sabrJourneyBase.days[3], [
        { surah: 16, ayah: 126 },
        { surah: 16, ayah: 127 },
      ]),
      withVerses(sabrJourneyBase.days[4], [{ surah: 40, ayah: 55 }]),
      withVerses(sabrJourneyBase.days[5], [{ surah: 42, ayah: 33 }]),
      withVerses(sabrJourneyBase.days[6], [{ surah: 16, ayah: 96 }]),
    ],
  },
  {
    id: 'gratitudeJourney',
    icon: 'gift-outline',
    titleKey: gratitudeJourneyBase.titleKey,
    subtitleKey: gratitudeJourneyBase.subtitleKey,
    days: [
      withVerses(gratitudeJourneyBase.days[0], [{ surah: 14, ayah: 34 }]),
      withVerses(gratitudeJourneyBase.days[1], [{ surah: 27, ayah: 19 }]),
      withVerses(gratitudeJourneyBase.days[2], [{ surah: 34, ayah: 13 }]),
      withVerses(gratitudeJourneyBase.days[3], [{ surah: 55, ayah: 13 }]),
      withVerses(gratitudeJourneyBase.days[4], [{ surah: 14, ayah: 7 }]),
    ],
  },
  {
    id: 'newBeginning',
    icon: 'trending-up-outline',
    titleKey: newBeginningBase.titleKey,
    subtitleKey: newBeginningBase.subtitleKey,
    days: [
      withVerses(newBeginningBase.days[0], [{ surah: 66, ayah: 8 }]),
      withVerses(newBeginningBase.days[1], [{ surah: 39, ayah: 53 }]),
      withVerses(newBeginningBase.days[2], [{ surah: 39, ayah: 54 }]),
      withVerses(newBeginningBase.days[3], [{ surah: 13, ayah: 11 }]),
      withVerses(newBeginningBase.days[4], [{ surah: 25, ayah: 70 }]),
      withVerses(newBeginningBase.days[5], [
        { surah: 20, ayah: 25 },
        { surah: 20, ayah: 26 },
      ]),
      withVerses(newBeginningBase.days[6], [{ surah: 20, ayah: 82 }]),
    ],
  },
  {
    id: 'ramadanPrep',
    icon: 'moon-outline',
    titleKey: ramadanPrepBase.titleKey,
    subtitleKey: ramadanPrepBase.subtitleKey,
    days: [
      withVerses(ramadanPrepBase.days[0], [{ surah: 2, ayah: 183 }]),
      withVerses(ramadanPrepBase.days[1], [{ surah: 2, ayah: 184 }]),
      withVerses(ramadanPrepBase.days[2], [{ surah: 2, ayah: 185 }]),
      withVerses(ramadanPrepBase.days[3], [{ surah: 2, ayah: 186 }]),
      withVerses(ramadanPrepBase.days[4], [
        { surah: 97, ayah: 1 },
        { surah: 97, ayah: 2 },
        { surah: 97, ayah: 3 },
      ]),
      withVerses(ramadanPrepBase.days[5], [{ surah: 2, ayah: 197 }]),
      withVerses(ramadanPrepBase.days[6], [{ surah: 73, ayah: 6 }]),
      withVerses(ramadanPrepBase.days[7], [{ surah: 2, ayah: 261 }]),
      withVerses(ramadanPrepBase.days[8], [{ surah: 54, ayah: 17 }]),
      withVerses(ramadanPrepBase.days[9], [{ surah: 3, ayah: 133 }]),
    ],
  },
  {
    id: 'griefLoss',
    icon: 'flower-outline',
    titleKey: griefLossBase.titleKey,
    subtitleKey: griefLossBase.subtitleKey,
    days: [
      withVerses(griefLossBase.days[0], [
        { surah: 2, ayah: 156 },
        { surah: 2, ayah: 157 },
      ]),
      withVerses(griefLossBase.days[1], [
        { surah: 94, ayah: 5 },
        { surah: 94, ayah: 6 },
      ]),
      withVerses(griefLossBase.days[2], [{ surah: 21, ayah: 35 }]),
      withVerses(griefLossBase.days[3], [
        { surah: 55, ayah: 26 },
        { surah: 55, ayah: 27 },
      ]),
      withVerses(griefLossBase.days[4], [{ surah: 13, ayah: 28 }]),
      withVerses(griefLossBase.days[5], [{ surah: 12, ayah: 86 }]),
      withVerses(griefLossBase.days[6], [
        { surah: 89, ayah: 27 },
        { surah: 89, ayah: 28 },
        { surah: 89, ayah: 29 },
        { surah: 89, ayah: 30 },
      ]),
    ],
  },
  {
    id: 'examTime',
    icon: 'school-outline',
    titleKey: examTimeBase.titleKey,
    subtitleKey: examTimeBase.subtitleKey,
    days: [
      withVerses(examTimeBase.days[0], [{ surah: 20, ayah: 114 }]),
      withVerses(examTimeBase.days[1], [{ surah: 2, ayah: 286 }]),
      withVerses(examTimeBase.days[2], [
        { surah: 94, ayah: 7 },
        { surah: 94, ayah: 8 },
      ]),
      withVerses(examTimeBase.days[3], [{ surah: 39, ayah: 9 }]),
      withVerses(examTimeBase.days[4], [{ surah: 58, ayah: 11 }]),
      withVerses(examTimeBase.days[5], [{ surah: 3, ayah: 159 }]),
      withVerses(examTimeBase.days[6], [{ surah: 65, ayah: 3 }]),
    ],
  },
  {
    id: 'rizqWork',
    icon: 'briefcase-outline',
    titleKey: rizqWorkBase.titleKey,
    subtitleKey: rizqWorkBase.subtitleKey,
    days: [
      withVerses(rizqWorkBase.days[0], [{ surah: 11, ayah: 6 }]),
      withVerses(rizqWorkBase.days[1], [{ surah: 62, ayah: 10 }]),
      withVerses(rizqWorkBase.days[2], [{ surah: 67, ayah: 15 }]),
      withVerses(rizqWorkBase.days[3], [
        { surah: 71, ayah: 10 },
        { surah: 71, ayah: 11 },
        { surah: 71, ayah: 12 },
      ]),
      withVerses(rizqWorkBase.days[4], [{ surah: 2, ayah: 168 }]),
      withVerses(rizqWorkBase.days[5], [{ surah: 28, ayah: 77 }]),
      withVerses(rizqWorkBase.days[6], [{ surah: 34, ayah: 39 }]),
    ],
  },
];

export function journeyById(id: string): Journey | undefined {
  return JOURNEYS.find((j) => j.id === id);
}

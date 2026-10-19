// Gemeinsame Liste der Studium-/Lern-Werkzeuge. Wird sowohl im Lernen-Tab
// (src/app/(tabs)/lernen.tsx) als prominentes Raster als AUCH im „Mehr"-Tab
// (src/app/(tabs)/more.tsx) als Verknuepfung gerendert — EINE Quelle, damit
// beide Orte garantiert dieselben Eintraege in derselben Reihenfolge zeigen.
// „Medien" fuehrt in den Medien-Hub (src/app/media.tsx: Podcast/Videos/Reels).
import { type IconName } from '@/components/ui/icon-symbol';

export interface LernenNavItem {
  href: string;
  labelKey: string;
  icon: IconName;
  group: 'lernen' | 'hoerinhalte' | 'nachschlagen' | 'uebung';
}

// KEINE breitere Typannotation (`: readonly LernenNavItem[]`) — die wuerde `href`
// zu `string` verbreitern; `router.push` braucht die Literal-Pfade. `satisfies`
// validiert die Form, `as const` haelt die Literale.
export const LERNEN_NAV = [
  { href: '/learn', labelKey: 'nav.learn', icon: 'school', group: 'lernen' },
  { href: '/study', labelKey: 'nav.study', icon: 'library', group: 'lernen' },
  { href: '/hifz', labelKey: 'nav.hifz', icon: 'bulb', group: 'lernen' },
  { href: '/handouts', labelKey: 'handouts.title', icon: 'document-text', group: 'lernen' },
  { href: '/gebet-gemeinsam', labelKey: 'gebetGemeinsam.title', icon: 'people-outline', group: 'lernen' },
  { href: '/getting-started', labelKey: 'nav.gettingStarted', icon: 'flag-outline', group: 'lernen' },
  { href: '/audiobooks/pflichtwissen', labelKey: 'audiobooks.tracks.pflichtwissen', icon: 'headset', group: 'hoerinhalte' },
  { href: '/bibliothek', labelKey: 'bibliothek.title', icon: 'book', group: 'hoerinhalte' },
  { href: '/media', labelKey: 'nav.media', icon: 'play-circle', group: 'hoerinhalte' },
  { href: '/radio', labelKey: 'nav.radio', icon: 'radio', group: 'hoerinhalte' },
  { href: '/lexikon', labelKey: 'nav.lexikon', icon: 'bookmarks-outline', group: 'nachschlagen' },
  { href: '/hadith', labelKey: 'nav.hadith', icon: 'book', group: 'nachschlagen' },
  { href: '/wisdom', labelKey: 'nav.wisdom', icon: 'diamond', group: 'nachschlagen' },
  { href: '/names', labelKey: 'nav.names', icon: 'star', group: 'nachschlagen' },
  { href: '/analyse-uebung', labelKey: 'analyseUebung.title', icon: 'create-outline', group: 'uebung' },
  { href: '/quiz', labelKey: 'nav.quiz', icon: 'game-controller', group: 'uebung' },
] as const satisfies readonly LernenNavItem[];

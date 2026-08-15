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
}

// KEINE breitere Typannotation (`: readonly LernenNavItem[]`) — die wuerde `href`
// zu `string` verbreitern; `router.push` braucht die Literal-Pfade. `satisfies`
// validiert die Form, `as const` haelt die Literale.
export const LERNEN_NAV = [
  { href: '/media', labelKey: 'nav.media', icon: 'play-circle' },
  { href: '/learn', labelKey: 'nav.learn', icon: 'school' },
  { href: '/hifz', labelKey: 'nav.hifz', icon: 'bulb' },
  { href: '/study', labelKey: 'nav.study', icon: 'library' },
  { href: '/handouts', labelKey: 'handouts.title', icon: 'document-text' },
  { href: '/quiz', labelKey: 'nav.quiz', icon: 'game-controller' },
  { href: '/hadith', labelKey: 'nav.hadith', icon: 'book' },
  { href: '/wisdom', labelKey: 'nav.wisdom', icon: 'diamond' },
  { href: '/names', labelKey: 'nav.names', icon: 'star' },
  { href: '/radio', labelKey: 'nav.radio', icon: 'radio' },
  { href: '/getting-started', labelKey: 'nav.gettingStarted', icon: 'flag-outline' },
] as const satisfies readonly LernenNavItem[];

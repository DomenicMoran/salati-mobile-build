// Trailing "geht weiter"-Pfeil für tappbare Listenzeilen (Studium/Quiz/
// Hadith/Guides/Themen etc.) — zeigt in RTL-Sprachen nach links statt
// rechts, analog zu GlobalBackButton (global-back-button.tsx), das dieselbe
// isRtlLocale()-basierte Spiegelung für die Zurück-Navigation nutzt. Zentral
// hier statt pro Screen dupliziert, da es keine gemeinsame Listenzeilen-
// Komponente mit eingebautem Disclosure-Indikator gibt (PressableCard ist
// reiner Press-/Schatten-Wrapper, der Chevron ist stets ein Kind-Element).
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

export interface DisclosureChevronProps {
  size?: number;
  color: string;
}

export function DisclosureChevron({ size = 18, color }: DisclosureChevronProps) {
  const { locale } = useTranslation();
  const name: IconName = isRtlLocale(locale) ? 'chevron-back' : 'chevron-forward';
  return <IconSymbol name={name} size={size} color={color} />;
}

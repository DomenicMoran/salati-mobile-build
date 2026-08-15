// Zentrale RTL-Abfrage für Layout-Entscheidungen (Audit 2026-07-27, N6).
//
// Bewusst KEIN `I18nManager.forceRTL()`: das kippt sämtliche Flex-Achsen der
// App auf einmal und wirkt erst nach einem vollständigen Neustart. Die App
// spiegelt heute schon an 45 Stellen von Hand mit `flexDirection:'row-reverse'`
// — ein globales forceRTL würde genau diese Stellen ein zweites Mal drehen und
// sie damit in ar/fa/ur/ps wieder auf LTR zurückkippen. Statt eines riskanten
// Big-Bangs (plus Neustart-Dialog) liegt die Spiegelung deshalb in den
// gemeinsamen Bausteinen (`NavTile`, `DisclosureChevron`, `ScreenHeader`) und
// wird über diesen Hook abgefragt.
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

/** true, wenn die aktive App-Sprache rechtsläufig ist (ar/fa/ur/ps). */
export function useRtl(): boolean {
  const { locale } = useTranslation();
  return isRtlLocale(locale);
}

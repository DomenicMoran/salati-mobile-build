// Globale Zurück-Navigation für Web: Nicht-Tab-Routen (Settings, Studium,
// Impressum, ...) haben keine Stack-Header (headerShown: false) — auf nativ
// übernehmen Swipe-Back/Hardware-Back, im Browser fehlte jede sichtbare
// Zurück-Möglichkeit (User-Feedback "manchmal fehlt der Zurück-Button").
import { router, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

/**
 * Routen im Tab-Navigator (inkl. Unterrouten wie /quran/1) zeigen auf Web
 * bereits die obere Nav-Leiste — dort würde der Chip die Leiste überlappen.
 */
const TAB_PREFIXES = ['/qibla', '/quran', '/more', '/prayer', '/lernen'];

// Modal-Routen bringen ihren eigenen sichtbaren Schließen/„Fertig"-Button im
// ScreenHeader mit (Audit 2026-07-22) — dort würde der schwebende Chip nur eine
// zweite, doppelte Zurück-Affordanz erzeugen. Daher hier ausblenden.
const MODAL_ROUTES = [
  '/settings',
  '/storage',
  '/notifications-overview',
  '/dashboard-reorder',
  '/sync',
  '/impressum',
  '/datenschutz',
  '/agb',
  '/changelog',
  '/lizenzen',
];

export function GlobalBackButton() {
  const pathname = usePathname();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);

  if (Platform.OS !== 'web') return null;
  if (pathname === '/' || TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')))
    return null;
  if (MODAL_ROUTES.includes(pathname)) return null;

  return (
    <Pressable
      onPress={() => {
        // Bei Deep-Link-Einstieg gibt es keine History — dann zur Startseite.
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.back')}
      style={({ pressed }) => [styles.wrap, rtl ? styles.wrapRtl : styles.wrapLtr, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.chip}>
        <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={18} color={colors.accent} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Spacing.three,
    zIndex: 50,
    cursor: 'pointer',
  },
  wrapLtr: { left: Spacing.three },
  wrapRtl: { right: Spacing.three },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(11,11,13,0.15)',
  },
  pressed: { opacity: 0.6 },
});

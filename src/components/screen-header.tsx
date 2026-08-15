// Gemeinsamer Screen-Kopf für alle Stack-/Modal-Routen (Audit 2026-07-22 P1):
// Native Stack-Screens hatten KEINEN sichtbaren Zurück-Button (Root-Stack
// headerShown:false, der sichtbare Chip war Web-only) und Modals keinen
// sichtbaren Schließen/Fertig-Button — beides HIG-Verstöße. Diese Komponente
// zentralisiert Titel + optionalen Untertitel + Zurück-/Schließen-Affordanz +
// konsistente Abstände, RTL-korrekt.
//
// Plattform-Aufteilung, damit keine doppelten Affordanzen entstehen:
//  - Stack: Zurück-Chevron NUR nativ (im Web übernimmt der schwebende
//    GlobalBackButton-Chip weiterhin, die leere Nav-Zeile reserviert nur den
//    Platz dafür).
//  - Modal: Schließen/„Fertig" oben (rechts) auf ALLEN Plattformen — Modals
//    brauchen überall eine sichtbare Dismiss-Aktion.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** 'stack' = Zurück-Chevron (nativ), 'modal' = Schließen/Fertig oben rechts. */
  variant?: 'stack' | 'modal';
  /** Titel-Ausrichtung. iOS-Large-Title-Look = 'left'; Default 'center'
   * (bleibt kompatibel zum bisherigen zentrierten Titel-Muster der App). */
  align?: 'center' | 'left';
  /** Überschreibt die Standard-Zurück-/Schließen-Navigation. */
  onBack?: () => void;
  /** Modal-Dismiss-Stil: 'done' (Text „Fertig") oder 'x' (Icon). Default 'done'. */
  closeLabel?: 'done' | 'x';
  /** Optionale trailing-Aktion (nur Stack-Variante). */
  right?: ReactNode;
  /** Zusätzlicher Inhalt unter dem Untertitel (z. B. eine Streak-Zeile). */
  children?: ReactNode;
}

function defaultBack() {
  // Bei Deep-Link-Einstieg gibt es keine History — dann zur Startseite.
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function ScreenHeader({
  title,
  subtitle,
  variant = 'stack',
  align = 'center',
  onBack,
  closeLabel = 'done',
  right,
  children,
}: ScreenHeaderProps) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);

  const handleDismiss = onBack ?? defaultBack;
  const showNativeBack = variant === 'stack' && Platform.OS !== 'web';

  const leading = showNativeBack ? (
    <Pressable
      onPress={handleDismiss}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.back')}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
      <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={26} color={colors.accent} />
    </Pressable>
  ) : (
    <View style={styles.iconBtn} />
  );

  let trailing: ReactNode;
  if (variant === 'modal') {
    trailing =
      closeLabel === 'x' ? (
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.close')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <IconSymbol name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="accent">
            {t('common.done')}
          </ThemedText>
        </Pressable>
      );
  } else {
    trailing = right ?? <View style={styles.iconBtn} />;
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.navRow, rtl && styles.navRowRtl]}>
        {leading}
        {trailing}
      </View>
      <ThemedText type="title" style={align === 'left' ? styles.titleLeft : styles.titleCenter}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={align === 'left' ? styles.subtitleLeft : styles.subtitleCenter}>
          {subtitle}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // width:100% + alignSelf:stretch: auch in ScrollViews mit alignItems:'center'
  // (z. B. Gebetszeiten) füllt der Kopf die volle Breite, sonst kollabierte die
  // space-between-Nav-Zeile.
  wrap: { width: '100%', alignSelf: 'stretch', paddingHorizontal: Spacing.three },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  navRowRtl: { flexDirection: 'row-reverse' },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: Spacing.one,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  titleCenter: { textAlign: 'center' },
  titleLeft: { textAlign: 'left' },
  subtitleCenter: { textAlign: 'center', marginTop: 2 },
  subtitleLeft: { textAlign: 'left', marginTop: 2 },
  pressed: { opacity: 0.5 },
});

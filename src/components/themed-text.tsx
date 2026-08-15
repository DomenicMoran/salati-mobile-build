import { Platform, StyleSheet, Text, type TextProps, useWindowDimensions } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'heading' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'code';
  themeColor?: ThemeColor;
  /** Lesemodus "Sepia" (settings.readerSepia): erzwingt die helle Tinten-Farbpalette
   * für diesen Text, unabhängig vom Light/Dark-Systemschema — der warme
   * Sepia-Papierhintergrund ist in beiden Themes hell, ein Dark-Mode-Text
   * (nahezu Weiß) wäre darauf unlesbar. Von den Reader-Screens gesetzt, wenn
   * settings.readerSepia aktiv ist. */
  sepia?: boolean;
};

export function ThemedText({ type = 'default', sepia, ...rest }: ThemedTextProps) {
  // Eigene Komponente nur für Titel, damit ausschließlich Titel-Instanzen
  // die Fensterbreite abonnieren (lange deutsche Wörter wie "Wochenrückblick"
  // brechen sonst bei 48px auf schmalen Geräten mitten im Wort um).
  if (type === 'title') return <TitleText sepia={sepia} {...rest} />;
  return <BaseText type={type} sepia={sepia} {...rest} />;
}

function TitleText({ style, themeColor, sepia, ...rest }: Omit<ThemedTextProps, 'type'>) {
  const theme = useTheme(sepia);
  const { width } = useWindowDimensions();
  const size = width < 420 ? styles.titleNarrow : styles.title;

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, size, style]} {...rest} />;
}

function BaseText({ style, type, themeColor, sepia, ...rest }: ThemedTextProps) {
  const theme = useTheme(sepia);

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'heading' && styles.heading,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  // Apple-Typo-Skala (Audit 2026-07-22 „manche Elemente zu groß"): iOS Large
  // Title ist ~34, nicht 48. Auf breiten Screens (≥420) 34, auf schmalen
  // Phones 28 — deutlich kompakter/ruhiger als vorher, ohne die Titel-Wirkung
  // zu verlieren.
  title: {
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 41,
  },
  titleNarrow: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 34,
  },
  // iOS „Title3" (20/25, semibold): die EINE Zwischenüberschrift-Ebene über
  // den grauen Gruppen-Labels einer Einstellungs-/Listenseite. Gemischtschrift
  // statt Versalien — dadurch ist sie auf einen Blick von den kleinen,
  // gesperrten Sektions-Labels unterscheidbar (Audit 2026-07-29: vorher waren
  // beide Ebenen versal und nahezu gleich groß, die Hierarchie kollabierte).
  heading: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 700,
  },
  // iOS Title2 (~22–24) statt vorher 32 — als Zwischen-Überschrift/Stat-Zahl.
  subtitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});

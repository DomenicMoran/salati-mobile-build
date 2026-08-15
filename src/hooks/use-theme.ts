/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';

/**
 * sepia = true erzwingt IMMER die Light-Palette (dunkle Tinten-Farben für Text),
 * unabhängig vom System-/Einstellungs-Farbschema. Der Sepia-Lesemodus
 * (settings.readerSepia) legt einen warmen, hellen Papierhintergrund über BEIDE
 * Themes (sepiaBg/sepiaCard in app/(tabs)/quran/[surah].tsx + mushaf.tsx) —
 * Colors.dark.text (nahezu Weiß) wäre darauf unlesbar, auch wenn Sepia während
 * Dark/Night-Mode aktiviert wird. Colors.light passt exakt (heller Hintergrund
 * → dunkler Text), ohne eine dritte, separat zu pflegende Sepia-Farbpalette
 * einzuführen (Audit-Fund 2026-07-20).
 */
export function useTheme(sepia = false) {
  const scheme = useResolvedScheme();
  return Colors[sepia ? 'light' : scheme];
}

// App-weiter Mini-Player: einzige Instanz an der App-Wurzel (app/_layout.tsx,
// analog zu GlobalBackButton) — bleibt sichtbar, während der Nutzer zwischen
// Screens wechselt (z. B. eine Koran-Sure läuft weiter, während man sich die
// Gebetszeiten ansieht). Speist sich aus dem geteilten Player-Kontext
// (SharedPlayerProvider in features/quran/usePlayer.ts), NICHT aus einem
// lokalen Player, der beim Verlassen des jeweiligen Screens sonst freigegeben
// würde (Audit 2026-07-20 Punkt D).
import { router, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSharedPlayer } from '@/features/quran/usePlayer';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Der Sure-Reader (app/(tabs)/quran/[surah].tsx) nutzt inzwischen ebenfalls
// den geteilten Player (für persistente Wiedergabe über Navigation hinweg),
// hat aber einen EIGENEN, reichhaltigeren Mini-Player (Mitlesen-Toggle,
// Tap-zum-Vers-Scrollen) direkt im Screen. Ohne diese Ausnahme würden beide
// Leisten gleichzeitig am unteren Rand übereinander gerendert, solange man
// im Reader ist — die globale Leiste blendet sich daher exakt auf dieser
// Route aus und übernimmt erst wieder, sobald man den Reader verlässt.
const SURAH_READER_PATHNAME = /^\/quran\/\d+$/;
// Der Podcast-Voll-Player (podcast/[episode].tsx) hat eigene, reichhaltigere
// Steuerung — die globale Pille wuerde sich sonst damit ueberlagern. Die
// Podcast-Liste (/podcast) zeigt die Pille weiterhin.
const PODCAST_PLAYER_PATHNAME = /^\/podcast\/[^/]+$/;

export function MiniPlayer() {
  const { player, status, nowPlaying, setNowPlaying } = useSharedPlayer();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { t } = useTranslation();
  const pathname = usePathname();

  if (
    !nowPlaying ||
    SURAH_READER_PATHNAME.test(pathname) ||
    PODCAST_PLAYER_PATHNAME.test(pathname)
  )
    return null;

  const webCursor = Platform.OS === 'web' ? styles.pressableWeb : undefined;
  const { onPrev, onNext, href } = nowPlaying;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <ThemedView type="backgroundSelected" style={styles.bar}>
        {onPrev ? (
          <Pressable
            onPress={() => onPrev()}
            accessibilityRole="button"
            accessibilityLabel={t('podcast.previous')}
            hitSlop={8}
            style={webCursor}>
            <IconSymbol name="play-skip-back" size={18} color={colors.text} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => (status.playing ? player.pause() : player.play())}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? t('quran.pause') : t('quran.playSurah')}
          hitSlop={8}
          style={webCursor}>
          <IconSymbol name={status.playing ? 'pause' : 'play'} size={22} color={colors.accent} />
        </Pressable>
        {/* Antippen des Titelbereichs führt zurück zum Voll-Player (href). */}
        <Pressable
          onPress={() => href && router.push(href)}
          disabled={!href}
          accessibilityRole="button"
          accessibilityLabel={nowPlaying.title}
          style={[styles.titleWrap, href ? webCursor : undefined]}>
          <ThemedText type="small" numberOfLines={1}>
            {nowPlaying.title}
          </ThemedText>
          {nowPlaying.subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.subtitle}>
              {nowPlaying.subtitle}
            </ThemedText>
          ) : null}
        </Pressable>
        {onNext ? (
          <Pressable
            onPress={() => onNext()}
            accessibilityRole="button"
            accessibilityLabel={t('podcast.next')}
            hitSlop={8}
            style={webCursor}>
            <IconSymbol name="play-skip-forward" size={18} color={colors.text} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            player.pause();
            setNowPlaying(null);
            if (Platform.OS !== 'web') player.setActiveForLockScreen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.close')}
          hitSlop={8}
          style={webCursor}>
          <IconSymbol name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Native: knapp über der Tab-Leiste (BottomTabInset reserviert genau
    // deren Höhe). Web: die Tab-Nav liegt oben (app-tabs.web.tsx), unten ist
    // nichts zu umgehen — ein schmaler Rand reicht.
    bottom: Platform.OS === 'web' ? Spacing.three : BottomTabInset + Spacing.one,
    alignItems: 'center',
    zIndex: 60,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    width: '92%',
    maxWidth: MaxContentWidth,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(11,11,13,0.25)' },
      default: {
        shadowColor: '#0b0b0d',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  titleWrap: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 1 },
  pressableWeb: { cursor: 'pointer' },
});

// Koran-Radio: 24/7-Rezitations-Streams (mp3quran.net). Ein Player,
// ein aktiver Sender — Antippen startet, erneutes Antippen stoppt.
// Nutzt den App-weiten geteilten Player (SharedPlayerProvider in
// usePlayer.ts, gemountet in app/_layout.tsx) statt eines lokalen —
// ein lokaler Player wird von expo-audio beim Verlassen des Screens
// freigegeben, die Wiedergabe stoppte dadurch bislang beim Navigieren weg
// (Audit 2026-07-20 Punkt D: globaler Mini-Player).
import { setAudioModeAsync } from 'expo-audio';
import { useSharedPlayer } from '@/features/quran/usePlayer';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Platform, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchRadios, type RadioStation } from '@/features/quran/radio';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function RadioScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [activeId, setActiveId] = useState<number | null>(null);
  const { player, status, nowPlaying, setNowPlaying } = useSharedPlayer();

  const { data: stations, isLoading, isError } = useQuery({
    queryKey: ['quran', 'radios', locale],
    queryFn: () => fetchRadios(locale),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Läuft inzwischen woanders etwas anderes (z. B. eine Koran-Sure im
  // globalen Mini-Player) oder wurde die Wiedergabe dort geschlossen, darf
  // hier keine Station mehr als "aktiv" markiert bleiben — sonst zeigt die
  // Liste einen Sender als spielend an, der längst nicht mehr läuft.
  // State-Ableitung während des Renders (gleiches Muster wie rangeInitKey/
  // pageIndexSurah in app/(tabs)/quran/[surah].tsx) statt eines Effekts mit
  // setState im Body, den react-hooks/set-state-in-effect zu Recht ablehnt
  // (kaskadierende Re-Renders).
  const [lastSyncedNowPlaying, setLastSyncedNowPlaying] = useState<typeof nowPlaying>(null);
  const [lastSyncedStations, setLastSyncedStations] = useState<typeof stations>(undefined);
  if (nowPlaying !== lastSyncedNowPlaying || stations !== lastSyncedStations) {
    setLastSyncedNowPlaying(nowPlaying);
    setLastSyncedStations(stations);
    const station = nowPlaying ? stations?.find((s) => s.name === nowPlaying.title) : undefined;
    setActiveId(station ? station.id : null);
  }

  // Sender abspielen + globalen Player-Kontext (nowPlaying) inkl. Sender-vor/
  // zurück für den Mini-Player setzen. Bewusst OHNE Zugriff auf activeId-State,
  // damit die im Mini-Player hinterlegten onPrev/onNext-Callbacks auch dann
  // korrekt weiterspringen, wenn dieser Screen längst verlassen (unmounted)
  // ist — der geteilte Player überlebt die Navigation. activeId für die
  // Listen-Hervorhebung wird oben aus nowPlaying abgeleitet.
  function playStation(station: RadioStation, list: RadioStation[]) {
    player.replace(station.url);
    if (Platform.OS !== 'web') {
      // interruptionMode 'doNotMix' + setActiveForLockScreen sind
      // Voraussetzung dafür, dass iOS die Session als aktive
      // Hintergrund-Wiedergabe erkennt (Apple-Review-Reject Guideline
      // 2.5.4, Submission c796b8c5 - Radio lief bislang ohne
      // Lockscreen-Registrierung, dadurch keine hörbare
      // Hintergrund-Wiedergabe). Muss vor player.play() gesetzt sein.
      setAudioModeAsync({
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      }).catch(() => {});
      player.setActiveForLockScreen(
        true,
        { title: station.name, artist: t('radio.title') },
        { isLiveStream: true },
      );
    }
    player.play();
    const i = list.findIndex((s) => s.id === station.id);
    const prev = i > 0 ? list[i - 1] : undefined;
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;
    setNowPlaying({
      title: station.name,
      subtitle: t('radio.title'),
      href: '/radio',
      hasPrev: !!prev,
      hasNext: !!next,
      onPrev: prev ? () => playStation(prev, list) : undefined,
      onNext: next ? () => playStation(next, list) : undefined,
    });
  }

  function toggle(station: RadioStation) {
    if (activeId === station.id) {
      player.pause();
      setActiveId(null);
      setNowPlaying(null);
      if (Platform.OS !== 'web') player.setActiveForLockScreen(false);
      return;
    }
    playStation(station, stations ?? []);
    setActiveId(station.id);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('radio.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('radio.subtitle')}
        </ThemedText>

        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        )}

        <FlatList
          data={stations ?? []}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const active = activeId === item.id;
            return (
              <AnimatedListItem index={index % 12}>
                <PressableCard
                  onPress={() => toggle(item)}
                  type={active ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.row}>
                  <ThemedView
                    type={active ? 'backgroundElement' : 'backgroundSelected'}
                    style={styles.iconBadge}>
                    <IconSymbol
                      name={active && status.playing ? 'pause' : 'play'}
                      size={16}
                      color={colors.accent}
                    />
                  </ThemedView>
                  <ThemedText
                    type={active ? 'smallBold' : 'default'}
                    themeColor={active ? 'accent' : 'text'}
                    style={styles.name}>
                    {item.name}
                  </ThemedText>
                  {active && (
                    <ThemedText type="small" themeColor="accent">
                      {t('radio.live')}
                    </ThemedText>
                  )}
                </PressableCard>
              </AnimatedListItem>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.three, paddingHorizontal: Spacing.four },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  name: { flex: 1 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

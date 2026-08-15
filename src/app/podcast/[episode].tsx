// Podcast-Voll-Player (Spotify/YouTube-Niveau): unscharfer Cover-Hintergrund,
// Cover, Scrubber, Play/Pause, ±15 s, Folge vor/zurueck, Schnell-Geschwindigkeit,
// Lautstaerke, sowie ein Einstellungs-Sheet (Geschwindigkeitsliste, Sleeptimer,
// Wiederholen, Autoplay). Transkript zum Mitlesen mit synchron mitlaufendem
// Highlight (Zeitmarken aus der Vertonung) + Autoscroll. Nutzt den App-weiten
// Shared-Player (usePlayer.ts) -> Hintergrund-Wiedergabe + Lockscreen sind
// bereits geloest; der globale Mini-Player uebernimmt beim Verlassen.
import { setAudioModeAsync } from 'expo-audio';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  fetchPodcastIndex,
  formatDuration,
  type PodcastEpisode,
  type TranscriptSegment,
} from '@/features/podcast/data';
import { ContentLanguageBadge } from '@/features/media/content-language-badge';
import { resolveEpisodeAudioUri, usePodcastDownload } from '@/features/podcast/downloads';
import { Slider } from '@/features/podcast/slider';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { useSharedPlayer, type NowPlayingInfo } from '@/features/quran/usePlayer';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SLEEP_OPTIONS: (number | 'episode')[] = [5, 10, 15, 30, 60, 'episode'];
const SKIP_SEC = 15;

export default function PodcastPlayerScreen() {
  const { episode: episodeParam } = useLocalSearchParams<{ episode: string }>();
  const episodeNo = Number(episodeParam);
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { player, status, nowPlaying, setNowPlaying } = useSharedPlayer();

  // Vollbild-Player: grosszuegiges, quadratisches Cover statt des alten kompakten
  // 160er-Kaertchens. Groesse skaliert mit dem Bildschirm (Breite minus Rand,
  // durch die Hoehe gedeckelt, damit auf kurzen Displays alles ohne Scrollen
  // passt) und bleibt auf breiten Screens/Tablets an MaxContentWidth gebunden.
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const coverSize = Math.min(
    winWidth - Spacing.four * 2,
    MaxContentWidth - Spacing.four * 2,
    Math.max(220, winHeight * 0.42),
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['podcast', 'index'],
    queryFn: fetchPodcastIndex,
    staleTime: 60 * 60 * 1000,
  });

  const episodes = data?.episodes ?? [];
  const episode = episodes.find((e) => e.episode_no === episodeNo);
  const dl = usePodcastDownload(episode);
  const idx = episodes.findIndex((e) => e.episode_no === episodeNo);
  const prev = idx > 0 ? episodes[idx - 1] : undefined;
  const next = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1] : undefined;

  const nowTitle = episode ? `${episode.episode_no}. ${episode.title}` : '';
  const isThisLoaded = !!episode && nowPlaying?.title === nowTitle;
  // Interpret/Album fürs OS-Now-Playing (Sperrbildschirm/Benachrichtigung):
  // Serientitel, sonst ein sprechender Fallback statt der rohen Audio-URL.
  const seriesTitle = data?.series?.title;
  const artist = seriesTitle && seriesTitle.trim() ? seriesTitle : 'Salati Podcast';

  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [sleep, setSleep] = useState<number | 'episode' | null>(null);

  const duration = status.duration || episode?.duration_sec || 0;
  const position = status.currentTime || 0;
  const progress = duration > 0 ? position / duration : 0;

  // Refs, damit der (screen-unabhängige) onEnded-Callback keine veralteten
  // Werte sieht. Sync im Effekt (nicht im Render-Body — react-hooks/refs).
  const repeatRef = useRef(repeat);
  const autoplayRef = useRef(autoplay);
  const sleepRef = useRef(sleep);
  useEffect(() => {
    repeatRef.current = repeat;
    autoplayRef.current = autoplay;
    sleepRef.current = sleep;
  });

  // Ist der Voll-Player-Screen gerade sichtbar? Am Folgenende wird im
  // Vordergrund zur nächsten Folge navigiert (die große Ansicht folgt mit),
  // im Hintergrund NUR still auf dem Shared-Player weitergespielt, ohne den
  // Nutzer aus einem anderen Screen herauszureißen.
  const focusedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  function configureBackground(ep?: PodcastEpisode) {
    if (Platform.OS === 'web') return;
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
    // Vollständige Metadaten statt nur Titel: sonst zeigt das OS beim Laden der
    // Quelle die rohe Audio-URL (Bug: "salati.pro/Podcast/1" auf dem
    // Sperrbildschirm). artworkUrl liefert zusätzlich das Cover.
    const e = ep ?? episode;
    player.setActiveForLockScreen(true, {
      title: e ? `${e.episode_no}. ${e.title}` : nowTitle,
      artist,
      artworkUrl: e?.cover_url || undefined,
    });
  }

  // Now-Playing-Info für den globalen Mini-Player: Titel, Serienname, Rücksprung
  // (href) und Folge-vor/zurück. Die onPrev/onNext wechseln die Folge DIREKT im
  // geteilten Player (ohne Navigation), damit die Steuerung auch funktioniert,
  // während der Nutzer längst auf einem anderen Screen ist.
  // Verhalten am natürlichen Folgenende — an die KONKRET gespielte Folge `ep`
  // gebunden (nicht an den gerade angezeigten Screen-Parameter), damit das
  // Auto-Advance auch beim Weiterlaufen im Hintergrund über mehrere Folgen
  // hinweg immer die richtige „nächste" Folge trifft. Priorität: Sleeptimer
  // „bis Folgenende" (stehen bleiben) > Wiederholen > Autoplay nächste Folge.
  function handleEndedFor(ep: PodcastEpisode): () => void {
    return () => {
      if (sleepRef.current === 'episode') return;
      if (repeatRef.current) {
        player.seekTo(0);
        player.play();
        return;
      }
      if (!autoplayRef.current) return;
      const i = episodes.findIndex((e) => e.episode_no === ep.episode_no);
      const n = i >= 0 && i < episodes.length - 1 ? episodes[i + 1] : undefined;
      if (!n) return;
      if (focusedRef.current) {
        // Vordergrund: Screen mitziehen (autoPlayedRef-Effekt startet die Folge).
        router.replace({ pathname: '/podcast/[episode]', params: { episode: n.episode_no } });
      } else {
        // Hintergrund: still auf dem Shared-Player weiterspielen.
        playEpisode(n);
      }
    };
  }

  function nowPlayingFor(ep: PodcastEpisode): NowPlayingInfo {
    const i = episodes.findIndex((e) => e.episode_no === ep.episode_no);
    const p = i > 0 ? episodes[i - 1] : undefined;
    const n = i >= 0 && i < episodes.length - 1 ? episodes[i + 1] : undefined;
    return {
      title: `${ep.episode_no}. ${ep.title}`,
      subtitle: artist,
      href: { pathname: '/podcast/[episode]', params: { episode: ep.episode_no } },
      hasPrev: !!p,
      hasNext: !!n,
      onPrev: p ? () => playEpisode(p) : undefined,
      onNext: n ? () => playEpisode(n) : undefined,
      onEnded: handleEndedFor(ep),
    };
  }

  // Lokale Datei hat Vorrang (Offline-Wiedergabe): ist die Folge heruntergeladen,
  // wird die file://-URI statt der Remote-URL an den Player gegeben (async
  // Datei-Existenz-Check → playEpisode ist async, Aufrufer nutzen es
  // Fire-and-forget). setNowPlaying nutzt das reiche nowPlayingFor (Titel,
  // Serienname, Rücksprung, Folge-vor/zurück UND onEnded-Auto-Advance) — nicht
  // nur den Titel, sonst gingen Auto-Advance + Mini-Player-Steuerung verloren.
  async function playEpisode(ep: PodcastEpisode) {
    const uri = await resolveEpisodeAudioUri(ep);
    player.replace(uri);
    player.setPlaybackRate(speed);
    configureBackground(ep);
    player.play();
    setNowPlaying(nowPlayingFor(ep));
  }

  async function loadAndPlay() {
    if (!episode) return;
    playEpisode(episode);
  }

  // Lautstaerke reaktiv anwenden: expo-audio bietet dafuer nur die Property
  // (kein setVolume), und nach replace() steht sie wieder auf 1.0 — daher an
  // isThisLoaded gekoppelt. Effekt ist die korrekte Seiteneffekt-Stelle.
  useEffect(() => {
    if (!isThisLoaded) return;
    player.volume = volume;
  }, [volume, isThisLoaded, player]);

  // Ausgewählte Folge automatisch starten (Bug: Antippen einer anderen Folge
  // spielte nicht ab). Gilt für Öffnen aus der Liste, Folge vor/zurück und
  // Autoplay am Folgenende — pro episode_no genau einmal. Läuft im Player
  // bereits GENAU diese Folge (Rückkehr über den Mini-Player), NICHT neu von
  // vorn starten.
  const autoPlayedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!episode) return;
    if (autoPlayedRef.current === episode.episode_no) return;
    autoPlayedRef.current = episode.episode_no;
    if (isThisLoaded) return;
    loadAndPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.episode_no, isThisLoaded]);

  // Sperrbildschirm-/Benachrichtigungs-Metadaten nach dem Laden erneut setzen:
  // replace() lädt die Quelle asynchron; expo-audio initialisiert die
  // Now-Playing-Info beim Laden aus der rohen Datei (URL/Dateiname) und
  // überschreibt damit den direkt nach replace() gesetzten Titel — dadurch
  // stand die Audio-URL statt des Folgentitels auf dem Sperrbildschirm.
  useEffect(() => {
    if (Platform.OS === 'web' || !isThisLoaded || !status.isLoaded || !episode) return;
    player.updateLockScreenMetadata({
      title: nowTitle,
      artist,
      artworkUrl: episode.cover_url || undefined,
    });
  }, [isThisLoaded, status.isLoaded, nowTitle, artist, episode, player]);

  // Das Ende-der-Folge-Verhalten (Wiederholen / Autoplay nächste Folge /
  // Sleeptimer „bis Folgenende") läuft screen-unabhängig über den in
  // nowPlaying hinterlegten onEnded-Callback, den der Shared-Player auslöst
  // (s. handleEndedFor + SharedPlayerProvider) — so greift es auch, wenn dieser
  // Screen längst verlassen ist und der Podcast nur noch im Mini-Player läuft.

  // Sleeptimer (Minuten): pausiert nach Ablauf. 'episode' wird oben behandelt.
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    if (typeof sleep === 'number') {
      sleepTimeoutRef.current = setTimeout(() => player.pause(), sleep * 60_000);
    }
    return () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    };
  }, [sleep, player]);

  function togglePlay() {
    if (!episode) return;
    if (!isThisLoaded) {
      loadAndPlay();
      return;
    }
    if (status.playing) player.pause();
    else {
      configureBackground();
      player.play();
    }
  }

  function skip(delta: number) {
    if (!isThisLoaded) return;
    player.seekTo(Math.max(0, Math.min(duration, position + delta)));
  }

  function applySpeed(s: number) {
    setSpeed(s);
    if (isThisLoaded) player.setPlaybackRate(s);
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    applySpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  }

  function goTo(ep?: PodcastEpisode) {
    if (ep) router.replace({ pathname: '/podcast/[episode]', params: { episode: ep.episode_no } });
  }

  // Audit 2026-07-27: Lade- und Fehlerzweig ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang (Podcast-Stack: headerShown:false, Zurueck-Chip
  // Web-only). Der Index-Fetch hat keinen Timeout — ein haengendes Netz liess
  // den Spinner dauerhaft stehen.
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('podcast.title')} onBack={() => backOr('/podcast')} />
          <View style={styles.stateCenter}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isError || !episode) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('podcast.title')} onBack={() => backOr('/podcast')} />
          <View style={styles.stateCenter}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const shownProgress = seekPreview ?? progress;
  // Offline-Cover bevorzugen (lokale Datei), sonst Remote-Cover.
  const coverSource = dl.localCoverUri ?? episode.cover_url;

  return (
    <ThemedView style={styles.container}>
      {/* Unscharfer Cover-Hintergrund (Spotify-Optik) */}
      {coverSource ? (
        <Image
          source={coverSource}
          style={styles.bgImage}
          contentFit="cover"
          blurRadius={Platform.OS === 'web' ? 60 : 40}
          accessibilityLabel=""
        />
      ) : null}
      <View style={[styles.bgOverlay, { backgroundColor: colors.background, opacity: 0.82 }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Kopfzeile: Zurueck links, Offline-Download + Settings rechts.
            Der Zurueck-Knopf kam beim Audit 2026-07-27 (U1) dazu — der
            Vollbild-Player hatte auf nativ keinen sichtbaren Ausgang, der
            Stack laeuft mit headerShown:false. */}
        <View style={[styles.topBar, rtl && styles.topBarRtl]}>
          {Platform.OS === 'web' ? (
            // Im Web uebernimmt weiterhin der schwebende GlobalBackButton-Chip;
            // ein zweiter Knopf waere eine doppelte Affordanz.
            <View style={styles.settingsBtn} />
          ) : (
            <Pressable
              onPress={() => backOr('/podcast')}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.back')}
              hitSlop={10}
              style={styles.settingsBtn}>
              <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.topBarRight}>
          {dl.supported ? (
            <PodcastDownloadButton dl={dl} />
          ) : (
            <View style={styles.settingsBtn} />
          )}
          <Pressable
            onPress={() => setShowSettings(true)}
            accessibilityRole="button"
            accessibilityLabel={t('podcast.settings')}
            hitSlop={10}
            style={styles.settingsBtn}>
            <IconSymbol name="options" size={22} color={colors.text} />
          </Pressable>
          </View>
        </View>

        {/* Vollbild-Layout: Cover/Transkript fuellen den freien Raum oben,
            Titel + Steuerung sitzen darunter — ueber die volle Hoehe verteilt
            (space-between), damit der Player den Bildschirm ausfuellt statt sich
            zu einem engen Kaertchen zu quetschen. */}
        <View style={styles.content}>
          {/* Media-Slot: Cover ODER mitlaufendes Transkript teilen sich denselben
              Platz (Umschalter unten). Der Slot waechst (flex) und zentriert das
              grosse Cover; im Transkript-Modus fuellt das Transkript den Bereich. */}
          <View style={styles.mediaSlot}>
            {showTranscript ? (
              <Transcript
                segments={episode.transcript}
                positionMs={position * 1000}
                active={isThisLoaded && status.playing}
                style={styles.transcriptInSlot}
              />
            ) : coverSource ? (
              <Image
                source={coverSource}
                style={[styles.cover, { width: coverSize, height: coverSize }]}
                contentFit="cover"
                transition={200}
                accessibilityLabel={episode.title}
              />
            ) : (
              <ThemedView
                type="backgroundSelected"
                style={[styles.cover, styles.coverFallback, { width: coverSize, height: coverSize }]}>
                <IconSymbol name="headset" size={96} color={colors.accent} />
              </ThemedView>
            )}
          </View>

          {/* Titelblock */}
          <View style={styles.infoBlock}>
            <ThemedText type="small" themeColor="accent" style={styles.epNo}>
              {t('podcast.episodeLabel')} {episode.episode_no}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.title} numberOfLines={2}>
              {episode.title}
            </ThemedText>
            {episode.description ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.desc} numberOfLines={2}>
                {episode.description}
              </ThemedText>
            ) : null}
            <ContentLanguageBadge lang={episode.lang} />
          </View>

          {/* Steuerblock: Scrubber, Transport, Sekundaerregler, Mitlesen-Umschalter */}
          <View style={styles.bottomBlock}>
            {/* Scrubber */}
            <View style={styles.scrubBlock}>
              <Slider
                value={shownProgress}
                accessibilityLabel={t('podcast.seek')}
                onChange={(r) => setSeekPreview(r)}
                onCommit={(r) => {
                  setSeekPreview(null);
                  if (isThisLoaded && duration > 0) player.seekTo(r * duration);
                }}
              />
              <View style={styles.timeRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration((seekPreview != null ? seekPreview * duration : position) || 0)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(duration)}
                </ThemedText>
              </View>
            </View>

            {/* Transport */}
            <View style={styles.transport}>
              <CircleButton icon="play-skip-back" size={24} onPress={() => goTo(prev)} disabled={!prev} label={t('podcast.previous')} />
              <CircleButton icon="play-back" size={26} onPress={() => skip(-SKIP_SEC)} label="-15s" />
              <Pressable
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={status.playing && isThisLoaded ? t('podcast.pause') : t('podcast.play')}
                style={[styles.playBtn, { backgroundColor: colors.accent }]}>
                <IconSymbol name={status.playing && isThisLoaded ? 'pause' : 'play'} size={38} color={colors.background} />
              </Pressable>
              <CircleButton icon="play-forward" size={26} onPress={() => skip(SKIP_SEC)} label="+15s" />
              <CircleButton icon="play-skip-forward" size={24} onPress={() => goTo(next)} disabled={!next} label={t('podcast.next')} />
            </View>

            {/* Sekundaerreihe: Speed schnell, Lautstaerke, Repeat, Sleep */}
            <View style={styles.controlsRow}>
              <PressableCard onPress={cycleSpeed} type="backgroundElement" style={styles.pill}>
                <IconSymbol name="speedometer" size={16} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {speed}×
                </ThemedText>
              </PressableCard>
              <Pressable
                onPress={() => setRepeat((r) => !r)}
                accessibilityRole="button"
                accessibilityLabel={t('podcast.repeat')}
                hitSlop={8}
                style={styles.iconToggle}>
                <IconSymbol name="repeat" size={20} color={repeat ? colors.accent : colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => setShowSettings(true)}
                accessibilityRole="button"
                accessibilityLabel={t('podcast.sleepTimer')}
                hitSlop={8}
                style={styles.iconToggle}>
                <IconSymbol name="moon" size={19} color={sleep != null ? colors.accent : colors.textSecondary} />
              </Pressable>
              <View style={styles.volumeBlock}>
                <IconSymbol
                  name={volume === 0 ? 'volume-mute' : volume < 0.5 ? 'volume-low' : 'volume-high'}
                  size={18}
                  color={colors.textSecondary}
                />
                <View style={styles.volumeSlider}>
                  <Slider value={volume} accessibilityLabel={t('podcast.volume')} onChange={setVolume} onCommit={setVolume} />
                </View>
              </View>
            </View>

            {/* Umschalter „Text mitlesen": blendet oben das Cover gegen das
                synchrone Transkript aus (kein separater Block unten mehr). */}
            <PressableCard onPress={() => setShowTranscript((s) => !s)} type="backgroundElement" style={styles.transcriptToggle}>
              <IconSymbol name={showTranscript ? 'image' : 'document-text'} size={18} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent" style={styles.flex}>
                {showTranscript ? t('podcast.hideTranscript') : t('podcast.showTranscript')}
              </ThemedText>
              <IconSymbol name={showTranscript ? 'checkmark-circle' : 'chevron-forward'} size={16} color={colors.textSecondary} />
            </PressableCard>
          </View>
        </View>
      </SafeAreaView>

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        speed={speed}
        onSpeed={applySpeed}
        sleep={sleep}
        onSleep={setSleep}
        repeat={repeat}
        onRepeat={setRepeat}
        autoplay={autoplay}
        onAutoplay={setAutoplay}
      />
    </ThemedView>
  );
}

function CircleButton({
  icon,
  size,
  onPress,
  disabled,
  label,
}: {
  icon: IconName;
  size: number;
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.circleBtn, disabled && styles.circleBtnDisabled]}>
      <IconSymbol name={icon} size={size} color={disabled ? colors.textSecondary : colors.text} />
    </Pressable>
  );
}

/** Offline-Download-Steuerung in der Kopfzeile: none -> laden, downloading ->
 *  Prozent/abbrechen, done -> löschen (mit Bestätigung). */
function PodcastDownloadButton({ dl }: { dl: ReturnType<typeof usePodcastDownload> }) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  function confirmDelete() {
    Alert.alert(t('podcast.deleteDownloadConfirmTitle'), t('podcast.deleteDownloadConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('podcast.deleteDownload'), style: 'destructive', onPress: () => void dl.remove() },
    ]);
  }

  if (dl.state === 'downloading') {
    return (
      <Pressable
        onPress={dl.cancel}
        accessibilityRole="button"
        accessibilityLabel={t('podcast.cancelDownload')}
        hitSlop={8}
        style={styles.downloadBtn}>
        {dl.progress > 0 ? (
          <ThemedText type="smallBold" themeColor="accent" style={styles.downloadPct}>
            {Math.round(dl.progress * 100)}%
          </ThemedText>
        ) : (
          <ThemedActivityIndicator size="small" />
        )}
        <IconSymbol name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    );
  }

  if (dl.state === 'done') {
    return (
      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel={t('podcast.deleteDownload')}
        hitSlop={8}
        style={styles.downloadBtn}>
        <IconSymbol name="cloud-done" size={20} color={colors.accent} />
        <ThemedText type="smallBold" themeColor="accent" style={styles.downloadPct}>
          {t('podcast.offline')}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={dl.download}
      accessibilityRole="button"
      accessibilityLabel={t('podcast.download')}
      hitSlop={8}
      style={styles.downloadBtn}>
      <IconSymbol name="download-outline" size={20} color={colors.text} />
    </Pressable>
  );
}

function SettingsSheet({
  visible,
  onClose,
  speed,
  onSpeed,
  sleep,
  onSleep,
  repeat,
  onRepeat,
  autoplay,
  onAutoplay,
}: {
  visible: boolean;
  onClose: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  sleep: number | 'episode' | null;
  onSleep: (s: number | 'episode' | null) => void;
  repeat: boolean;
  onRepeat: (r: boolean) => void;
  autoplay: boolean;
  onAutoplay: (a: boolean) => void;
}) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView type="backgroundElement" style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
        <View style={styles.sheetHandle} />
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetLabel}>
            {t('podcast.speed')}
          </ThemedText>
          <View style={styles.chipRow}>
            {SPEEDS.map((s) => (
              <Chip key={s} active={speed === s} label={`${s}×`} onPress={() => onSpeed(s)} />
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetLabel}>
            {t('podcast.sleepTimer')}
          </ThemedText>
          <View style={styles.chipRow}>
            <Chip active={sleep == null} label={t('podcast.off')} onPress={() => onSleep(null)} />
            {SLEEP_OPTIONS.map((s) => (
              <Chip
                key={String(s)}
                active={sleep === s}
                label={s === 'episode' ? t('podcast.endOfEpisode') : `${s} min`}
                onPress={() => onSleep(s)}
              />
            ))}
          </View>

          <ToggleRow icon="repeat" label={t('podcast.repeat')} value={repeat} onToggle={() => onRepeat(!repeat)} />
          <ToggleRow
            icon="play-forward-circle"
            label={t('podcast.autoplay')}
            value={autoplay}
            onToggle={() => onAutoplay(!autoplay)}
          />

          <Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: colors.accent }]}>
            <ThemedText type="smallBold" style={{ color: colors.background }}>
              {t('common.done')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.accent : colors.backgroundSelected },
      ]}>
      <ThemedText type="small" style={{ color: active ? colors.background : colors.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: IconName;
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <IconSymbol name={icon} size={20} color={value ? colors.accent : colors.textSecondary} />
      <ThemedText type="default" style={styles.flex}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.switchTrack,
          { backgroundColor: value ? colors.accent : colors.backgroundSelected },
        ]}>
        <View style={[styles.switchThumb, { backgroundColor: colors.background, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

/** Mitlese-Transkript mit synchronem Highlight + Autoscroll (bei Zeitmarken). */
function Transcript({
  segments,
  positionMs,
  active,
  style,
}: {
  segments: TranscriptSegment[];
  positionMs: number;
  active: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Arabische Transkript-Zeilen in der eingestellten Koran-Schrift.
  const quranFont = useQuranFont();
  const hasTimings = segments.some((s) => typeof s.start_ms === 'number');
  const activeIndex =
    hasTimings && active
      ? segments.findIndex(
          (s) =>
            typeof s.start_ms === 'number' &&
            positionMs >= s.start_ms &&
            (s.end_ms == null || positionMs < s.end_ms),
        )
      : -1;

  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<number[]>([]);
  const lastScrolled = useRef(-1);

  useEffect(() => {
    if (activeIndex >= 0 && activeIndex !== lastScrolled.current) {
      lastScrolled.current = activeIndex;
      const y = offsetsRef.current[activeIndex];
      if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 70), animated: true });
    }
  }, [activeIndex]);

  return (
    <ScrollView ref={scrollRef} style={[styles.transcript, style]} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      {segments.map((seg, i) => {
        const isActive = i === activeIndex;
        if (seg.type === 'ar') {
          return (
            <ThemedText
              key={i}
              onLayout={(e) => (offsetsRef.current[i] = e.nativeEvent.layout.y)}
              style={[styles.arSeg, quranFont.style, { color: isActive ? colors.accent : colors.text }]}>
              {seg.text}
            </ThemedText>
          );
        }
        return (
          <ThemedText
            key={i}
            type="default"
            onLayout={(e) => (offsetsRef.current[i] = e.nativeEvent.layout.y)}
            themeColor={isActive ? 'accent' : 'text'}
            style={[styles.deSeg, isActive && styles.activeSeg]}>
            {seg.text}
          </ThemedText>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  safeArea: { flex: 1, paddingTop: Spacing.two + BackChipInset },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Lade-/Fehlerflaeche UNTER dem Kopf (styles.center hat kein flex:1 und
  // wuerde den Kopf mit in die Mitte ziehen).
  stateCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topBarRtl: { flexDirection: 'row-reverse' },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, height: 40, paddingHorizontal: Spacing.two, borderRadius: 20 },
  downloadPct: { fontSize: 12 },
  // Vollbild-Layout: fuellt die Hoehe zwischen Kopfzeile und unterem Rand und
  // verteilt Media / Titel / Steuerung ueber die volle Hoehe (space-between).
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    justifyContent: 'space-between',
  },
  // Media-Slot waechst und fuellt den freien Raum oben; Cover/Transkript werden
  // darin zentriert. So wirkt der Cover-Bereich gross und prominent statt eng.
  mediaSlot: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  // Grosses quadratisches Cover — Groesse wird zur Laufzeit (coverSize) gesetzt.
  cover: { borderRadius: 24 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  // Im Transkript-Modus fuellt das Transkript den kompletten Media-Bereich.
  transcriptInSlot: { flex: 1, width: '100%', marginTop: 0 },
  infoBlock: { alignItems: 'center', width: '100%', marginTop: Spacing.three },
  epNo: { textTransform: 'uppercase', letterSpacing: 1 },
  // Titel gross und gut lesbar (Vollbild-Player, nicht mehr eng gequetscht).
  title: { textAlign: 'center', marginTop: Spacing.one, fontSize: 26, lineHeight: 32 },
  desc: { textAlign: 'center', marginTop: Spacing.one, paddingHorizontal: Spacing.two, lineHeight: 20 },
  bottomBlock: { width: '100%', marginTop: Spacing.three },
  scrubBlock: { width: '100%', marginTop: Spacing.two },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -Spacing.one },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four, marginTop: Spacing.three },
  circleBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  circleBtnDisabled: { opacity: 0.35 },
  playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.four, width: '100%' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  iconToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  volumeBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  volumeSlider: { flex: 1 },
  transcriptToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two, marginTop: Spacing.four, width: '100%' },
  flex: { flex: 1 },
  transcript: { width: '100%', marginTop: Spacing.two },
  deSeg: { marginBottom: Spacing.two, lineHeight: 24 },
  arSeg: { marginBottom: Spacing.two, fontSize: 24, lineHeight: 44, textAlign: 'right', writingDirection: 'rtl' },
  activeSeg: { fontWeight: '700' },
  // Settings-Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Spacing.five,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', marginTop: Spacing.two },
  sheetContent: { padding: Spacing.four, gap: Spacing.two, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  sheetLabel: { textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 999, minWidth: 52, alignItems: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three, marginTop: Spacing.one },
  switchTrack: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 20, height: 20, borderRadius: 10 },
  doneBtn: { marginTop: Spacing.four, paddingVertical: Spacing.three, borderRadius: 999, alignItems: 'center' },
});

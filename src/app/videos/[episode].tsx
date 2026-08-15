// Video-Voll-Player (nativ, iOS/Android): grosser 16:9-VideoView mit eigenen
// Steuerelementen — Scrubber (mit Buffer-Anzeige), Play/Pause, ±15 s, Folge
// vor/zurueck, Geschwindigkeit, Bild-in-Bild, Vollbild sowie ein Einstellungs-
// Sheet (Geschwindigkeit, Autoplay, Hintergrund-Ton). Am Folgenende spielt bei
// aktivem Autoplay automatisch die naechste Folge (innerhalb derselben Reihe
// bzw. Playlist). Ueber „zu Playlist hinzufuegen" landet die Folge in einer
// eigenen, lokalen Playlist. Die Wiedergabe-Position wird pro Folge gemerkt
// (Weiterschauen) und beim erneuten Oeffnen wiederhergestellt. Der Web-Fallback
// (HTML5 <video>) liegt in [episode].web.tsx.
import { useEvent, useEventListener } from 'expo';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { isPictureInPictureSupported, useVideoPlayer, VideoView } from 'expo-video';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ContentLanguageBadge } from '@/features/media/content-language-badge';
import { AddToPlaylistSheet } from '@/features/video/add-to-playlist-sheet';
import { fetchVideoIndex, formatDuration, seriesNeighbors, type VideoEpisode } from '@/features/video/data';
import { resolveVideoUri, useVideoDownload } from '@/features/video/downloads';
import { useVideoPlaylists } from '@/features/video/playlists';
import { useVideoPrefs } from '@/features/video/prefs';
import { loadVideoProgress, saveVideoProgress } from '@/features/video/progress';
import { Slider } from '@/features/podcast/slider';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SKIP_SEC = 15;

export default function VideoPlayerScreen() {
  const { episode: episodeParam, list: listParam } = useLocalSearchParams<{ episode: string; list?: string }>();
  const episodeNo = Number(episodeParam);
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { width: winWidth } = useWindowDimensions();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['video', 'index'],
    queryFn: fetchVideoIndex,
    staleTime: 60 * 60 * 1000,
  });

  const { prefs, setAutoplay, setBackground, setSpeed } = useVideoPrefs();
  const { playlists } = useVideoPlaylists();

  const episodes = useMemo(() => data?.episodes ?? [], [data]);
  const episode = episodes.find((e) => e.episode_no === episodeNo);
  const dl = useVideoDownload(episode);

  // Reihenfolge fuer „vor/zurueck" + Auto-Play: innerhalb einer Playlist (wenn
  // ueber `list` geoeffnet) sonst innerhalb der eigenen Reihe (nicht quer durch
  // alle Reihen). So bleibt das Auto-Play thematisch zusammenhaengend.
  const { prev, next } = useMemo(() => {
    const playlist = listParam ? playlists.find((p) => p.id === listParam) : undefined;
    if (playlist) {
      const ordered = playlist.episodeNos
        .map((n) => episodes.find((e) => e.episode_no === n))
        .filter((e): e is VideoEpisode => !!e);
      const i = ordered.findIndex((e) => e.episode_no === episodeNo);
      return {
        prev: i > 0 ? ordered[i - 1] : undefined,
        next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : undefined,
      };
    }
    return seriesNeighbors(episodes, episodeNo);
  }, [episodes, episodeNo, listParam, playlists]);

  // Player einmal mit leerer Quelle anlegen (Rules of Hooks: unbedingt am
  // Anfang). Die echte Quelle wird gesetzt, sobald die Folge + die aufgeloeste
  // (lokale oder Remote-) URI feststehen. 0.5 s Zeitmarken-Intervall speist den
  // eigenen Scrubber.
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 0.5;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const timeUpdate = useEvent(player, 'timeUpdate');
  const currentTime = timeUpdate?.currentTime ?? 0;

  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylistSheet, setShowPlaylistSheet] = useState(false);

  const speed = prefs.speed;
  const duration = player.duration || episode?.duration_sec || 0;
  const progress = duration > 0 ? currentTime / duration : 0;
  const shownProgress = seekPreview ?? progress;
  const bufferedRatio = duration > 0 ? Math.min(1, (player.bufferedPosition || 0) / duration) : 0;

  const viewRef = useRef<VideoView>(null);
  const pipSupported = useMemo(() => {
    try {
      return isPictureInPictureSupported();
    } catch {
      return false;
    }
  }, []);

  // Geschwindigkeit auf den Player anwenden — nur im Effekt erlaubt (Property-
  // Mutation eines Hook-Werts). Nach jedem Quellwechsel (status → readyToPlay)
  // erneut, da replace() die Rate zuruecksetzen kann.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = speed;
  }, [speed, status, player]);

  // Hintergrund-Ton + Now-Playing-Benachrichtigung an die (klebrige) Nutzer-
  // Einstellung koppeln. Hinweis: Fuer echten Hintergrund-Ton muss zusaetzlich
  // das expo-video-Plugin `supportsBackgroundPlayback: true` gesetzt sein
  // (greift erst nach einem nativen Rebuild).
  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
    player.staysActiveInBackground = prefs.background;
    player.showNowPlayingNotification = prefs.background;
    /* eslint-enable react-hooks/immutability */
  }, [prefs.background, player, status]);

  // Weiterschauen-Position wird nach dem Laden EINMAL angesprungen.
  const seekedRef = useRef(false);
  const pendingSeekRef = useRef(0);

  // Quelle + gemerkte Position laden, sobald die Folge feststeht. Lokale Datei
  // hat Vorrang (Offline). replace() laedt asynchron; der Sprung auf die
  // gemerkte Position passiert im Status-Effekt (readyToPlay).
  useEffect(() => {
    if (!episode) return;
    let cancelled = false;
    seekedRef.current = false;
    pendingSeekRef.current = 0;
    (async () => {
      const [uri, saved] = await Promise.all([
        resolveVideoUri(episode),
        loadVideoProgress(episode.episode_no),
      ]);
      if (cancelled) return;
      pendingSeekRef.current = saved;
      player.replace(uri);
      player.play();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.episode_no]);

  // Nach dem Laden (readyToPlay) einmalig auf die gemerkte Position springen.
  useEffect(() => {
    if (status !== 'readyToPlay' || seekedRef.current) return;
    seekedRef.current = true;
    const seek = pendingSeekRef.current;
    if (seek > 1 && seek < player.duration - 2) player.seekBy(seek - player.currentTime);
  }, [status, player]);

  // Position throttled sichern (alle ~4 s), erst nachdem der Resume-Sprung
  // angewandt wurde.
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (!episode || !seekedRef.current) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 4000) return;
    lastSaveRef.current = now;
    void saveVideoProgress(episode.episode_no, currentTime, duration);
  }, [currentTime, episode, duration]);

  // Beim Verlassen/Unmount die letzte Position sichern.
  const saveRef = useRef({ episodeNo, currentTime, duration, seeked: false });
  useEffect(() => {
    saveRef.current = { episodeNo, currentTime, duration, seeked: seekedRef.current };
  });
  useFocusEffect(
    useCallback(() => {
      return () => {
        const s = saveRef.current;
        if (s.seeked) void saveVideoProgress(s.episodeNo, s.currentTime, s.duration);
      };
    }, []),
  );

  // Auto-Play am Folgenende: naechste Folge (Reihe/Playlist) laden. Refs, damit
  // der Event-Callback frische Werte sieht (nicht die vom ersten Render).
  const autoplayRef = useRef(prefs.autoplay);
  const nextRef = useRef<VideoEpisode | undefined>(next);
  const listRef = useRef<string | undefined>(listParam);
  useEffect(() => {
    autoplayRef.current = prefs.autoplay;
    nextRef.current = next;
    listRef.current = listParam;
  });
  useEventListener(player, 'playToEnd', () => {
    if (!autoplayRef.current) return;
    // Kaskaden-Schutz: nur weiterspringen, wenn die Folge WIRKLICH bis ans Ende
    // gelaufen ist. Sonst loesen Lade-/Quellwechsel-Events (replace auf noch
    // nicht bereitem Player) ein falsches playToEnd aus und Autoplay springt
    // Folge fuer Folge bis ans Reihenende durch (frueherer Bug: „immer letzte
    // Folge der Reihe"). player.duration/currentTime werden live gelesen.
    const dur = player.duration;
    if (!(dur > 0 && player.currentTime >= dur - 1.5)) return;
    const n = nextRef.current;
    if (!n) return;
    router.replace({
      pathname: '/videos/[episode]',
      params: listRef.current ? { episode: n.episode_no, list: listRef.current } : { episode: n.episode_no },
    });
  });

  function togglePlay() {
    if (isPlaying) player.pause();
    else player.play();
  }

  function skip(delta: number) {
    player.seekBy(delta);
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
    void setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  }

  function goTo(ep?: VideoEpisode) {
    if (ep)
      router.replace({
        pathname: '/videos/[episode]',
        params: listParam ? { episode: ep.episode_no, list: listParam } : { episode: ep.episode_no },
      });
  }

  function togglePip() {
    void viewRef.current?.startPictureInPicture().catch(() => {});
  }

  function confirmDeleteDownload() {
    Alert.alert(t('video.deleteDownloadConfirmTitle'), t('video.deleteDownloadConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('video.deleteDownload'), style: 'destructive', onPress: () => void dl.remove() },
    ]);
  }

  // Audit 2026-07-27: Lade- und Fehlerzweig ohne Kopf = auf nativ ohne
  // sichtbaren Ausgang (Video-Stack: headerShown:false, Zurueck-Chip Web-only).
  // Der Index-Fetch hat keinen Timeout — ein haengendes Netz liess den Spinner
  // dauerhaft stehen.
  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('video.title')} onBack={() => backOr('/videos')} />
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
          <ScreenHeader title={t('video.title')} onBack={() => backOr('/videos')} />
          <View style={styles.stateCenter}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.error')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const videoWidth = Math.min(winWidth, MaxContentWidth);
  const videoHeight = Math.round((videoWidth * 9) / 16);
  const loadingVideo = status === 'loading' || status === 'idle';
  const topics = episode.topics.filter((s) => s && s.trim().length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Audit 2026-07-27 (U1): der Video-Detailscreen hatte auf nativ keinen
            sichtbaren Ausgang — der Stack laeuft mit headerShown:false, der
            schwebende Zurueck-Chip existiert nur im Web. Ausserhalb der
            ScrollView, damit er beim Scrollen nicht wegwandert (U2). */}
        {Platform.OS !== 'web' && (
          <View style={[styles.topBar, rtl && styles.topBarRtl]}>
            <Pressable
              onPress={() => backOr('/videos')}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.back')}
              hitSlop={10}
              style={styles.backBtn}>
              <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text} />
            </Pressable>
          </View>
        )}
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Videoflaeche */}
          <View style={[styles.videoWrap, { width: videoWidth, height: videoHeight }]}>
            <VideoView
              ref={viewRef}
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
              fullscreenOptions={{ enable: true }}
              allowsPictureInPicture
              startsPictureInPictureAutomatically={prefs.background}
              accessibilityLabel={episode.title}
            />
            {loadingVideo && (
              <View style={styles.videoLoading} pointerEvents="none">
                <ThemedActivityIndicator />
              </View>
            )}
          </View>

          {/* Steuerleiste */}
          <View style={styles.controls}>
            <View style={styles.scrubBlock}>
              <Slider
                value={shownProgress}
                accessibilityLabel={t('video.seek')}
                onChange={(r) => setSeekPreview(r)}
                onCommit={(r) => {
                  setSeekPreview(null);
                  if (duration > 0) player.seekBy(r * duration - currentTime);
                }}
              />
              {/* Buffer-Anzeige: wie weit vorausgeladen ist. */}
              {bufferedRatio > 0.001 && bufferedRatio < 0.999 && (
                <View style={styles.bufferTrack} pointerEvents="none">
                  <View style={[styles.bufferFill, { width: `${Math.round(bufferedRatio * 100)}%`, backgroundColor: colors.textSecondary }]} />
                </View>
              )}
              <View style={styles.timeRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration((seekPreview != null ? seekPreview * duration : currentTime) || 0)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(duration)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.transport}>
              <CircleButton icon="play-skip-back" size={24} onPress={() => goTo(prev)} disabled={!prev} label={t('video.previous')} />
              <CircleButton icon="play-back" size={26} onPress={() => skip(-SKIP_SEC)} label="-15s" />
              <Pressable
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? t('video.pause') : t('video.play')}
                style={[styles.playBtn, { backgroundColor: colors.accent }]}>
                <IconSymbol name={isPlaying ? 'pause' : 'play'} size={34} color={colors.background} />
              </Pressable>
              <CircleButton icon="play-forward" size={26} onPress={() => skip(SKIP_SEC)} label="+15s" />
              <CircleButton icon="play-skip-forward" size={24} onPress={() => goTo(next)} disabled={!next} label={t('video.next')} />
            </View>

            {/* Sekundaerreihe (umbrechend): Speed, Autoplay, Playlist, PiP,
                Download, Vollbild, Einstellungen. */}
            <View style={styles.secondaryRow}>
              <Pill icon="speedometer" label={`${speed}×`} onPress={cycleSpeed} />
              <Pill
                icon="play-forward-circle"
                label={t('video.autoplay')}
                active={prefs.autoplay}
                onPress={() => void setAutoplay(!prefs.autoplay)}
              />
              <Pill icon="albums-outline" label={t('video.playlist')} onPress={() => setShowPlaylistSheet(true)} />
              {pipSupported && <Pill icon="browsers-outline" label={t('video.pip')} onPress={togglePip} />}

              {dl.supported &&
                (dl.state === 'downloading' ? (
                  <PressableCard onPress={dl.cancel} type="backgroundElement" style={styles.pill}>
                    {dl.progress > 0 ? (
                      <ThemedText type="smallBold" themeColor="accent">
                        {Math.round(dl.progress * 100)}%
                      </ThemedText>
                    ) : (
                      <ThemedActivityIndicator size="small" />
                    )}
                    <IconSymbol name="close" size={14} color={colors.textSecondary} />
                  </PressableCard>
                ) : dl.state === 'done' ? (
                  <PressableCard onPress={confirmDeleteDownload} type="backgroundElement" style={styles.pill}>
                    <IconSymbol name="cloud-done" size={16} color={colors.accent} />
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('video.offline')}
                    </ThemedText>
                  </PressableCard>
                ) : (
                  <Pill icon="download-outline" label={t('video.download')} onPress={dl.download} />
                ))}

              <Pill icon="expand" label={t('video.fullscreen')} onPress={() => void viewRef.current?.enterFullscreen()} />
              <Pill icon="options" label={t('video.settings')} onPress={() => setShowSettings(true)} />
            </View>
          </View>

          {/* Titel + Beschreibung + Themen */}
          <View style={styles.info}>
            <ThemedText type="small" themeColor="accent" style={styles.epNo}>
              {episode.series_title ? `${episode.series_title} · ` : ''}
              {t('video.episodeLabel')} {episode.episode_no}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.title}>
              {episode.title}
            </ThemedText>
            {episode.description ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.desc}>
                {episode.description}
              </ThemedText>
            ) : null}
            <ContentLanguageBadge lang={episode.lang} />

            {topics.length > 0 && (
              <>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.topicsLabel}>
                  {t('video.topics').toUpperCase()}
                </ThemedText>
                <View style={styles.topicsWrap}>
                  {topics.map((topic, i) => (
                    <View key={i} style={[styles.topicChip, { backgroundColor: colors.backgroundElement }]}>
                      <ThemedText type="small" themeColor="text">
                        {topic}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <AddToPlaylistSheet visible={showPlaylistSheet} onClose={() => setShowPlaylistSheet(false)} episodeNo={episode.episode_no} />
      <VideoSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        speed={speed}
        onSpeed={(s) => void setSpeed(s)}
        autoplay={prefs.autoplay}
        onAutoplay={(a) => void setAutoplay(a)}
        background={prefs.background}
        onBackground={(b) => void setBackground(b)}
      />
    </ThemedView>
  );
}

function Pill({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <PressableCard onPress={onPress} type="backgroundElement" style={styles.pill}>
      <IconSymbol name={icon} size={16} color={active === false ? colors.textSecondary : colors.accent} />
      <ThemedText type="smallBold" themeColor={active === false ? 'textSecondary' : 'accent'}>
        {label}
      </ThemedText>
    </PressableCard>
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

function VideoSettingsSheet({
  visible,
  onClose,
  speed,
  onSpeed,
  autoplay,
  onAutoplay,
  background,
  onBackground,
}: {
  visible: boolean;
  onClose: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  autoplay: boolean;
  onAutoplay: (a: boolean) => void;
  background: boolean;
  onBackground: (b: boolean) => void;
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
            {t('video.speed')}
          </ThemedText>
          <View style={styles.chipRow}>
            {SPEEDS.map((s) => (
              <Chip key={s} active={speed === s} label={`${s}×`} onPress={() => onSpeed(s)} />
            ))}
          </View>

          <ToggleRow
            icon="play-forward-circle"
            label={t('video.autoplay')}
            hint={t('video.autoplayHint')}
            value={autoplay}
            onToggle={() => onAutoplay(!autoplay)}
          />
          <ToggleRow
            icon="headset"
            label={t('video.backgroundPlay')}
            hint={t('video.backgroundPlayHint')}
            value={background}
            onToggle={() => onBackground(!background)}
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
      style={[styles.chip, { backgroundColor: active ? colors.accent : colors.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: active ? colors.background : colors.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onToggle,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <IconSymbol name={icon} size={20} color={value ? colors.accent : colors.textSecondary} />
      <View style={styles.toggleText}>
        <ThemedText type="default">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.switchTrack, { backgroundColor: value ? colors.accent : colors.backgroundSelected }]}>
        <View style={[styles.switchThumb, { backgroundColor: colors.background, alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two + BackChipInset },
  topBar: { paddingHorizontal: Spacing.three, alignItems: 'flex-start' },
  topBarRtl: { alignItems: 'flex-end' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Lade-/Fehlerflaeche UNTER dem Kopf (styles.center hat kein flex:1 und
  // wuerde den Kopf mit in die Mitte ziehen).
  stateCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: Spacing.six, alignItems: 'center' },
  videoWrap: { backgroundColor: '#000', alignSelf: 'center', overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  videoLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  controls: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  scrubBlock: { width: '100%' },
  bufferTrack: { height: 2, borderRadius: 1, backgroundColor: 'rgba(128,128,128,0.25)', overflow: 'hidden', marginTop: 2 },
  bufferFill: { height: 2, borderRadius: 1, opacity: 0.6 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.half },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four, marginTop: Spacing.two },
  circleBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  circleBtnDisabled: { opacity: 0.35 },
  playBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  info: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
    gap: Spacing.one,
  },
  epNo: { textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 22, lineHeight: 28, marginTop: Spacing.half },
  desc: { marginTop: Spacing.one, lineHeight: 22 },
  topicsLabel: { letterSpacing: 1, marginTop: Spacing.three },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  topicChip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: 999 },
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
  toggleText: { flex: 1, gap: 2 },
  switchTrack: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 20, height: 20, borderRadius: 10 },
  doneBtn: { marginTop: Spacing.four, paddingVertical: Spacing.three, borderRadius: 999, alignItems: 'center' },
});

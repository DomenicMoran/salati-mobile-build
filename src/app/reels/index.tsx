// In-App-Reels-Feed (Instagram-/TikTok-/Shorts-Stil): vertikaler Vollbild-Feed
// zum Hochwischen. Spielt die kurzen 9:16-Clips DIREKT in Salati ab — ohne
// Instagram. Daten aus dem oeffentlichen R2-Bucket (features/reels/data.ts).
//
// PERFORMANCE / KEIN PLAYER-LEAK: Es wird NICHT pro Listeneintrag ein
// Video-Player erzeugt. Ein `ReelVideo` (und damit ein `useVideoPlayer`) wird
// nur fuer das sichtbare Reel + die direkten Nachbarn gemountet
// (`shouldRender = |index - active| <= 1`); alle anderen Zeilen rendern nur
// einen leichten dunklen Platzhalter. Zusaetzlich haelt die FlatList per
// `windowSize={3}` das Mount-Fenster klein und entlaedt Entferntes
// (`removeClippedSubviews`). So existieren nie mehr als ~3 Player gleichzeitig.
//
// AUTOPLAY: Nur das sichtbare Reel spielt (via onViewableItemsChanged); die
// Nachbarn sind vorgeladen, aber pausiert. Das aktive Reel loopt.
//
// KURATIERUNG: Oben kleine Filter-Chips — "Fuer dich" (nach Reihe verschraenkt,
// damit nicht 5x dieselbe Reihe hintereinander laeuft), "Alle" (ep-Reihenfolge)
// und je eine Chip pro Reihe. Bedienung im TikTok-Stil: Doppeltipp = Like,
// grosses Play/Pause-Feedback, scrubbarer Fortschrittsbalken, rechte Action-
// Leiste (Like / Teilen / Ton), unten schoen gesetzte Reihe/Titel/Beschreibung.
import { useEvent } from 'expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useReelsIndex, type Reel } from '@/features/reels/data';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTranslation } from '@/lib/i18n';

// Feste, auf beiden Themes lesbare Overlay-Farben — der Feed ist bewusst
// immer dunkel (Video fuellt den Screen).
const OVERLAY_TEXT = '#FFFFFF';
const OVERLAY_MUTED = 'rgba(255,255,255,0.72)';
const CONTROL_BG = 'rgba(0,0,0,0.42)';
const LIKE_RED = '#FF3B5C';

// Spezielle Filter-Kennungen (keine echte Reihe).
const FILTER_FOR_YOU = '__foryou';
const FILTER_ALL = '__all';

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** "Fuer dich": deterministisch nach Reihe verschraenken (Round-Robin ueber die
 *  Reihen-Buckets), damit nicht mehrere Clips derselben Reihe hintereinander
 *  laufen. Deterministisch (kein Math.random pro Render) — stabile Reihenfolge
 *  ueber Re-Renders, keine Sprung-Effekte. */
function interleaveBySeries(reels: Reel[]): Reel[] {
  const buckets = new Map<string, Reel[]>();
  for (const r of reels) {
    const key = r.series || r.id;
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }
  const lists = [...buckets.values()];
  const out: Reel[] = [];
  for (let i = 0; out.length < reels.length; i++) {
    let progressed = false;
    for (const list of lists) {
      if (i < list.length) {
        out.push(list[i]);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return out;
}

interface SeriesChip {
  key: string;
  label: string;
  icon?: 'sparkles' | 'apps-outline';
}

export default function ReelsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isRefetching } = useReelsIndex();

  const allReels = useMemo(() => data?.reels ?? [], [data]);

  // Vollbild-Seitenhoehe = gesamte Fensterhoehe (randloses Video).
  // useWindowDimensions statt Dimensions.get('window'), damit die Seitenhoehe
  // (getItemLayout/snapToInterval) bei Geraetedrehung reaktiv nachzieht — sonst
  // blieben Paging-Offsets nach einer Rotation auf dem alten Wert haengen.
  const { height, width } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState(0);
  // Respektvoller Start: gemutet, mit gut sichtbarem Ton-Button. Ton-Zustand
  // gilt global fuer den ganzen Feed.
  const [muted, setMuted] = useState(true);
  // Lokale Likes (nur in dieser Session, kein Netz) — Map von Reel-ID -> bool.
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  // Aktiver Filter/Kuratierung.
  const [filter, setFilter] = useState<string>(FILTER_FOR_YOU);

  const listRef = useRef<FlatList<Reel>>(null);

  // Reihen fuer die Filter-Chips (eindeutig, in erster Auftritt-Reihenfolge).
  const chips = useMemo<SeriesChip[]>(() => {
    const seen = new Set<string>();
    const seriesChips: SeriesChip[] = [];
    for (const r of allReels) {
      if (r.series && !seen.has(r.series)) {
        seen.add(r.series);
        seriesChips.push({ key: r.series, label: r.series_title || r.series });
      }
    }
    const base: SeriesChip[] = [
      { key: FILTER_FOR_YOU, label: t('reels.forYou'), icon: 'sparkles' },
      { key: FILTER_ALL, label: t('reels.all'), icon: 'apps-outline' },
    ];
    // Chips nur zeigen, wenn es ueberhaupt mehr als eine Reihe gibt.
    return seriesChips.length > 1 ? [...base, ...seriesChips] : [];
  }, [allReels, t]);

  // Die aktuell sichtbare, gefilterte + kuratierte Liste.
  const reels = useMemo(() => {
    if (filter === FILTER_ALL) return allReels;
    if (filter === FILTER_FOR_YOU) return interleaveBySeries(allReels);
    return allReels.filter((r) => r.series === filter);
  }, [allReels, filter]);

  const onChangeFilter = useCallback((key: string) => {
    setFilter(key);
    setActiveIndex(0);
    // Bei Filterwechsel zurueck an den Anfang (sonst zeigt der Feed einen
    // Offset auf einer ploetzlich kuerzeren Liste).
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const likeOn = useCallback((id: string) => {
    // Doppeltipp liket immer (nie ent-liken) — wie bei TikTok/Instagram.
    setLiked((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  // useCallback (stabile Identitaet) statt useRef.current — FlatList erlaubt
  // kein Wechseln von onViewableItemsChanged zur Laufzeit.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.index != null);
      if (first?.index != null) setActiveIndex(first.index);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Reel; index: number }) => (
      <ReelItem
        reel={item}
        height={height}
        width={width}
        isActive={index === activeIndex}
        shouldRender={Math.abs(index - activeIndex) <= 1}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        liked={!!liked[item.id]}
        onToggleLike={() => toggleLike(item.id)}
        onLikeOn={() => likeOn(item.id)}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
      />
    ),
    [activeIndex, muted, liked, height, width, insets.top, insets.bottom, toggleLike, likeOn],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: height, offset: height * index, index }),
    [height],
  );

  // --- Nicht-Feed-Zustaende (immer dunkel, damit kein Theme-Flackern) --------
  if (isLoading) {
    return (
      <View style={styles.fullDark}>
        <StatusBar style="light" />
        <BackButton insetsTop={insets.top} />
        <ActivityIndicator size="large" color={Brand.gold} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.fullDark}>
        <StatusBar style="light" />
        <BackButton insetsTop={insets.top} />
        <View style={styles.centerBox}>
          <IconSymbol name="cloud-offline-outline" size={40} color={OVERLAY_MUTED} />
          <ThemedText type="subtitle" style={styles.stateTitle}>
            {t('reels.errorTitle')}
          </ThemedText>
          <ThemedText type="small" style={styles.stateText}>
            {t('reels.errorDesc')}
          </ThemedText>
          <Pressable
            style={styles.retryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel={t('reels.retry')}
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color={Brand.ink} />
            ) : (
              <ThemedText type="smallBold" style={styles.retryLabel}>
                {t('reels.retry')}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (reels.length === 0) {
    // "Reels kommen bald" — index.json existiert noch nicht oder ist leer.
    return (
      <View style={styles.fullDark}>
        <StatusBar style="light" />
        <BackButton insetsTop={insets.top} />
        <View style={styles.centerBox}>
          <IconSymbol name="film-outline" size={44} color={OVERLAY_MUTED} />
          <ThemedText type="subtitle" style={styles.stateTitle}>
            {t('reels.comingSoonTitle')}
          </ThemedText>
          <ThemedText type="small" style={styles.stateText}>
            {t('reels.comingSoonDesc')}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullDark}>
      <StatusBar style="light" hidden />
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        // Mount-Fenster klein halten -> nie mehr als ~3 Player leben.
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        removeClippedSubviews
      />
      <BackButton insetsTop={insets.top} />
      {chips.length > 0 && (
        <FilterChips
          chips={chips}
          active={filter}
          onChange={onChangeFilter}
          insetsTop={insets.top}
        />
      )}
    </View>
  );
}

// --- Filter-Chips (oben, horizontal scrollbar) -------------------------------

interface FilterChipsProps {
  chips: SeriesChip[];
  active: string;
  onChange: (key: string) => void;
  insetsTop: number;
}

function FilterChips({ chips, active, onChange, insetsTop }: FilterChipsProps) {
  return (
    <View style={[styles.chipsBar, { top: insetsTop + Spacing.two }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
      >
        {chips.map((chip) => {
          const isActive = chip.key === active;
          return (
            <Pressable
              key={chip.key}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onChange(chip.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={chip.label}
              hitSlop={6}
            >
              {chip.icon && (
                <IconSymbol
                  name={chip.icon}
                  size={13}
                  color={isActive ? Brand.ink : OVERLAY_TEXT}
                />
              )}
              <ThemedText
                type="smallBold"
                style={[styles.chipLabel, isActive && styles.chipLabelActive]}
                numberOfLines={1}
              >
                {chip.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// --- Ein Reel (eine Vollbild-Seite) ------------------------------------------

interface ReelItemProps {
  reel: Reel;
  height: number;
  width: number;
  isActive: boolean;
  shouldRender: boolean;
  muted: boolean;
  onToggleMute: () => void;
  liked: boolean;
  onToggleLike: () => void;
  onLikeOn: () => void;
  insetsTop: number;
  insetsBottom: number;
}

function ReelItem({
  reel,
  height,
  width,
  isActive,
  shouldRender,
  muted,
  onToggleMute,
  liked,
  onToggleLike,
  onLikeOn,
  insetsBottom,
}: ReelItemProps) {
  const { t } = useTranslation();

  const onShare = useCallback(() => {
    const parts = [reel.title, reel.series_title].filter(Boolean);
    Share.share({
      message: parts.length ? `${parts.join(' — ')}\n${reel.video_url}` : reel.video_url,
      url: reel.video_url,
    }).catch(() => {});
  }, [reel]);

  return (
    <View style={[styles.page, { height, width }]}>
      {shouldRender ? (
        <ReelVideo reel={reel} isActive={isActive} muted={muted} onLikeOn={onLikeOn} />
      ) : (
        <View style={styles.placeholder} />
      )}

      {/* Overlay: faellt durch (box-none), nur die Buttons fangen Taps —
          Taps auf leere Flaeche erreichen so den Play/Pause-Layer im Video. */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Weicher Scrim unten fuer Text-Lesbarkeit ueber hellen Videostellen. */}
        <BottomScrim />

        {/* Rechte Action-Leiste: Like / Teilen / Ton */}
        <View
          style={[styles.actionRail, { bottom: insetsBottom + Spacing.six }]}
          pointerEvents="box-none"
        >
          <ActionButton
            icon={liked ? 'heart' : 'heart-outline'}
            iconColor={liked ? LIKE_RED : OVERLAY_TEXT}
            label={t('reels.like')}
            onPress={onToggleLike}
          />
          <ActionButton icon="share-social" label={t('reels.share')} onPress={onShare} />
          <ActionButton
            icon={muted ? 'volume-mute' : 'volume-high'}
            label={muted ? t('reels.unmute') : t('reels.mute')}
            onPress={onToggleMute}
          />
        </View>

        {/* Untere Info (Reihe / Titel / Beschreibung) */}
        <View
          style={[styles.bottomInfo, { paddingBottom: insetsBottom + Spacing.four }]}
          pointerEvents="none"
        >
          {!!reel.series_title && (
            <View style={styles.seriesPill}>
              <IconSymbol name="film-outline" size={12} color={Brand.gold} />
              <ThemedText type="smallBold" style={styles.series} numberOfLines={1}>
                {reel.series_title}
              </ThemedText>
            </View>
          )}
          {!!reel.title && (
            <ThemedText type="subtitle" style={styles.title} numberOfLines={2}>
              {reel.title}
            </ThemedText>
          )}
          {!!reel.description && (
            <ThemedText type="small" style={styles.desc} numberOfLines={3}>
              {reel.description}
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

// --- Rechte Action-Leisten-Schaltflaeche -------------------------------------

interface ActionButtonProps {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  label: string;
  onPress: () => void;
  iconColor?: string;
}

function ActionButton({ icon, label, onPress, iconColor = OVERLAY_TEXT }: ActionButtonProps) {
  return (
    <Pressable
      style={styles.actionButton}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionIcon}>
        <IconSymbol name={icon} size={26} color={iconColor} />
      </View>
      <ThemedText type="small" style={styles.actionLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// --- Der eigentliche Video-Layer (haelt den Player) --------------------------

interface ReelVideoProps {
  reel: Reel;
  isActive: boolean;
  muted: boolean;
  onLikeOn: () => void;
}

function ReelVideo({ reel, isActive, muted, onLikeOn }: ReelVideoProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  const player = useVideoPlayer(reel.video_url, (p: VideoPlayer) => {
    p.loop = true;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.2;
  });

  // Play/Pause-Status direkt vom Player abonnieren (kein eigener State).
  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
    oldIsPlaying: undefined,
  });

  // Aktiv <-> inaktiv: nur das sichtbare Reel spielt. Ein pausierter Nachbar
  // wird auf 0 zurueckgespult, damit er beim Draufwischen von vorn beginnt.
  useEffect(() => {
    if (isActive) {
      // eslint-disable-next-line react-hooks/immutability -- Video-Player ist ein externes, mutables Objekt
      player.currentTime = 0;
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, player]);

  // Ton global umschalten.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Video-Player ist ein externes, mutables Objekt
    player.muted = muted;
  }, [muted, player]);

  // Fortschritt: nur der aktive Player feuert timeUpdate (Rest pausiert).
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const duration = player.duration;
  const progress = duration > 0 ? clamp01(currentTime / duration) : 0;

  // --- Scrubbing / Tap-to-seek am Fortschrittsbalken -------------------------
  // Bewusst State (kein Ref) fuer Breite + Dauer: beide aendern sich nach dem
  // Laden nur einmal, also baut `useMemo` den PanResponder faktisch nur ein-
  // bis zweimal — nicht bei jedem timeUpdate. Vermeidet die Ref-in-Render-Regel.
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(1);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width || 1);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setScrubFrac(clamp01(e.nativeEvent.locationX / trackWidth));
        },
        onPanResponderMove: (e) => {
          setScrubFrac(clamp01(e.nativeEvent.locationX / trackWidth));
        },
        onPanResponderRelease: (e) => {
          const frac = clamp01(e.nativeEvent.locationX / trackWidth);
          if (duration > 0) {
            // eslint-disable-next-line react-hooks/immutability -- Video-Player ist ein externes, mutables Objekt
            player.currentTime = frac * duration;
          }
          setScrubFrac(null);
        },
        onPanResponderTerminate: () => setScrubFrac(null),
      }),
    [player, trackWidth, duration],
  );

  const displayFrac = scrubFrac != null ? scrubFrac : progress;

  // --- Play/Pause + Doppeltipp-Like ------------------------------------------
  const togglePlay = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  // Herz-Burst-Animation bei Doppeltipp.
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  const triggerHeart = useCallback(() => {
    /* eslint-disable react-hooks/immutability -- Reanimated-SharedValues sind externe, bewusst mutable Objekte */
    heartOpacity.value = 1;
    if (reducedMotion) {
      heartScale.value = 1;
      heartOpacity.value = withTiming(0, { duration: 500 });
      return;
    }
    heartScale.value = 0.3;
    heartScale.value = withSequence(
      withSpring(1, { damping: 6, stiffness: 150 }),
      withTiming(1.06, { duration: 120 }),
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 90 }),
      withDelay(320, withTiming(0, { duration: 320 })),
    );
    /* eslint-enable react-hooks/immutability */
  }, [reducedMotion, heartOpacity, heartScale]);

  const lastTapRef = useRef(0);
  const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (singleTimerRef.current) clearTimeout(singleTimerRef.current);
    },
    [],
  );

  const onTapArea = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      // Doppeltipp -> Like
      if (singleTimerRef.current) {
        clearTimeout(singleTimerRef.current);
        singleTimerRef.current = null;
      }
      lastTapRef.current = 0;
      onLikeOn();
      triggerHeart();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      // Einzeltipp -> Play/Pause (leicht verzoegert, um Doppeltipp abzuwarten)
      lastTapRef.current = now;
      singleTimerRef.current = setTimeout(() => {
        singleTimerRef.current = null;
        togglePlay();
      }, 280);
    }
  }, [onLikeOn, triggerHeart, togglePlay]);

  const showPlayGlyph = isActive && !isPlaying;

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Tap-Layer fuer Play/Pause + Doppeltipp-Like (unter dem Info-Overlay) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTapArea}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? t('reels.pause') : t('reels.play')}
      />

      {/* Grosses Play-Feedback wenn pausiert */}
      {showPlayGlyph && (
        <Animated.View
          style={styles.playGlyph}
          pointerEvents="none"
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}
        >
          <View style={styles.playGlyphCircle}>
            <IconSymbol name="play" size={40} color={OVERLAY_TEXT} />
          </View>
        </Animated.View>
      )}

      {/* Doppeltipp-Herz */}
      <Animated.View style={[styles.heartBurst, heartStyle]} pointerEvents="none">
        <IconSymbol name="heart" size={120} color={LIKE_RED} />
      </Animated.View>

      {/* Scrubbarer Fortschrittsbalken ganz unten */}
      <View
        style={styles.progressHit}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={t('reels.seek')}
      >
        <View style={[styles.progressTrack, scrubFrac != null && styles.progressTrackActive]}>
          <View style={[styles.progressFill, { width: `${displayFrac * 100}%` }]} />
        </View>
        {scrubFrac != null && (
          <View style={[styles.progressKnob, { left: `${displayFrac * 100}%` }]} pointerEvents="none" />
        )}
      </View>
    </View>
  );
}

// --- Kleine UI-Bausteine -----------------------------------------------------

function BottomScrim() {
  // Faux-Gradient (kein expo-linear-gradient in den Deps): duenne, nach unten
  // dunkler werdende Baender — dezent, aber macht Text ueber hellen Videostellen
  // lesbar. Statisch, kein Rechenaufwand pro Frame.
  const bands = 8;
  return (
    <View style={styles.scrim} pointerEvents="none">
      {Array.from({ length: bands }).map((_, i) => (
        <View
          key={i}
          style={{ flex: 1, backgroundColor: `rgba(0,0,0,${((0.6 * (i + 1)) / bands).toFixed(3)})` }}
        />
      ))}
    </View>
  );
}

function BackButton({ insetsTop }: { insetsTop: number }) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={[styles.backButton, { top: insetsTop + Spacing.two }]}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/lernen'))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('reels.back')}
    >
      <IconSymbol name="chevron-back" size={24} color={OVERLAY_TEXT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullDark: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  page: { backgroundColor: '#000' },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 },

  // Filter-Chips oben (links neben dem Back-Button beginnend).
  chipsBar: { position: 'absolute', left: 56, right: 0, height: 40 },
  chipsContent: { paddingRight: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    height: 32,
    borderRadius: 999,
    backgroundColor: CONTROL_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chipActive: { backgroundColor: Brand.gold, borderColor: Brand.gold },
  chipLabel: { color: OVERLAY_TEXT },
  chipLabelActive: { color: Brand.ink },

  // Rechte Action-Leiste.
  actionRail: { position: 'absolute', right: Spacing.three, alignItems: 'center', gap: Spacing.three },
  actionButton: { alignItems: 'center', gap: 3 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: OVERLAY_TEXT, fontSize: 11, lineHeight: 14 },

  // Untere Info.
  bottomInfo: {
    position: 'absolute',
    left: Spacing.four,
    right: 84,
    bottom: 0,
    gap: Spacing.one,
  },
  seriesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.32)',
    marginBottom: 2,
  },
  series: { color: Brand.gold },
  title: {
    color: OVERLAY_TEXT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  desc: { color: OVERLAY_MUTED, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },

  backButton: {
    position: 'absolute',
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  playGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyphCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  heartBurst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fortschrittsbalken (mit groesserer Trefferflaeche fuers Scrubbing).
  progressHit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    justifyContent: 'flex-end',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  progressTrackActive: { height: 5 },
  progressFill: { height: '100%', backgroundColor: Brand.gold },
  progressKnob: {
    position: 'absolute',
    bottom: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: Brand.gold,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  centerBox: { alignItems: 'center', paddingHorizontal: Spacing.four, gap: Spacing.two },
  stateTitle: { color: OVERLAY_TEXT, textAlign: 'center' },
  stateText: { color: OVERLAY_MUTED, textAlign: 'center' },
  retryButton: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: Brand.gold,
    minWidth: 120,
    alignItems: 'center',
  },
  retryLabel: { color: Brand.ink },
});

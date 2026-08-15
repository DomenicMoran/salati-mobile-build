import { setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type { Href } from 'expo-router';

import { useSsrSafeAudioPlayer, useSsrSafeAudioPlayerStatus } from '@/lib/ssrSafeAudio';
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { PlaybackSpeed } from '@/features/settings/types';

export interface PlayableAyah {
  numberInSurah: number;
  audio?: string;
}

// ---- App-weiter geteilter Player (globaler Mini-Player) ----
// radio.tsx und der Sure-Reader ([surah].tsx) erzeugten bislang je einen
// LOKALEN expo-audio-Player über useSsrSafeAudioPlayer — der native Player
// wird beim Unmount des Screens automatisch freigegeben, Wiedergabe stoppte
// also beim Verlassen der Seite. SharedPlayerProvider erzeugt EINEN Player an
// der App-Wurzel (gemountet in app/_layout.tsx, überlebt Navigation), beide
// Screens reichen ihn optional an useAyahPlayer bzw. nutzen ihn direkt statt
// eines eigenen lokalen Players — MiniPlayer (components/mini-player.tsx)
// liest denselben Kontext und bleibt dadurch screen-übergreifend sichtbar.
export interface NowPlayingInfo {
  title: string;
  /** Optionaler Untertitel (z. B. Serien-/Sendername) für den Mini-Player. */
  subtitle?: string;
  /** Route zum jeweiligen Voll-Player — ein Tap auf den Mini-Player springt
   *  dorthin zurück (Podcast-Folge / Radio / Sure-Reader). Ohne href ist die
   *  Pille nicht antippbar (reine Statusanzeige). */
  href?: Href;
  /** Vorige/nächste Spur direkt aus dem Mini-Player — pro Medium optional
   *  (Podcast: Folge, Radio: Sender, Rezitation: Vers). Fehlt der Callback,
   *  wird der jeweilige Button ausgeblendet. */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** Was am NATÜRLICHEN Ende der Spur passieren soll (didJustFinish) — vom
   *  Shared-Player screen-unabhängig ausgelöst. So läuft z. B. der Podcast auch
   *  im Hintergrund (Voll-Player-Screen längst verlassen) automatisch mit der
   *  nächsten Folge weiter. Fehlt der Callback, passiert am Ende nichts. */
  onEnded?: () => void;
}

export interface SharedPlayerHandle {
  player: AudioPlayer;
  status: AudioStatus;
  setNowPlaying: (info: NowPlayingInfo | null) => void;
}

interface SharedPlayerContextValue extends SharedPlayerHandle {
  nowPlaying: NowPlayingInfo | null;
}

const SharedPlayerContext = createContext<SharedPlayerContextValue | null>(null);

// 100ms statt des expo-audio-Standards (500ms): derselbe Player bedient auch
// das wortsynchrone Highlighting im Sure-Reader (s. useAyahPlayer unten) —
// einzelne Wort-Segmente sind teils nur 460-660ms lang.
const SHARED_PLAYER_UPDATE_INTERVAL_MS = 100;

/** Kein JSX, damit diese Datei .ts (nicht .tsx) bleiben kann — der
 * Positions-Polling-Hook lebt bewusst neben der Context-Definition. */
export function SharedPlayerProvider({ children }: { children: ReactNode }) {
  const player = useSsrSafeAudioPlayer(null, { updateInterval: SHARED_PLAYER_UPDATE_INTERVAL_MS });
  const status = useSsrSafeAudioPlayerStatus(player);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingInfo | null>(null);

  // Screen-unabhängiges Track-Ende: der aktive Player läuft an der App-Wurzel
  // weiter, auch wenn der jeweilige Voll-Player-Screen unmountet ist (nur
  // Mini-Player sichtbar). Bisher hing das Auto-Advance im [episode]-Screen —
  // war der verlassen, blieb der Podcast am Folgenende stehen (User-Bug
  // 2026-07-22: „Folge 1 zu Ende → Folge 2 startet nicht"). Jetzt löst der
  // Provider den vom Medium hinterlegten onEnded-Callback aus. didJustFinish
  // wird render-abgeleitet erkannt (kein setState im Effekt-Body) und über
  // einen Zähler an den ausführenden Effekt gereicht; nowPlaying via Ref, damit
  // der zum Track-Ende gehörende Callback (nicht ein zwischenzeitlich neuer)
  // läuft.
  const nowPlayingRef = useRef(nowPlaying);
  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  });
  const [lastFinish, setLastFinish] = useState(false);
  const [finishTick, setFinishTick] = useState(0);
  if (status.didJustFinish !== lastFinish) {
    setLastFinish(status.didJustFinish);
    if (status.didJustFinish) setFinishTick((n) => n + 1);
  }
  useEffect(() => {
    if (finishTick === 0) return;
    nowPlayingRef.current?.onEnded?.();
  }, [finishTick]);

  const value = useMemo<SharedPlayerContextValue>(
    () => ({ player, status, nowPlaying, setNowPlaying }),
    [player, status, nowPlaying],
  );

  return createElement(SharedPlayerContext.Provider, { value }, children);
}

/** Zugriff auf den App-weiten Player — nur innerhalb von SharedPlayerProvider
 * (app/_layout.tsx) nutzbar, z. B. von radio.tsx und [surah].tsx. */
export function useSharedPlayer(): SharedPlayerContextValue {
  const ctx = useContext(SharedPlayerContext);
  if (!ctx) throw new Error('useSharedPlayer must be used within SharedPlayerProvider');
  return ctx;
}

/**
 * Sequenzieller Ayah-Player: ein einzelner expo-audio-Player, dessen Quelle
 * per replace() gewechselt wird, statt pro Track eine neue Player-Instanz zu
 * erzeugen. Springt bei didJustFinish automatisch zum nächsten Vers mit
 * Audio-URL (übersetzungsreine Editions haben teils Lücken).
 *
 * `updateIntervalMs` (Default 500, expo-audio-Standard) steuert, wie oft
 * `status.currentTime` aktualisiert wird — der Sure-Reader übergibt hier 100ms,
 * weil das wortsynchrone Highlighting ([surah].tsx) einzelne Wort-Segmente
 * abgleicht, die teils nur 460-660ms lang sind; beim 500ms-Default sprang die
 * Hervorhebung sichtbar (Audit-Fund 2026-07-20). Der Mushaf-Seiten-Player
 * highlightet nur ganze Verse, nicht Wörter, und bleibt daher beim Default.
 *
 * `shared` (optional): App-weiter Player aus useSharedPlayer() statt eines
 * lokalen — der Sure-Reader übergibt ihn, damit Wiedergabe beim Verlassen
 * des Screens weiterläuft (globaler Mini-Player). Ohne `shared` unverändertes
 * Verhalten (lokaler Player, z. B. weiterhin für den Mushaf-Seiten-Player).
 */
export function useAyahPlayer(
  ayahs: PlayableAyah[],
  surahLabel: string,
  speed: PlaybackSpeed = 1,
  updateIntervalMs = 500,
  shared?: SharedPlayerHandle,
  /** Route, zu der der globale Mini-Player bei Tap zurückspringt (Sure-Reader).
   *  Nur relevant, wenn `shared` gesetzt ist. */
  nowPlayingHref?: Href,
) {
  const [index, setIndex] = useState<number | null>(null);
  // Lokaler Player wird unabhängig davon erzeugt, ob `shared` gesetzt ist —
  // Hooks dürfen nicht bedingt aufgerufen werden. Bei aktivem `shared` bleibt
  // er ungenutzt (kein zusätzlicher Sound, expo-audio lädt ohne source nicht).
  const localPlayer = useSsrSafeAudioPlayer(null, { updateInterval: updateIntervalMs });
  const localStatus = useSsrSafeAudioPlayerStatus(localPlayer);
  const player = shared?.player ?? localPlayer;
  const status = shared?.status ?? localStatus;
  const ayahsRef = useRef(ayahs);
  ayahsRef.current = ayahs;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  // Einzelvers-Modus (Play-Button am Vers): nach dem Vers stoppen statt
  // die ganze Sure weiterzuspielen (User-Feedback). "Sure abspielen" und
  // der Mini-Player laufen weiterhin fortlaufend.
  const continuousRef = useRef(true);
  // Abschnitts-Wiedergabe (Al-Quran-Parität): von Vers x bis y, optional
  // endlos wiederholen — z. B. zum Auswendiglernen eines Abschnitts.
  // `onComplete` (optional): wird genau einmal aufgerufen, wenn der Bereich
  // NATÜRLICH zu Ende gespielt wurde (Ende erreicht, kein Loop) — nicht bei
  // manuellem Stop/Verlassen des Bereichs. Trägt die Suren-übergreifende
  // Abschnitts-Wiedergabe im Sure-Reader ([surah].tsx): dort meldet der
  // Callback "diese Sure-Etappe ist fertig" und navigiert bei Bedarf zur
  // nächsten Sure weiter, ohne dass useAyahPlayer selbst etwas von Suren
  // oder Navigation wissen muss.
  const rangeRef = useRef<{ from: number; to: number; loop: boolean; onComplete?: () => void } | null>(null);

  useEffect(() => {
    if (!status.didJustFinish || index === null) return;
    if (!continuousRef.current) {
      setIndex(null);
      return;
    }
    const range = rangeRef.current;
    if (range && index >= range.to) {
      if (range.loop) {
        playFrom(range.from);
      } else {
        rangeRef.current = null;
        setIndex(null);
        range.onComplete?.();
      }
      return;
    }
    const list = ayahsRef.current;
    let next = index + 1;
    while (next < list.length && !list[next]?.audio) next++;
    if (next < list.length) {
      playFrom(next);
    } else {
      if (range?.loop) {
        playFrom(range.from);
        return;
      }
      rangeRef.current = null;
      setIndex(null);
      range?.onComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // Laufende Wiedergabe live auf Geschwindigkeitswechsel reagieren lassen.
  useEffect(() => {
    if (index !== null) player.setPlaybackRate(speed);
  }, [speed, index, player]);

  function playFrom(i: number, continuous: boolean = true) {
    const src = ayahsRef.current[i]?.audio;
    if (!src) return;
    continuousRef.current = continuous;
    // Manuelles Abspielen außerhalb des aktiven Bereichs beendet den
    // Bereichs-Modus (neue Nutzer-Absicht).
    const range = rangeRef.current;
    if (range && (i < range.from || i > range.to)) rangeRef.current = null;
    setIndex(i);
    player.replace(src);
    player.setPlaybackRate(speedRef.current);
    if (Platform.OS !== 'web') {
      // interruptionMode 'doNotMix' ist Voraussetzung dafür, dass iOS die
      // Lockscreen-Steuerung überhaupt mit diesem Player verknüpft (sonst
      // erkennt das OS die Session nicht als aktive Hintergrund-Wiedergabe
      // - Ursache des Apple-Review-Rejects Guideline 2.5.4, Submission
      // c796b8c5). Muss vor player.play() gesetzt sein.
      setAudioModeAsync({
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      }).catch(() => {});
      player.setActiveForLockScreen(true, {
        title: `${surahLabel} · Vers ${ayahsRef.current[i]?.numberInSurah ?? ''}`,
      });
    }
    player.play();
    if (shared) {
      const list = ayahsRef.current;
      let p = i - 1;
      while (p >= 0 && !list[p]?.audio) p--;
      let n = i + 1;
      while (n < list.length && !list[n]?.audio) n++;
      const hasPrev = p >= 0;
      const hasNext = n < list.length;
      shared.setNowPlaying({
        title: `${surahLabel} · Vers ${list[i]?.numberInSurah ?? ''}`,
        subtitle: surahLabel,
        href: nowPlayingHref,
        hasPrev,
        hasNext,
        onPrev: hasPrev ? () => playFrom(p) : undefined,
        onNext: hasNext ? () => playFrom(n) : undefined,
      });
    }
  }

  function pause() {
    player.pause();
  }

  function resume() {
    if (index !== null) player.play();
  }

  function stop() {
    player.pause();
    rangeRef.current = null;
    setIndex(null);
    shared?.setNowPlaying(null);
    if (Platform.OS !== 'web') player.setActiveForLockScreen(false);
  }

  /** Abschnitt [from..to] (0-basierte Indizes) abspielen, optional endlos.
   * `onComplete` s. rangeRef-Doku oben — nur bei natürlichem, nicht-loopendem
   * Ende des Abschnitts aufgerufen. */
  function playRange(from: number, to: number, loop: boolean, onComplete?: () => void) {
    const lo = Math.max(0, Math.min(from, to));
    const hi = Math.min(ayahsRef.current.length - 1, Math.max(from, to));
    playFrom(lo);
    rangeRef.current = { from: lo, to: hi, loop, onComplete };
  }

  return {
    currentIndex: index,
    playing: status.playing,
    // Für wortsynchrones Highlighting: aktuelle Wiedergabeposition in ms.
    positionMs: Math.round((status.currentTime ?? 0) * 1000),
    playFrom,
    playRange,
    pause,
    resume,
    stop,
  };
}

/**
 * Rezitatoren-Vergleich: derselbe Vers direkt hintereinander mit zwei
 * verschiedenen Rezitatoren (A → B, dann Stopp) — eigener, bewusst simpler
 * Player statt Wiederverwendung von useAyahPlayer, weil hier KEINE
 * Vers-Liste/Fortsetzungs-Logik gebraucht wird, nur exakt zwei Audio-URLs
 * nacheinander. Eigener lokaler expo-audio-Player (kein shared Player):
 * der Vergleich ist eine kurze Vorhör-Aktion im View-Sheet, kein
 * Hintergrund-Playback wie die normale Rezitation.
 */
export function useComparePlayer() {
  const player = useSsrSafeAudioPlayer(null);
  const status = useSsrSafeAudioPlayerStatus(player);
  const [stage, setStage] = useState<'idle' | 'a' | 'b'>('idle');
  const secondUrlRef = useRef<string | null>(null);

  // Stage-Wechsel (a→b→idle) als State-Ableitung während des Renders
  // (gleiches Muster wie syncCheckedIndex im Sure-Reader bzw.
  // lastSyncedNowPlaying in radio.tsx) statt setState im Effekt-Body, das
  // react-hooks/set-state-in-effect zu Recht ablehnt. Der eigentliche
  // Player-Seiteneffekt (Ref lesen + replace/play) läuft separat unten in
  // einem an `stage` gekoppelten Effekt — Refs dürfen NUR in Effekten/Handlern
  // gelesen werden, nicht im Render-Body (react-hooks/refs).
  const [syncedFinish, setSyncedFinish] = useState(status.didJustFinish);
  if (status.didJustFinish !== syncedFinish) {
    setSyncedFinish(status.didJustFinish);
    if (status.didJustFinish) {
      if (stage === 'a') setStage('b');
      else if (stage === 'b') setStage('idle');
    }
  }

  useEffect(() => {
    if (stage !== 'b' || !secondUrlRef.current) return;
    const url = secondUrlRef.current;
    secondUrlRef.current = null;
    player.replace(url);
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function playCompare(urlA: string, urlB: string) {
    secondUrlRef.current = urlB;
    setStage('a');
    player.replace(urlA);
    player.play();
  }

  function stop() {
    player.pause();
    secondUrlRef.current = null;
    setStage('idle');
  }

  return { playCompare, stop, stage, playing: status.playing };
}

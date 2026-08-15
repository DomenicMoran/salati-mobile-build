// SSR-sichere Wrapper um expo-audio-Hooks: Beim Static-Export (Node, kein
// window) wirft useAudioPlayer — jede Route, die ihn nutzt, bekam dadurch
// eine fehlgeschlagene Suspense-Boundary ins HTML gebacken und loggte auf
// JEDEM Client-Load React-Fehler #419 (nachgewiesen: exakt die 4 Routen mit
// useAudioPlayer hatten <!--$!-->-Marker, alle anderen nicht).
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
  type AudioPlayerOptions,
  type AudioSource,
  type AudioStatus,
} from 'expo-audio';

const NOOP = () => {};

// Deckt die in der App genutzte Player-API ab; Werte sind neutrale Defaults.
const DUMMY_PLAYER = {
  id: -1,
  playing: false,
  paused: true,
  muted: false,
  loop: false,
  volume: 1,
  playbackRate: 1,
  shouldCorrectPitch: false,
  currentTime: 0,
  duration: 0,
  isLoaded: false,
  isBuffering: false,
  isAudioSamplingSupported: false,
  play: NOOP,
  pause: NOOP,
  remove: NOOP,
  replace: NOOP,
  seekTo: () => Promise.resolve(),
  setPlaybackRate: NOOP,
  setAudioSamplingEnabled: NOOP,
  release: NOOP,
} as unknown as AudioPlayer;

const DUMMY_STATUS = {
  id: -1,
  currentTime: 0,
  status: 'idle',
  timeControlStatus: 'paused',
  reasonForWaitingToPlay: '',
  mute: false,
  duration: 0,
  playing: false,
  loop: false,
  didJustFinish: false,
  isBuffering: false,
  isLoaded: false,
  playbackRate: 1,
  shouldCorrectPitch: false,
  playbackState: '',
} as unknown as AudioStatus;

// `typeof window` ist über die Lebenszeit einer Umgebung konstant (Server
// ODER Browser) — die bedingten Hook-Aufrufe sind deshalb stabil (gängiges
// SSR-Muster); Hydration vergleicht nur DOM, nicht Server-Hook-Reihenfolge.
// `options` (z. B. { updateInterval }) wird 1:1 an expo-audio durchgereicht —
// der wortsynchrone Reader-Player (usePlayer.ts) braucht ein feineres Intervall
// als den 500ms-Default, weil einzelne Wort-Segmente nur 460-660ms lang sind.
export function useSsrSafeAudioPlayer(source: AudioSource = null, options?: AudioPlayerOptions): AudioPlayer {
  if (typeof window === 'undefined') return DUMMY_PLAYER;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAudioPlayer(source, options);
}

export function useSsrSafeAudioPlayerStatus(player: AudioPlayer): AudioStatus {
  if (typeof window === 'undefined') return DUMMY_STATUS;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAudioPlayerStatus(player);
}

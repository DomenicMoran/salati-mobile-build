import { render, screen } from '@testing-library/react-native';
import PlayerScreen from '@/app/audiobooks/[track]/[chapter]/index';
import VideoScreen from '@/app/audiobooks/[track]/[chapter]/video';

const mockAudio = { replace: jest.fn(), play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(), setActiveForLockScreen: jest.fn() };
const mockVideo = { replace: jest.fn(), play: jest.fn() };
const mockUseVideoPlayer = jest.fn((_source: string | null, _setup: unknown) => mockVideo);
let mockLocale = 'ar';
let mockError = false;
let mockEntries: {track: string; chapter_no: number; title: string; lang: string; audio_url: string; video_url?: string}[];

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ track: 'pflichtwissen', chapter: '1' }),
  useFocusEffect: (fn: () => void) => jest.requireActual('react').useEffect(fn, [fn]),
}));
jest.mock('@tanstack/react-query', () => ({useQuery: () => ({data: {entries: mockEntries}, isPending: false, isError: mockError})}));
jest.mock('@/features/quran/usePlayer', () => ({useSharedPlayer: () => ({player: mockAudio, status: {}, nowPlaying: null, setNowPlaying: jest.fn()})}));
jest.mock('expo-audio', () => ({setAudioModeAsync: jest.fn().mockResolvedValue(undefined)}));
jest.mock('expo-video', () => ({useVideoPlayer: (source: string | null, setup: unknown) => mockUseVideoPlayer(source, setup), VideoView: () => null}));
jest.mock('@/lib/i18n', () => ({useTranslation: () => ({t: (key: string) => key, locale: mockLocale})}));
jest.mock('@/hooks/use-resolved-scheme', () => ({useResolvedScheme: () => 'light'}));
jest.mock('@/components/ui/icon-symbol', () => ({IconSymbol: () => null}));
jest.mock('@/features/podcast/slider', () => ({Slider: () => null}));
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: jest.requireActual('react-native').View}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'ar';
  mockError = false;
  mockEntries = [{track:'pflichtwissen',chapter_no:1,title:'Chapter',lang:'ar',audio_url:'https://example.com/ar.mp3',video_url:'https://example.com/ar.mp4'}];
});

it('filters a blocked audio entry even if a stale index still contains it', async () => {
  await render(<PlayerScreen />);
  expect(screen.getByText('audiobooks.unavailable')).toBeTruthy();
  expect(mockAudio.replace).not.toHaveBeenCalled();
  expect(mockAudio.play).not.toHaveBeenCalled();
});

it('passes no source to the native video player for a blocked entry', async () => {
  await render(<VideoScreen />);
  expect(screen.getByText('audiobooks.unavailable')).toBeTruthy();
  expect(mockUseVideoPlayer.mock.calls[0][0]).toBeNull();
  expect(mockVideo.replace).not.toHaveBeenCalled();
  expect(mockVideo.play).not.toHaveBeenCalled();
});

it.each([PlayerScreen, VideoScreen])('keeps a real query failure distinct from unavailability', async (Screen) => {
  mockError = true;
  mockEntries = [];
  await render(<Screen />);
  expect(screen.getByText('common.error')).toBeTruthy();
  expect(screen.queryByText('audiobooks.unavailable')).toBeNull();
});

it('explains a missing video without playing an unrelated media source', async () => {
  mockLocale = 'de';
  mockEntries = [{track:'pflichtwissen',chapter_no:1,title:'Chapter',lang:'de',audio_url:'https://example.com/de.mp3'}];
  await render(<VideoScreen />);
  expect(screen.getByText('audiobooks.unavailable')).toBeTruthy();
  expect(mockUseVideoPlayer.mock.calls[0][0]).toBeNull();
});

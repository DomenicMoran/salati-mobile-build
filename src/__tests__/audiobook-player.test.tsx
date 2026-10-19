import { Linking } from 'react-native';
import { render, screen, act, fireEvent } from '@testing-library/react-native';
import PlayerScreen from '@/app/audiobooks/[track]/[chapter]/index';

const mockChapters = [1, 2, 3].map((n) => ({
  track: 'pflichtwissen', chapter_no: n, title: `Chapter ${n}`,
  book_pdf_url: 'https://example.com/book-en.pdf',
  audio_url: `https://example.com/${n}.mp3`, lang: 'en', duration_sec: 60,
}));
const mockPlayer = {
  replace: jest.fn(), play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(),
  setActiveForLockScreen: jest.fn(),
};
const mockSetNowPlaying = jest.fn();
let mockLoading = false;
let mockNowPlaying: unknown = null;

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ track: 'pflichtwissen', chapter: '2' }),
  useFocusEffect: (fn: () => void) => jest.requireActual('react').useEffect(fn, [fn]),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { entries: mockChapters }, isLoading: mockLoading, isPending: mockLoading, isError: false }),
}));
jest.mock('@/features/quran/usePlayer', () => ({
  useSharedPlayer: () => ({
    player: mockPlayer, status: { duration: 60, currentTime: 5, playing: true },
    nowPlaying: mockNowPlaying, setNowPlaying: mockSetNowPlaying,
  }),
}));
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/hooks/use-resolved-scheme', () => ({ useResolvedScheme: () => 'light' }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (s: string) => s, locale: 'en' }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/features/podcast/slider', () => ({ Slider: () => null }));
jest.mock('@/features/audiobooks/data', () => ({
  chaptersForTrack: (entries: unknown[]) => entries,
  fetchAudiobookIndex: jest.fn(), formatDuration: (n: number) => String(n),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual('react-native').View,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLoading = false;
  mockNowPlaying = null;
});

it('loads the selected chapter and announces both seek controls', async () => {
  await render(<PlayerScreen />);
  expect(mockPlayer.replace).toHaveBeenCalledWith('https://example.com/2.mp3');
  expect(screen.getByLabelText('audiobooks.back15')).toBeTruthy();
  expect(screen.getByLabelText('audiobooks.forward15')).toBeTruthy();
});

it('mini-player next uses the new chapter metadata, not a stale screen title', async () => {
  await render(<PlayerScreen />);
  const info = mockSetNowPlaying.mock.calls.at(-1)![0];
  await act(async () => info.onNext());
  expect(mockPlayer.replace).toHaveBeenLastCalledWith('https://example.com/3.mp3');
  expect(mockPlayer.setActiveForLockScreen).toHaveBeenLastCalledWith(true,
    expect.objectContaining({ title: '3. Chapter 3' }));
  expect(mockSetNowPlaying.mock.calls.at(-1)![0]).toEqual(expect.objectContaining({ hasNext: false }));
});

it('does not confuse another track with the same chapter title', async () => {
  mockNowPlaying = { title: '2. Chapter 2', href: {
    pathname: '/audiobooks/[track]/[chapter]', params: { track: 'grammatik-hoerbuch', chapter: '2' },
  } };
  await render(<PlayerScreen />);
  expect(mockPlayer.replace).toHaveBeenCalledWith('https://example.com/2.mp3');
});

it('keeps a back action visible while loading', async () => {
  mockLoading = true;
  await render(<PlayerScreen />);
  expect(screen.getByLabelText('a11y.back')).toBeTruthy();
});


it('opens the selected language book without interrupting listening', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<PlayerScreen />);
  await fireEvent.press(screen.getByRole('link', { name: 'audiobooks.bookOpen' }));
  expect(open).toHaveBeenCalledWith('https://example.com/book-en.pdf');
  expect(mockPlayer.pause).not.toHaveBeenCalled();
  open.mockRestore();
});

it('reports book launch failures instead of silently swallowing them', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No PDF handler'));
  await render(<PlayerScreen />);
  await fireEvent.press(screen.getByLabelText('audiobooks.bookOpen'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  open.mockRestore();
});

it('does not render a book action for an absent PDF', async () => {
  const previous = mockChapters[1].book_pdf_url;
  mockChapters[1].book_pdf_url = '  ';
  try {
    await render(<PlayerScreen />);
    expect(screen.queryByLabelText('audiobooks.bookOpen')).toBeNull();
  } finally {
    mockChapters[1].book_pdf_url = previous;
  }
});

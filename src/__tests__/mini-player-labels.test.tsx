import { fireEvent, render, screen } from '@testing-library/react-native';
import { MiniPlayer } from '@/components/mini-player';

const mockPlayer = {play: jest.fn(), pause: jest.fn()};
let mockPlaying = false;
jest.mock('expo-router', () => ({router: {push: jest.fn()}, usePathname: () => '/audiobooks'}));
jest.mock('@/features/quran/usePlayer', () => ({useSharedPlayer: () => ({
  player: mockPlayer, status: {playing: mockPlaying}, setNowPlaying: jest.fn(),
  nowPlaying: {title: 'Kapitel 1', subtitle: 'Pflichtwissen', href: '/audiobooks/pflichtwissen/1'},
})}));
jest.mock('@/hooks/use-resolved-scheme', () => ({useResolvedScheme: () => 'light'}));
jest.mock('@/lib/i18n', () => ({useTranslation: () => ({t: (key: string) => key})}));
jest.mock('@/components/ui/icon-symbol', () => ({IconSymbol: () => null}));
jest.mock('@/components/themed-text', () => ({ThemedText: jest.requireActual('react-native').Text}));
jest.mock('@/components/themed-view', () => ({ThemedView: jest.requireActual('react-native').View}));

beforeEach(() => {mockPlaying = false; jest.clearAllMocks();});
it('does not announce an audiobook as a surah', async () => {
  await render(<MiniPlayer />);
  expect(screen.queryByLabelText('quran.playSurah')).toBeNull();
  await fireEvent.press(screen.getByLabelText('podcast.play'));
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
});
it('announces and performs pause when playing', async () => {
  mockPlaying = true;
  await render(<MiniPlayer />);
  await fireEvent.press(screen.getByLabelText('podcast.pause'));
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
});

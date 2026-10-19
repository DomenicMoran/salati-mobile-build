import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SharedPlayerProvider, useSharedPlayer } from '@/features/quran/usePlayer';

const mockPlayer={pause:jest.fn(),setActiveForLockScreen:jest.fn()};
const mockEnded=jest.fn();
let mockFinished=false;
jest.mock('expo-audio',()=>({setAudioModeAsync:jest.fn()}));
jest.mock('@/lib/ssrSafeAudio',()=>({
  useSsrSafeAudioPlayer:()=>mockPlayer,
  useSsrSafeAudioPlayerStatus:()=>({didJustFinish:mockFinished}),
}));

function Consumer({bound=true}:{bound?:boolean}) {
  const {nowPlaying,setNowPlaying}=useSharedPlayer();
  return <>
    <Text>{nowPlaying?.title ?? 'No track'}</Text>
    <Pressable accessibilityLabel="Load" onPress={()=>setNowPlaying({title:'German chapter',contentLanguage:bound?'de':undefined,onEnded:mockEnded})} />
  </>;
}
beforeEach(()=>{jest.clearAllMocks();mockFinished=false;});
it('stops and removes an incompatible audiobook after navigation and language change',async()=>{
  const tree=await render(<SharedPlayerProvider contentLocale="de"><Consumer /></SharedPlayerProvider>);
  await fireEvent.press(screen.getByLabelText('Load'));
  expect(screen.getByText('German chapter')).toBeTruthy();
  mockFinished=true;
  await tree.rerender(<SharedPlayerProvider contentLocale="es"><Consumer /></SharedPlayerProvider>);
  expect(screen.getByText('No track')).toBeTruthy();
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(mockEnded).not.toHaveBeenCalled();
});
it('keeps matching-language audio available',async()=>{
  await render(<SharedPlayerProvider contentLocale="de"><Consumer /></SharedPlayerProvider>);
  await fireEvent.press(screen.getByLabelText('Load'));
  expect(screen.getByText('German chapter')).toBeTruthy();
  expect(mockPlayer.pause).not.toHaveBeenCalled();
});
it('does not stop language-independent Quran recitation',async()=>{
  const tree=await render(<SharedPlayerProvider contentLocale="de"><Consumer bound={false} /></SharedPlayerProvider>);
  await fireEvent.press(screen.getByLabelText('Load'));
  await tree.rerender(<SharedPlayerProvider contentLocale="es"><Consumer bound={false} /></SharedPlayerProvider>);
  expect(screen.getByText('German chapter')).toBeTruthy();
  expect(mockPlayer.pause).not.toHaveBeenCalled();
});

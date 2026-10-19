import { Stack } from 'expo-router';
import { AUDIOBOOK_HUB_TRACKS } from '@/features/audiobooks/tracks';

export function generateStaticParams() {
  return AUDIOBOOK_HUB_TRACKS.map(({ id }) => ({ track: id }));
}

export default function AudiobookTrackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[chapter]" />
    </Stack>
  );
}

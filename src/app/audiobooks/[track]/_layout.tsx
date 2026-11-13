import { Stack } from 'expo-router';

import fallbackIndex from '@/features/audiobooks/index.fallback.json';

export function generateStaticParams() {
  const tracks = new Set(fallbackIndex.entries.map((entry) => entry.track));
  return [...tracks].map((track) => ({ track }));
}

export default function AudiobookTrackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[chapter]" />
    </Stack>
  );
}

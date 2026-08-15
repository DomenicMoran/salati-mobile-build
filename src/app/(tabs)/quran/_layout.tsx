import { Stack } from 'expo-router';

export default function QuranLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[surah]" />
      <Stack.Screen name="bookmarks" />
      <Stack.Screen name="search" />
    </Stack>
  );
}

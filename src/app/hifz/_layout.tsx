import { Stack } from 'expo-router';

export default function HifzLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[surah]" />
      <Stack.Screen name="gap-test" />
      <Stack.Screen name="recite-surah" />
    </Stack>
  );
}

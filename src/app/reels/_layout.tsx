import { Stack } from 'expo-router';

// Reels-Feed ist ein Vollbild-Video-Erlebnis (dunkel, randlos) — kein Header.
export default function ReelsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

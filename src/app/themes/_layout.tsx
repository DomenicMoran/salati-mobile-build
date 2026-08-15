import { Stack } from 'expo-router';

export default function ThemesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[topic]" />
      <Stack.Screen name="journeys/index" />
      <Stack.Screen name="journeys/[id]" />
    </Stack>
  );
}

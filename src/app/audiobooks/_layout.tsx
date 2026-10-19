import { Stack } from 'expo-router';

export default function AudiobooksLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="books" />
      <Stack.Screen name="[track]" />
    </Stack>
  );
}

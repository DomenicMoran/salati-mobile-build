import { Stack } from 'expo-router';

export default function HadithLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[collection]/index" />
      <Stack.Screen name="[collection]/[number]" />
    </Stack>
  );
}

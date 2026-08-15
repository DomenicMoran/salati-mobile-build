import { Stack } from 'expo-router';

export default function StudyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="review" />
      <Stack.Screen name="weak" />
      <Stack.Screen name="weekly-review" />
      <Stack.Screen name="reorder" />
      <Stack.Screen name="[course]/index" />
      <Stack.Screen name="[course]/[lesson]" />
      <Stack.Screen name="[course]/exam" />
    </Stack>
  );
}

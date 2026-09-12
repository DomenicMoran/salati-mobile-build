import { Stack } from 'expo-router';

export default function AnalyseUebungLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="uebung" />
    </Stack>
  );
}

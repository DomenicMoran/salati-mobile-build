// Eigenes Stack für den Lexikon-Bereich, analog zu quran/_layout.tsx bzw.
// hifz/_layout.tsx: der Root-Stack (app/_layout.tsx) registriert nur das
// Segment "lexikon" — Unterrouten (Wurzel- und Begriff-Detailansicht)
// müssen hier zusätzlich benannt werden, sonst kennt der Router sie nicht.
import { Stack } from 'expo-router';

export default function LexikonLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="wurzel/[wurzel]" />
      <Stack.Screen name="begriff/[bereich]/[id]" />
      <Stack.Screen name="verbtyp/[typ]" />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { usePageTitle } from '@/lib/use-page-title';

/** Muss mit `patch-ssr-page-titles.mjs` / `+html.tsx` META übereinstimmen. */
export const WEB_HOME_DOCUMENT_TITLE = 'Salati - Dein Begleiter für Gebet, Koran und Wissen';

function formatDocumentTitle(title: string): string {
  return title.includes('Salati') ? title : `${title} – Salati`;
}

/**
 * Web-Static-Export: kein react-helmet / `Stack.Screen`-Titel — SSR-Titel aus
 * `patch-ssr-page-titles.mjs`; nach Hydration synchronisiert `usePageTitle`.
 */
export function DocumentHeadTitle({ title }: { title: string }) {
  usePageTitle(title);
  if (Platform.OS === 'web') return null;
  return <Stack.Screen options={{ title: formatDocumentTitle(title) }} />;
}

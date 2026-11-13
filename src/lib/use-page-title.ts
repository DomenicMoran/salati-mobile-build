import { useEffect } from 'react';
import { Platform } from 'react-native';

const SITE = 'Salati';

/**
 * Hält `document.title` auf Web nach der Hydration — die statische SSR-Vorlage
 * behält sonst einen generischen Titel, Lighthouse meldet leeres Title-Element.
 */
function syncWebDocumentTitle(full: string): void {
  document.title = full;
  document.querySelectorAll('title[data-rh="true"]').forEach((node) => {
    if (!node.textContent?.trim()) node.remove();
  });
  const titles = [...document.querySelectorAll('head title')];
  const keeper = titles.find((n) => n.textContent?.trim()) ?? titles[0];
  if (keeper) {
    keeper.textContent = full;
    for (const node of titles) {
      if (node !== keeper) node.remove();
    }
  }
  const og = document.querySelector('meta[property="og:title"]');
  if (og) og.setAttribute('content', full);
}

export function usePageTitle(title: string | undefined): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const trimmed = title?.trim();
    if (!trimmed) return;
    const full = trimmed.includes('Salati') ? trimmed : `${trimmed} – ${SITE}`;
    syncWebDocumentTitle(full);
  }, [title]);
}

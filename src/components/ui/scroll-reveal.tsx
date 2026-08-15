// Scroll-getriggertes Einblenden für die Web-Landingpage: AnimatedListItem
// animiert beim MOUNT, aber RN-Web-ScrollViews rendern alle Kinder sofort
// (keine Virtualisierung) - auf einer langen Landingpage sind alle
// Mount-Animationen längst vorbei, bevor der Nutzer dorthin scrollt
// (User-Feedback: "Animationen fehlen beim Scrollen"). Native Screens sind
// meist Ein-Viewport-Listen, wo Mount-Animation weiter korrekt ist - dieser
// Wrapper ist bewusst nur für lange Web-Seiten (Landingpage) gedacht.
import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

export function ScrollReveal({
  children,
  style,
  delay = 0,
}: PropsWithChildren<{ style?: ViewStyle | ViewStyle[]; delay?: number }>) {
  const ref = useRef<View>(null);
  // Nativ + SSR: sofort sichtbar (kein IntersectionObserver verfügbar/nötig).
  const [visible, setVisible] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' || visible) return;
    // "Bewegung reduzieren" des Systems respektieren (Audit 2026-07-19 E4) -
    // Inhalt sofort zeigen statt einzugleiten (rAF: kein Sync-setState im
    // Effect-Body, s. react-hooks/set-state-in-effect).
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      ref={ref}
      style={[
        style,
        Platform.OS === 'web' &&
          ({
            opacity: visible ? 1 : 0,
            transform: [{ translateY: visible ? 0 : 20 }],
            transitionProperty: 'opacity, transform',
            transitionDuration: '520ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            transitionDelay: `${delay}ms`,
          } as ViewStyle),
      ]}>
      {children}
    </View>
  );
}

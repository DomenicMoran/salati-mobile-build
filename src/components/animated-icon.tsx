import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Brand } from '@/constants/theme';
import { useSettings } from '@/features/settings/store';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

/**
 * Notausgang: so lange darf der Splash hoechstens auf die gespeicherten
 * Einstellungen warten. Danach wird abgebaut, auch wenn der Speicher nicht
 * geantwortet hat — lieber der Vorgabestand als ein haengender Startbildschirm.
 *
 * 2500 ms liegen bewusst deutlich ueber der 1500-ms-Obergrenze, die
 * `preloadLocale` (lib/translate.ts) fuer die Sprachdatei ansetzt: der normale
 * Weg laeuft damit nie in den Notausgang. Gemessen wird er nie erreicht — der
 * Speicher antwortet im Release-Bau in ~20 ms.
 */
export const SPLASH_WARTET_HOECHSTENS_MS = 2500;

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);
  const [layoutSteht, setLayoutSteht] = useState(false);
  const [notausgang, setNotausgang] = useState(false);
  // Splash-Übergang läuft bei JEDEM App-Start — die meistgesehene Animation
  // der App. Bei "Bewegung reduzieren" direkt ausblenden statt Skalieren/
  // Rotieren abzuspielen.
  const reducedMotion = useReducedMotion();
  // Der Splash bleibt stehen, bis die gespeicherten Einstellungen gelesen sind.
  // `loaded` wird erst wahr, wenn AUCH die Sprachdatei geholt ist (store.tsx
  // wartet vor dem Anwenden auf preloadLocale) — genau die beiden Dinge, die
  // den ersten Frame sonst in der falschen Sprache und Leserichtung zeigen.
  //
  // Warum hier und nicht am Rendern des Baums: der Baum darf ruhig schon
  // aufbauen, er ist vom Overlay vollstaendig verdeckt (zIndex 1000, ganze
  // Flaeche, deckend). So kostet das Warten keine Startzeit, und es kann nie
  // ein weisser Bildschirm entstehen — sichtbar ist immer der Splash.
  const { loaded } = useSettings();

  // Notausgang, falls der Speicher nicht antwortet (siehe Konstante oben).
  useEffect(() => {
    if (loaded) return;
    const uhr = setTimeout(() => setNotausgang(true), SPLASH_WARTET_HOECHSTENS_MS);
    return () => clearTimeout(uhr);
  }, [loaded]);

  // Erst wenn der Splash steht UND die Einstellungen da sind (oder der
  // Notausgang gezogen hat), wird das native Splash-Bild abgeraeumt und die
  // Ausblende-Animation gestartet.
  const frei = loaded || notausgang;
  useEffect(() => {
    if (!layoutSteht || !frei || animate) return;
    // `mounted`-Wache: hideAsync() ist bereits unterwegs, wenn dieser Screen
    // verschwindet (Notausgang gezogen, aber die Zeit bis zum Aufloesen war
    // noch nicht um) — ohne die Wache wuerde `setAnimate` danach noch auf der
    // abgebauten Komponente aufgerufen (Review-Fund, s. animated-icon.test.tsx).
    let mounted = true;
    SplashScreen.hideAsync().finally(() => {
      if (mounted) setAnimate(true);
    });
    return () => {
      mounted = false;
    };
  }, [layoutSteht, frei, animate]);

  if (!visible) return null;

  // Kein Skalieren/Rotieren abspielen — direkt fertig, kein separater
  // Zustandsübergang/Effekt nötig (das Overlay rendert einfach nichts mehr).
  if (animate && reducedMotion) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  const image = <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />;

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      testID="splash-overlay"
      onLayout={() => setLayoutSteht(true)}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(160deg, ${Brand.gold}, ${Brand.ink})`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Brand.paper,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});

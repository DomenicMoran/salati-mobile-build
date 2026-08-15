// Minimal-Mock fuer react-native-reanimated (Version 4).
//
// WARUM NICHT der mitgelieferte Mock: `react-native-reanimated/mock` importiert
// intern die echte Bibliothek, die wiederum `react-native-worklets` laedt —
// und das wirft ohne JSI-Runtime sofort
// ("Cannot read properties of undefined (reading 'loadUnpackers')").
// Damit scheiterte JEDER Screen-Render-Test schon am Import von
// components/ui/animated-list-item.tsx.
//
// Der Mock deckt genau die neun Symbole ab, die `src/` tatsaechlich importiert
// (Grep ueber src: Animated, Easing, FadeInDown, Keyframe, ZoomIn,
// useAnimatedStyle, useReducedMotion, useSharedValue, withTiming). Animationen
// werden zu No-Ops: fuer die geprueften Zustaende (welcher Inhalt ist sichtbar,
// gibt es einen Ausgang) tragen sie keine Information. Kommt ein weiteres
// Symbol dazu, faellt das sofort als `undefined is not a function` auf.
const React = require('react');
const { View, Text, ScrollView, Image } = require('react-native');

/** Entering/Exiting-Animationen sind verkettbare Builder — jede Methode gibt
 *  wieder den Builder zurueck, damit `FadeInDown.delay(80).duration(300)` in
 *  den Screens unveraendert funktioniert. */
function animationBuilder() {
  const builder = {};
  const chain = () => builder;
  for (const m of [
    'delay',
    'duration',
    'springify',
    'damping',
    'stiffness',
    'mass',
    'easing',
    'withInitialValues',
    'randomDelay',
    'build',
    'reduceMotion',
  ]) {
    builder[m] = chain;
  }
  return builder;
}

const FadeInDown = animationBuilder();
const ZoomIn = animationBuilder();

class Keyframe {
  constructor() {
    return animationBuilder();
  }
}

function stripAnimationProps(props) {
  const { entering, exiting, layout, ...rest } = props;
  return rest;
}

function animated(Component) {
  const Wrapped = React.forwardRef((props, ref) =>
    React.createElement(Component, { ...stripAnimationProps(props), ref }),
  );
  Wrapped.displayName = `Animated(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}

const Animated = {
  View: animated(View),
  Text: animated(Text),
  ScrollView: animated(ScrollView),
  Image: animated(Image),
  createAnimatedComponent: animated,
};

const Easing = {
  linear: (t) => t,
  ease: (t) => t,
  quad: (t) => t,
  cubic: (t) => t,
  bezier: () => (t) => t,
  in: (fn) => fn,
  out: (fn) => fn,
  inOut: (fn) => fn,
};

module.exports = {
  __esModule: true,
  default: Animated,
  Easing,
  FadeInDown,
  ZoomIn,
  Keyframe,
  // Kein echter SharedValue: ein schlichtes, veraenderbares Objekt genuegt,
  // weil die Tests nur den gerenderten Inhalt pruefen.
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (fn) => {
    try {
      return fn();
    } catch {
      return {};
    }
  },
  withTiming: (toValue) => toValue,
  withSpring: (toValue) => toValue,
  useReducedMotion: () => true,
};

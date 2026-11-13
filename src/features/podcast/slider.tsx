// Abhaengigkeitsfreier horizontaler Slider (kein @react-native-community/slider
// im Projekt). Genutzt fuer die Wiedergabe-Position (Scrubber) und die
// Lautstaerke. Tap-to-seek + Drag ueber das RN-Responder-System; funktioniert
// nativ und im Web-Export (RN-Web mappt Responder auf Maus-/Touch-Events).
import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';

export interface SliderProps {
  /** aktueller Wert 0..1 */
  value: number;
  /** waehrend des Ziehens (Live-Vorschau) */
  onChange?: (value: number) => void;
  /** beim Loslassen / Tap (endgueltig, z. B. seekTo) */
  onCommit?: (value: number) => void;
  height?: number;
  accessibilityLabel?: string;
}

export function Slider({ value, onChange, onCommit, height = 6, accessibilityLabel }: SliderProps) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const widthRef = useRef(1);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const shown = dragging ? dragValue : Math.max(0, Math.min(1, value || 0));

  function ratioFromEvent(e: GestureResponderEvent): number {
    const x = e.nativeEvent.locationX;
    return Math.max(0, Math.min(1, x / widthRef.current));
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100) }}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width || 1;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        setDragging(true);
        const r = ratioFromEvent(e);
        setDragValue(r);
        onChange?.(r);
      }}
      onResponderMove={(e) => {
        const r = ratioFromEvent(e);
        setDragValue(r);
        onChange?.(r);
      }}
      onResponderRelease={(e) => {
        const r = ratioFromEvent(e);
        setDragging(false);
        onCommit?.(r);
      }}
      onResponderTerminate={() => setDragging(false)}
      // grosszuegige Trefferflaeche um die schmale Spur
      style={styles.hitArea}>
      <View style={[styles.track, { height, backgroundColor: colors.backgroundSelected }]}>
        <View
          style={[styles.fill, { width: `${shown * 100}%`, height, backgroundColor: colors.accent }]}
        />
        <View
          style={[
            styles.thumb,
            {
              left: `${shown * 100}%`,
              backgroundColor: colors.accent,
              borderColor: colors.background,
              opacity: dragging ? 1 : 0.95,
              transform: [{ translateX: -8 }, { scale: dragging ? 1.2 : 1 }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: { paddingVertical: 12, justifyContent: 'center' },
  track: { width: '100%', borderRadius: 999, overflow: 'visible' },
  fill: { borderRadius: 999 },
  thumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
});

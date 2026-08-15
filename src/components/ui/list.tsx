/**
 * Zeilen-Grammatik für gruppierte Listen (Einstellungen und alle Screens mit
 * denselben Mustern).
 *
 * Befund des Design-Audits 2026-07-29: Info-, Aktions-, Eingabe- und
 * Auswahl-Zeilen sahen identisch aus, Aktionen trugen ein Chevron (das in iOS
 * „öffnet einen Bildschirm" bedeutet), und die Auswahl war dreifach kodiert
 * (Farbe + Fettung + Häkchen). Dieses Modul legt die Zeilentypen EINMAL fest:
 *
 *   ValueRow   Label links, Wert rechts — reine Anzeige, nicht tippbar
 *   NavRow     Label (+ optionaler Wert) + Chevron — öffnet einen Bildschirm
 *   ActionRow  Label in Tint-Farbe, KEIN Chevron — führt in der Zeile aus
 *   SelectRow  Label in normaler Schrift + Häkchen in Tint — Auswahl
 *   InputRow   Eingabefeld mit führendem Icon — als Eingabe erkennbar
 *   SwitchRow  siehe components/settings/switch-row.tsx
 *
 * Dazu die Behälter: ListCard (Kartenfläche + eingerückte Hairline-Trenner),
 * ListSection (grauer Sektions-Kopf + Karte + optionaler Fußnotentext) und
 * ListGroupHeading (die EINE gemischtschriftliche Ebene darüber).
 *
 * Leistung: keine Schatten, kein Blur, keine Animation, kein zusätzlicher
 * Context — nur Flex-Views und ein hairline-hoher Trenner je Zeilenfuge.
 * RTL: jede Zeile spiegelt via row-reverse + textAlign, der Chevron kommt aus
 * DisclosureChevron (dreht sich selbst).
 */
import { Children, Fragment, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { DisclosureChevron } from '@/components/ui/disclosure-chevron';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

/** Ein Aufruf statt zweier Hooks pro Zeile (Theme + Leserichtung). */
function useRowContext() {
  const theme = useTheme();
  const { locale } = useTranslation();
  return { theme, rtl: isRtlLocale(locale) };
}

// ─────────────────────────────────────────────────────────── Behälter

/**
 * Die EINE gemischtschriftliche Überschriften-Ebene über den Sektionen.
 * Bewusst deutlich größer und in Gemischtschrift, damit sie nicht mit den
 * kleinen grauen Sektions-Labels verwechselt werden kann.
 */
export function ListGroupHeading({ title }: { title: string }) {
  const { rtl } = useRowContext();
  return (
    <ThemedText
      type="heading"
      accessibilityRole="header"
      style={[styles.groupHeading, rtl && styles.textRtl]}>
      {title}
    </ThemedText>
  );
}

/** Kartenfläche einer Gruppe: setzt die eingerückten Trenner NUR zwischen die
 * Zeilen (nicht unter die letzte) — iOS-„insetGrouped". */
export function ListCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme, rtl } = useRowContext();
  const items = Children.toArray(children);
  return (
    <View style={[styles.card, { backgroundColor: theme.groupedCard }, style]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {child}
          {i < items.length - 1 ? (
            <View
              style={[
                styles.divider,
                { backgroundColor: theme.separator },
                rtl && styles.dividerRtl,
              ]}
            />
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Vollständige Sektion: grauer Kopf (Gemischtschrift, klein), Karte, optionale
 * Fußnote. Erklärtexte gehören nach Apple-Muster UNTER die Karte (footer) und
 * nicht als graue Pseudo-Zeile hinein.
 */
export function ListSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const { rtl } = useRowContext();
  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="header"
          style={[styles.sectionTitle, rtl && styles.textRtl]}>
          {title}
        </ThemedText>
      ) : null}
      <ListCard>{children}</ListCard>
      {footer ? <ListFooter text={footer} /> : null}
    </View>
  );
}

/** Erklärtext unter einer Karte (iOS-Sektions-Fußnote). */
export function ListFooter({ text }: { text: string }) {
  const { rtl } = useRowContext();
  return (
    <ThemedText type="small" themeColor="textSecondary" style={[styles.footer, rtl && styles.textRtl]}>
      {text}
    </ThemedText>
  );
}

/** Erklärtext INNERHALB der Karte — nur für Hinweise, die sich auf die direkt
 * folgenden Zeilen beziehen (z. B. Lizenz-Nennung beim Adhan). */
export function ListNote({ text }: { text: string }) {
  const { rtl } = useRowContext();
  return (
    <ThemedText type="small" themeColor="textSecondary" style={[styles.note, rtl && styles.textRtl]}>
      {text}
    </ThemedText>
  );
}

// ─────────────────────────────────────────────────────────── Zeilentypen

/** Wertzeile: Label links, Wert rechts. Reine Anzeige — kein Tap, kein Chevron. */
export function ValueRow({ label, value }: { label: string; value: string }) {
  const { rtl } = useRowContext();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.row, rtl && styles.rowRtl]}>
      <ThemedText type="default" style={[styles.rowLabel, rtl && styles.textRtl]}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Navigationszeile: öffnet einen Bildschirm — und NUR dann steht hier ein
 * Chevron. Optionaler Wert rechts vor dem Chevron (iOS-Muster). */
export function NavRow({
  label,
  value,
  hint,
  onPress,
  disabled,
}: {
  label: string;
  value?: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme, rtl } = useRowContext();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={[label, value, hint].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        (pressed || disabled) && styles.pressed,
      ]}>
      <View style={[styles.row, rtl && styles.rowRtl]}>
        <View style={styles.rowMain}>
          <ThemedText type="default" style={rtl && styles.textRtl}>
            {label}
          </ThemedText>
          {hint ? (
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
              {hint}
            </ThemedText>
          ) : null}
        </View>
        {value ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.rowValue}>
            {value}
          </ThemedText>
        ) : null}
        <DisclosureChevron size={16} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

/** Aktionszeile: führt die Aktion IN der Zeile aus. Tint-Label, kein Chevron
 * (das würde „öffnet einen Bildschirm" versprechen). Rechts optional ein
 * Fortschrittsdreher oder ein Status-Icon. */
export function ActionRow({
  label,
  hint,
  onPress,
  busy,
  disabled,
  trailingIcon,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  trailingIcon?: IconName;
}) {
  const { theme, rtl } = useRowContext();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      accessibilityLabel={[label, hint].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        (pressed || disabled) && styles.pressed,
      ]}>
      <View style={[styles.row, rtl && styles.rowRtl]}>
        <View style={styles.rowMain}>
          <ThemedText type="default" themeColor="accent" style={rtl && styles.textRtl}>
            {label}
          </ThemedText>
          {hint ? (
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
              {hint}
            </ThemedText>
          ) : null}
        </View>
        {busy ? <ThemedActivityIndicator size="small" /> : null}
        {!busy && trailingIcon ? <IconSymbol name={trailingIcon} size={18} color={theme.accent} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Auswahlzeile: EIN Signal für „gewählt" — das Häkchen in Tint-Farbe. Der Text
 * bleibt in normaler Stärke und normaler Farbe (Apple-Muster; vorher war die
 * Auswahl dreifach kodiert: gold + fett + Häkchen).
 */
export function SelectRow({
  label,
  description,
  selected,
  onPress,
  leading,
}: {
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  /** Optionales Element ganz vorn (z. B. Farbmuster der App-Icon-Auswahl). */
  leading?: ReactNode;
}) {
  const { theme, rtl } = useRowContext();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={[label, description].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        Platform.OS === 'web' ? styles.pressableWeb : undefined,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.row, rtl && styles.rowRtl]}>
        {leading}
        <View style={styles.rowMain}>
          <ThemedText type="default" style={rtl && styles.textRtl}>
            {label}
          </ThemedText>
          {description ? (
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
              {description}
            </ThemedText>
          ) : null}
        </View>
        {selected ? <IconSymbol name="checkmark" size={18} color={theme.accent} /> : null}
      </View>
    </Pressable>
  );
}

/** Eingabezeile: als Eingabe erkennbar durch führendes Icon + Caret, auf
 * exakt denselben Seiteneinzügen wie alle anderen Zeilen der Karte. */
export function InputRow({
  icon,
  placeholder,
  value,
  onChangeText,
  accessibilityLabel,
  ...rest
}: {
  icon: IconName;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel?: string;
} & Omit<TextInputProps, 'style' | 'value' | 'onChangeText' | 'placeholder'>) {
  const { theme, rtl } = useRowContext();
  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <IconSymbol name={icon} size={17} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[styles.input, rtl && styles.textRtl, { color: theme.text }]}
        {...rest}
      />
    </View>
  );
}

/** Zeile mit frei gestaltetem Inhalt (Chip-Reihen, Fortschritt …) — trägt nur
 * die einheitlichen Seiteneinzüge, damit nichts aus der Flucht fällt. */
export function ListRowFrame({ children }: { children: ReactNode }) {
  return <View style={styles.frame}>{children}</View>;
}

/** Gemeinsame Maße, damit Sonderfälle in den Screens dieselbe Flucht treffen. */
export const listMetrics = {
  inset: Spacing.three,
  minRowHeight: 44,
} as const;

const styles = StyleSheet.create({
  groupHeading: {
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  section: { marginBottom: Spacing.four },
  // Der Sektions-Kopf sitzt auf dem Textzeilen-Einzug der Karte darunter
  // (Kartenkante + Zeilen-Padding), damit Kopf und Zeilenbeschriftung fluchten.
  sectionTitle: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  note: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  dividerRtl: { marginLeft: 0, marginRight: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: listMetrics.minRowHeight,
    paddingVertical: Spacing.two + 3,
    paddingHorizontal: Spacing.three,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  // Label-Spalte: `flex: 1` bedeutet flexBasis 0 — die Spalte bekam nur den
  // REST hinter dem Wert. Ein langer Wert („Diyanet İşleri Başkanlığı") drückte
  // sie damit unter die Breite eines einzelnen langen Wortes, und Android
  // trennte mitten im Wort: „Berechnungsmetho/de" (gemeldet 2026-07-29).
  //
  // Jetzt ist die Ausgangsbreite beider Spalten ihr eigener Textbedarf
  // (flexBasis auto) und der WERT gibt beim Platzmangel dreimal so schnell nach
  // wie das Label. Damit kürzt sich der Wert (numberOfLines={1} → Ellipse) —
  // das iOS-Muster — statt das Label zu zerlegen. Reicht es trotzdem nicht,
  // bricht das Label weiterhin um, statt aus der Karte zu laufen.
  rowMain: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', gap: 2 },
  rowLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  rowValue: { flexShrink: 3, flexBasis: 'auto' },
  frame: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  textRtl: { textAlign: 'right' },
  pressed: { opacity: 0.5 },
  pressableWeb: { cursor: 'pointer' },
});

// Satzstruktur-Ansicht: macht sichtbar, welches Wort eines Verses an welchem
// anderen Wort hängt und mit welcher syntaktischen Rolle (Dependenzgrammatik,
// QAC-Iʿrab-Daten). Ergänzt die bereits fertige Wortebene (WortAnalyseSheet,
// EIN Wort im Detail) um die SATZEBENE — Auftrag: "jedes Fragment, jeder
// Satz, jedes Wort muss analysierbar sein".
//
// Darstellung: EINE Einrückungsliste in Lesereihenfolge (Baumaufbau in
// ./satzstrukturModel.ts), kein freischwebender Graph. Begründung gegen eine
// zusätzliche Bogen-/SVG-Darstellung (Abhängigkeitsbögen über der Verszeile,
// wie z. B. displaCy): auf Handybreite wäre sie nur für sehr kurze Verse
// lesbar. Sobald Bezüge über mehrere Wörter hinweg reichen (im Korpus die
// Regel, nicht die Ausnahme — arabische Wortstellung ist frei, Bezugswörter
// liegen oft mehrere Positionen entfernt) und der Text durch RTL-Umschrift/
// unterschiedliche Wortlängen läuft, kreuzen sich die Bögen und werden auf
// einem ~350dp-Screen nicht mehr unterscheidbar. Bei langen Versen (2:282,
// über 100 Wörter) wäre eine Bogendarstellung ohnehin nur mit exzessivem
// horizontalem Scrollen benutzbar, während genau DORT die Einrückungsliste
// (mit gekapptem Einzug + weiterhin vollem Text je Zeile, siehe unten) robust
// bleibt. Eine gut lesbare Darstellung statt zwei halbgarer.
//
// Lange Verse: kein rekursiver Baum aus verschachtelten Komponenten (native
// Views mehrere Dutzend Ebenen tief wäre selbst Layout-technisch riskant),
// sondern EIN abgeflachtes `.map()` über die vorgeordnete Knotenliste
// (abflachen() in satzstrukturModel.ts) — jede Zeile liegt auf derselben
// Verschachtelungsebene, nur der Einzug (paddingStart) unterscheidet die
// Tiefe. Der visuelle Einzug ist zusätzlich gedeckelt (MAX_EINZUG_TIEFE):
// jenseits einiger Ebenen frisst reine Einrückung auf einem Telefon den
// gesamten Zeilenplatz. Die tatsächliche Eltern-Beziehung geht dabei NICHT
// verloren — jede Zeile nennt ihr Bezugswort zusätzlich als Text
// ("Bezogen auf: …", dieselbe Formulierung wie im Wort-Sheet), unabhängig
// vom Einzugslimit.
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRtl } from '@/hooks/use-rtl';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';

import { useVerseMorphologie } from '../morphologieHooks';
import type { MorphWord } from '../morphologieTypen';
import { useQuranFont } from '../useQuranFont';
import { Aufklappbar } from './Aufklappbar';
import { Fachbegriff } from './Fachbegriff';
import { abflachen, baueSatzbaum } from './satzstrukturModel';
import { relationAnzeige } from './wortAnalyseModel';

// Jenseits dieser Tiefe wächst der Einzug nicht mehr weiter (siehe
// Kopf-Kommentar) — verhindert, dass eine lange Kopf-Kette (theoretisch bis
// zur Wortanzahl des Verses tief) den gesamten Zeileninhalt aus dem
// sichtbaren Bereich schiebt.
const MAX_EINZUG_TIEFE = 6;
const EINZUG_SCHRITT = Spacing.three;

export interface SatzstrukturProps {
  surah: number;
  ayah: number;
  /** Steuert zugleich, ob die Morphologiedaten geladen werden — kein
   * Netzabruf, solange der Aufrufer diese Ansicht nicht anzeigt (gleiches
   * `enabled`-Muster wie WortAnalyseSheet/useVerseMorphologie). */
  enabled: boolean;
  /** 1-basierte Wortposition angetippt — der Aufrufer entscheidet, was
   * passiert (z. B. das bestehende Wort-Sheet öffnen). */
  onWortAuswahl: (position: number) => void;
}

/** Eine Zeile der Einrückungsliste: Wort, Rolle (Fachbegriff + arabischer
 * Terminus) und Bezugswort bzw. ehrlicher Hinweis, warum keins bekannt ist. */
function SatzstrukturZeile({
  word,
  tiefe,
  verseWords,
  onPress,
}: {
  word: MorphWord;
  tiefe: number;
  verseWords: MorphWord[];
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const rtl = useRtl();
  const theme = useTheme();
  const quranFont = useQuranFont();
  const relation = word.syntax ? relationAnzeige(word, verseWords, t) : null;
  const einzug = Math.min(tiefe, MAX_EINZUG_TIEFE) * EINZUG_SCHRITT;
  // Wurzelknoten dieser Baumdarstellung (tiefe === 0): ein evtl. vorhandener
  // Kopf-Wert ist entweder ein Selbstbezug oder eine gekappte Zyklus-Kante
  // (siehe satzstrukturModel.ts) — in BEIDEN Fällen wäre "Bezogen auf: …"
  // sachlich falsch bzw. willkürlich, deshalb hier bewusst nichts anzeigen.
  // Nur der ECHTE Fall "head ist null" (elidiert/anderer Vers) bekommt den
  // ehrlichen Hinweistext — exakt wie im Wort-Sheet.
  const zeigeHeadHinweis = tiefe === 0 && relation != null && word.syntax?.head == null;
  const zeigeHeadBezug = tiefe > 0 && relation != null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${word.text}${relation ? `: ${relation.name}` : ''}`}
      style={({ pressed }) => [
        styles.zeile,
        rtl ? { paddingEnd: einzug } : { paddingStart: einzug },
        { borderColor: theme.separator },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.kopfReihe, rtl && styles.kopfReiheRtl]}>
        <ThemedText style={[styles.arabic, quranFont.style]}>{quranFont.text(word.text)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {word.position}
        </ThemedText>
      </View>
      {relation ? (
        <ThemedText type="smallBold" style={rtl && styles.textRtl}>
          <Fachbegriff text={relation.name} ar={relation.ar} />
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
          {t('quran.wortAnalyse.satzrolleNoData')}
        </ThemedText>
      )}
      {zeigeHeadBezug && (
        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.textRtl}>
          {t('quran.wortAnalyse.satzrolleHeadLabel').replace(
            '{wort}',
            relation!.headText ?? String(relation!.head),
          )}
        </ThemedText>
      )}
      {zeigeHeadHinweis && (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.hinweis, rtl && styles.textRtl]}>
          {t('quran.wortAnalyse.satzrolleHeadNone')}
        </ThemedText>
      )}
    </Pressable>
  );
}

/**
 * Satzstruktur-Ansicht für EINEN Vers: lädt dessen Morphologie selbst
 * (useVerseMorphologie, `enabled`-gesteuert) und stellt die
 * Wort-Abhängigkeiten als Einrückungsliste dar, unter einer aufklappbaren
 * Überschrift (Standard zugeklappt — Tiefe, nicht die Kernaussage der
 * Vers-Karte, siehe [surah].tsx). Rendert nichts, solange `enabled` false ist
 * und nie geladen wurde.
 */
export function Satzstruktur({ surah, ayah, enabled, onWortAuswahl }: SatzstrukturProps) {
  const { t } = useTranslation();
  const { verse, isLoading, isError } = useVerseMorphologie(surah, ayah, enabled);

  if (!enabled && verse === undefined) return null;

  // Geladen, aber kein Treffer für diesen Vers (sollte bei einer korrekten
  // Fundstelle nicht vorkommen) — defensiv ein ehrlicher Hinweis statt eines
  // stillen Leerzustands, gleiches Muster wie morphOhneTreffer in
  // WortAnalyseSheet.tsx.
  const ohneTreffer = enabled && !isLoading && !isError && verse === undefined;
  const zeilen = verse ? abflachen(baueSatzbaum(verse)) : [];

  return (
    <Aufklappbar titel={t('quran.satzstruktur.title')}>
      {isLoading && (
        <View style={styles.center}>
          <ThemedActivityIndicator />
        </View>
      )}
      {(isError || ohneTreffer) && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hinweis}>
          {t('quran.wortAnalyse.morphologyNoData')}
        </ThemedText>
      )}
      {!isLoading && !isError && verse && (
        <View>
          {zeilen.map((z) => (
            <SatzstrukturZeile
              key={z.word.position}
              word={z.word}
              tiefe={z.tiefe}
              verseWords={verse}
              onPress={() => onWortAuswahl(z.word.position)}
            />
          ))}
        </View>
      )}
    </Aufklappbar>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: Spacing.three },
  zeile: { paddingVertical: Spacing.two, gap: 2, borderTopWidth: StyleSheet.hairlineWidth },
  kopfReihe: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kopfReiheRtl: { flexDirection: 'row-reverse' },
  arabic: { fontSize: 20, lineHeight: 30 },
  hinweis: { fontStyle: 'italic' },
  textRtl: { textAlign: 'right' },
  pressed: { opacity: 0.6 },
});

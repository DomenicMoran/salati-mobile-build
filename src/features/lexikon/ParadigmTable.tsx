// Generischer Renderer für eine Paradigmen-Tabelle (data/paradigmen*.json,
// zusammengeführt über paradigmenLoader.ts) — deckt sowohl die Verb-Personenmatrizen
// (5 Zeilen × 3 Spalten: Person als Zeilenbeschriftung, Numerus als Spalte)
// als auch einfache Vokabellisten (1 Spalte) mit demselben {columns, rows,
// cells}-Schema ab.
//
// Layout IMMER in der im Handout gedruckten Reihenfolge — unabhängig von der
// aktiven App-Sprache: die Spalten erscheinen in der Reihenfolge, in der sie
// in der Datei stehen (bereits die gedruckte Links-nach-rechts-Reihenfolge,
// siehe `notes` in paradigmen-verben.json), die Zeilenbeschriftung steht
// zuletzt — also GANZ RECHTS, wie im Original ("Personenspalte rechts").
// Diese Tabellen bilden arabische Grammatik ab, nicht die UI-Chrome — sie
// bleiben deshalb bewusst bei dieser festen Ausrichtung, auch wenn die
// UI-Sprache selbst linksläufig ist.
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

import type { ParadigmTabelle, ParadigmZelle } from './erklaerungenTypes';

// Manche Tabellen dokumentieren eine tatsächliche Unstimmigkeit in der
// Vorlage (z. B. Abbildung 92 in paradigmen-bab-naqis-lafif-mudaaf.json:
// bab-tafaul6-naqis-talaqa druckt Aktiv-/Imperativformen ohne Shadda,
// obwohl das Passiv-Muster auf die Shadda-tragende Nachbartabelle
// bab-tafaul5-naqis-talaqqa hindeutet). Ein Autor, der diese Notiz schreibt,
// aber niemand sie je zu Gesicht bekommt, hat nichts gewonnen — deshalb wird
// sie hier optisch hervorgehoben statt in einer stillschweigend
// abgeschnittenen notes[0] zu verschwinden.
const ACHTUNG_PRAEFIX = /^ACHTUNG/;

const CELL_WIDTH = 144;
const LABEL_WIDTH = 152;
const LARGE_FONT_CELL_WIDTH = 184;
const LARGE_FONT_LABEL_WIDTH = 192;

export function ParadigmTable({ table }: { table: ParadigmTabelle }) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { width, fontScale } = useWindowDimensions();
  const { t } = useTranslation();
  // A shared fixed width per column keeps every row edge aligned. At large
  // accessibility sizes, widen the columns uniformly and allow text to wrap.
  const cellWidth = fontScale >= 1.5 ? LARGE_FONT_CELL_WIDTH : CELL_WIDTH;
  const labelWidth = fontScale >= 1.5 ? LARGE_FONT_LABEL_WIDTH : LABEL_WIDTH;
  const tableWidth = table.columns.length * cellWidth + labelWidth;
  const availableWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.three;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <ThemedText type="smallBold">{table.titleDe}</ThemedText>
        {table.termAr ? (
          <ThemedText type="small" themeColor="accent">
            {table.termAr}
          </ThemedText>
        ) : null}
      </View>

      {tableWidth > availableWidth ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.scrollHint}>
          {t('lexikon.grammar.horizontalScrollHint')}
        </ThemedText>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        persistentScrollbar
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}>
        <View>
          {/* Kopfzeile: Spaltenköpfe in Dateireihenfolge, Ecke für die
              Zeilenbeschriftung zuletzt (rechts). */}
          <View style={[styles.row, { borderColor: colors.separator }]}>
            {table.columns.map((col) => (
              <ThemedView key={col.id} type="backgroundElement" style={[styles.cell, styles.headerCell, { width: cellWidth, borderColor: colors.separator }]}>
                <ThemedText type="smallBold" style={styles.centerText}>
                  {col.labelDe}
                </ThemedText>
                {col.labelAr ? (
                  <ThemedText type="small" themeColor="accent" style={styles.centerText}>
                    {col.labelAr}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ))}
            <ThemedView type="backgroundElement" style={[styles.labelCell, styles.headerCell, { width: labelWidth, borderColor: colors.separator }]} />
          </View>

          {table.rows.map((row) => (
            <View key={row.id} style={[styles.row, { borderColor: colors.separator }]}>
              {table.columns.map((col) => (
                <ParadigmCell key={col.id} cell={table.cells[row.id]?.[col.id] ?? null} width={cellWidth} borderColor={colors.separator} />
              ))}
              <ThemedView type="backgroundElement" style={[styles.labelCell, { width: labelWidth, borderColor: colors.separator }]}>
                <ThemedText type="small" style={styles.centerText}>
                  {row.labelDe}
                </ThemedText>
                {row.labelAr ? (
                  <ThemedText type="small" themeColor="accent" style={styles.centerText}>
                    {row.labelAr}
                  </ThemedText>
                ) : null}
              </ThemedView>
            </View>
          ))}
        </View>
      </ScrollView>
      {table.notes && table.notes.length > 0 ? (
        <View style={styles.notes}>
          {table.notes.map((note, i) => (
            <NoteLine key={i} note={note} colors={colors} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NoteLine({ note, colors }: { note: string; colors: { accent: string } }) {
  const achtung = ACHTUNG_PRAEFIX.test(note);
  if (!achtung) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.noteLine}>
        {note}
      </ThemedText>
    );
  }
  return (
    <View style={styles.noteAchtungRow}>
      <IconSymbol name="alert-circle-outline" size={14} color={colors.accent} />
      <ThemedText type="smallBold" themeColor="accent" style={styles.noteLine}>
        {note}
      </ThemedText>
    </View>
  );
}

function ParadigmCell({ cell, borderColor, width }: { cell: ParadigmZelle; borderColor: string; width: number }) {
  return (
    <View style={[styles.cell, { width, borderColor }]}>
      {cell ? (
        <>
          <ThemedText type="default" style={styles.centerText}>
            {cell.ar}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {cell.de}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          —
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.four, gap: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one, flexWrap: 'wrap' },
  scroll: { alignSelf: 'stretch' },
  scrollContent: { flexGrow: 1, minWidth: '100%', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  labelCell: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  headerCell: { paddingVertical: Spacing.two },
  centerText: { textAlign: 'center' },
  scrollHint: { marginTop: Spacing.one },
  notes: { marginTop: Spacing.one, gap: Spacing.one },
  noteLine: { flex: 1 },
  noteAchtungRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.one },
});

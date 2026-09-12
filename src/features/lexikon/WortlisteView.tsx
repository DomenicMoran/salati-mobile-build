// Renderer für die drei Inhaltstypen aus data/wortlisten.json (siehe
// wortlistenTypes.ts): Vokabel-/Partikellisten (WortlisteCard), die
// Beispielsatzliste der Verbindungsbuchstaben (BeispielsatzlisteCard) und
// die beiden Flussdiagramme (AblaufschemaCard). Bewusst NICHT über
// ParadigmTable.tsx (das feste {columns,rows,cells}-Raster) gerendert — eine
// Wortliste hat keine Person-/Numerus-/Kasus-Achse, sondern ist eine simple
// Liste aus (arabischem Wort, Umschrift, Bedeutung), siehe LUECKEN.md.
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';

import type {
  WortlistenUebersetzungAblaufschema,
  WortlistenUebersetzungBeispielsatzliste,
  WortlistenUebersetzungListe,
  WortlistenUebersetzungVergleichstabelle,
} from './wortlistenI18nTypes';
import type { Ablaufschema, Beispielsatzliste, Vergleichstabelle, Wortliste } from './wortlistenTypes';

function NotesBlock({ notes }: { notes?: string[] }) {
  if (!notes || notes.length === 0) return null;
  return (
    <View style={styles.notes}>
      {notes.map((note, i) => (
        <ThemedText key={i} type="small" themeColor="textSecondary" style={styles.noteLine}>
          {note}
        </ThemedText>
      ))}
    </View>
  );
}

export function WortlisteCard({ liste, uebersetzung }: { liste: Wortliste; uebersetzung?: WortlistenUebersetzungListe }) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const titel = uebersetzung?.title ?? liste.titleDe;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{titel}</ThemedText>

      <View style={[styles.table, { borderColor: colors.separator }]}>
        {liste.entries.map((eintrag, i) => (
          <View key={i} style={[styles.row, { borderColor: colors.separator }]}>
            <View style={styles.arColumn}>
              <ThemedText type="default" style={styles.arText}>
                {eintrag.ar}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {eintrag.umschrift}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.deColumn}>
              {uebersetzung?.entries[i] ?? eintrag.de}
            </ThemedText>
          </View>
        ))}
      </View>

      {liste.beispiele && liste.beispiele.length > 0 ? (
        <View style={styles.beispiele}>
          {liste.beispiele.map((b, i) => (
            <View key={i} style={styles.beispielRow}>
              <ThemedText type="small" style={styles.arText}>
                {b.ar}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {b.umschrift} — {uebersetzung?.beispiele?.[i] ?? b.de}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <NotesBlock notes={liste.notes} />
    </View>
  );
}

export function BeispielsatzlisteCard({
  liste,
  uebersetzung,
}: {
  liste: Beispielsatzliste;
  uebersetzung?: WortlistenUebersetzungBeispielsatzliste;
}) {
  const titel = uebersetzung?.title ?? liste.titleDe;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{titel}</ThemedText>

      {liste.entries.map((eintrag, i) => {
        const ue = uebersetzung?.entries[i];
        return (
          <View key={i} style={styles.beispielsatzBlock}>
            <View style={styles.beispielsatzKopf}>
              <ThemedText type="default" style={styles.arText}>
                {eintrag.ar}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {eintrag.umschrift} — {ue?.beschreibung ?? eintrag.beschreibung}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.arText}>
              {eintrag.beispielAr}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.beispielUebersetzung}>
              „{ue?.beispiel ?? eintrag.beispielDe}“
            </ThemedText>
          </View>
        );
      })}

      <NotesBlock notes={liste.notes} />
    </View>
  );
}

export function AblaufschemaCard({
  schema,
  uebersetzung,
}: {
  schema: Ablaufschema;
  uebersetzung?: WortlistenUebersetzungAblaufschema;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const titel = uebersetzung?.title ?? schema.titleDe;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{titel}</ThemedText>

      <View style={styles.schritte}>
        {schema.schritte.map((schritt, i) => (
          <View key={i}>
            <ThemedView type="backgroundElement" style={[styles.kasten, { borderColor: colors.separator }]}>
              {schritt.kastenAr ? (
                <ThemedText type="small" style={styles.arText}>
                  {schritt.kastenAr}
                </ThemedText>
              ) : null}
              <ThemedText type="small">{uebersetzung?.schritte[i] ?? schritt.kastenDe}</ThemedText>
            </ThemedView>
            {i < schema.schritte.length - 1 ? (
              <View style={styles.pfeilRow}>
                <IconSymbol name="chevron-down" size={16} color={colors.textSecondary} />
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {schema.beispielAr ? (
        <View style={styles.beispielsatzBlock}>
          <ThemedText type="small" style={styles.arText}>
            {schema.beispielAr}
          </ThemedText>
          {schema.beispielDe ? (
            <ThemedText type="small" themeColor="textSecondary">
              {uebersetzung?.beispiel ?? schema.beispielDe}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <NotesBlock notes={schema.notes} />
    </View>
  );
}

/** Renderer für Vergleichstabelle (siehe wortlistenTypes.ts) — die Balagah-
 *  Vergleichs-/Klassifikationsraster (Tashbih, Isti'ara, Majaz/'Alaqa).
 *  Anders als WortlisteCard (feste ar/umschrift/de-Spalten) rendert diese
 *  Karte die pro Tabelle eigenen `columns` als Kopfzeile und je Zeile eine
 *  optionale Zeilenbeschriftung (`row.labelDe`, z. B. "Original"/
 *  "Umgekehrt") — dieselbe Grundidee wie ParadigmTable.tsx, nur mit der
 *  gelockerten `VergleichsZelle` (ar ODER de statt eines erzwungenen
 *  Paares). */
export function VergleichstabelleCard({
  tabelle,
  uebersetzung,
}: {
  tabelle: Vergleichstabelle;
  uebersetzung?: WortlistenUebersetzungVergleichstabelle;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const hatZeilenLabel = tabelle.rows.some((r) => r.labelDe);
  const titel = uebersetzung?.title ?? tabelle.titleDe;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{titel}</ThemedText>

      <View style={[styles.vergleichsTable, { borderColor: colors.separator }]}>
        <View style={[styles.vergleichsRow, { borderColor: colors.separator }]}>
          {hatZeilenLabel ? <View style={styles.vergleichsCell} /> : null}
          {tabelle.columns.map((col) => (
            <View key={col.id} style={styles.vergleichsCell}>
              <ThemedText type="smallBold">{uebersetzung?.columns[col.id] ?? col.labelDe}</ThemedText>
            </View>
          ))}
        </View>

        {tabelle.rows.map((row) => (
          <View key={row.id} style={[styles.vergleichsRow, { borderColor: colors.separator }]}>
            {hatZeilenLabel ? (
              <View style={styles.vergleichsCell}>
                <ThemedText type="small" themeColor="textSecondary">
                  {(row.labelDe ? uebersetzung?.rows?.[row.id] : undefined) ?? row.labelDe ?? ''}
                </ThemedText>
              </View>
            ) : null}
            {tabelle.columns.map((col) => {
              const zelle = tabelle.cells[row.id]?.[col.id] ?? null;
              const uebersetzteZelle = zelle?.de ? uebersetzung?.cells?.[row.id]?.[col.id] : undefined;
              return (
                <View key={col.id} style={styles.vergleichsCell}>
                  {zelle?.ar ? (
                    <ThemedText type="small" style={styles.arText}>
                      {zelle.ar}
                    </ThemedText>
                  ) : null}
                  {zelle?.de ? <ThemedText type="small">{uebersetzteZelle ?? zelle.de}</ThemedText> : null}
                  {!zelle ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      –
                    </ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <NotesBlock notes={tabelle.notes} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.four, gap: Spacing.one },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.one, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  arColumn: { gap: 2 },
  deColumn: { flex: 1, textAlign: 'right' },
  arText: { writingDirection: 'rtl' },
  beispiele: { marginTop: Spacing.one, gap: Spacing.one, paddingHorizontal: Spacing.one },
  beispielRow: { gap: 2 },
  beispielsatzBlock: { gap: 2, marginTop: Spacing.two },
  beispielsatzKopf: { gap: 2 },
  beispielUebersetzung: { fontStyle: 'italic' },
  schritte: { alignItems: 'stretch', gap: 2 },
  kasten: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.two, padding: Spacing.two, gap: 2 },
  pfeilRow: { alignItems: 'center', paddingVertical: 2 },
  notes: { marginTop: Spacing.one, gap: Spacing.one },
  noteLine: { flex: 1 },
  vergleichsTable: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.one, overflow: 'hidden' },
  vergleichsRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  vergleichsCell: { flex: 1, minWidth: 0, padding: Spacing.two, gap: 2, justifyContent: 'center' },
});

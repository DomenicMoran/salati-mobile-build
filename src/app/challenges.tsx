import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  KATEGORIEN,
  kategorieTextSchluessel,
  vorlageTextSchluessel,
  type Kategorie,
} from '@/features/challenges/katalog';
import { ladeAlles, type Fortschritt } from '@/features/challenges/fortschritt';
import { speichereStand, zaehle, type HerausforderungenStand } from '@/features/challenges/store';
import { maybeRequestReview } from '@/features/settings/ratingPrompt';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';

// Herausforderungen: 112 Ziele in sechs Bereichen, vier Stufen je Vorlage.
//
// EIN Bildschirm statt Liste + Detailseite. Eine Detailseite haette pro Ziel
// nichts zu zeigen, was hier nicht schon steht (Satz, Fortschritt, Knopf) —
// sie waere ein zusaetzlicher Tipp ohne Gegenwert und eine zweite Stelle, an
// der etwas kaputtgehen kann.
//
// Neu berechnet wird bei jedem Betreten (useFocusEffect), damit ein gerade im
// Gebets-Tracker abgehakter Tag hier sofort zaehlt — gleiches Muster wie im
// Abzeichen-Bildschirm.

/** 'alle' ist kein Bereich aus dem Katalog, sondern die Voreinstellung. */
type Filter = 'alle' | Kategorie;

export default function ChallengesScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const rtl = useRtl();

  const [fortschritte, setFortschritte] = useState<Fortschritt[] | null>(null);
  const [stand, setStand] = useState<HerausforderungenStand>({});
  const [filter, setFilter] = useState<Filter>('alle');
  const [frisch, setFrisch] = useState<Set<string>>(new Set());

  const laden = useCallback(() => {
    let abgebrochen = false;
    ladeAlles()
      .then((ergebnis) => {
        if (abgebrochen) return;
        setFortschritte(ergebnis.fortschritte);
        setStand(ergebnis.stand);
        if (ergebnis.neuErreicht.length > 0) {
          setFrisch(new Set(ergebnis.neuErreicht));
          hapticSuccess();
          // Ein gerade erreichtes Ziel ist ein guter Moment fuer die Bitte um
          // eine Bewertung — derselbe Ankerpunkt wie im Abzeichen-Bildschirm.
          maybeRequestReview().catch(() => {});
        }
      })
      .catch(() => {
        if (!abgebrochen) setFortschritte([]);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  useFocusEffect(laden);

  const sichtbar = useMemo(
    () => (fortschritte ?? []).filter((f) => filter === 'alle' || f.herausforderung.kategorie === filter),
    [fortschritte, filter],
  );

  const erreichteGesamt = (fortschritte ?? []).filter((f) => f.erreicht).length;
  const gesamt = (fortschritte ?? []).length;

  /**
   * Zaehler eines selbst gezaehlten Ziels verschieben. Rechnet den Fortschritt
   * sofort im Zustand nach, statt auf ein erneutes Laden zu warten — sonst
   * fuehlt sich jeder Tipp traege an. Der Speicher wird danach geschrieben;
   * schlaegt das fehl, steht beim naechsten Betreten wieder der alte Wert, was
   * ehrlicher ist als eine Zahl, die es nicht gibt.
   */
  async function verschiebe(id: string, delta: number) {
    hapticLight();
    const naechster = zaehle(stand, id, delta);
    if (naechster === stand) return;
    setStand(naechster);
    setFortschritte((vorher) =>
      (vorher ?? []).map((f) => {
        if (f.herausforderung.id !== id) return f;
        const roh = naechster[id]?.zaehler ?? 0;
        const wert = Math.min(roh, f.herausforderung.ziel);
        return {
          ...f,
          wert,
          anteil: f.herausforderung.ziel > 0 ? wert / f.herausforderung.ziel : 0,
          erreicht: roh >= f.herausforderung.ziel || f.erreichtAm !== undefined,
        };
      }),
    );
    await speichereStand(naechster);
  }

  if (fortschritte === null) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title={t('challenges.title')} />
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('challenges.title')} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('challenges.subtitle')}
        </ThemedText>

        <View style={styles.progressWrap}>
          <ThemedView type="backgroundElement" style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${gesamt > 0 ? (erreichteGesamt / gesamt) * 100 : 0}%` },
              ]}
            />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {erreichteGesamt}/{gesamt}
          </ThemedText>
        </View>

        {/* Bereichsfilter. Waagerecht scrollbar, damit auch auf schmalen
            Geraeten alle sieben Knoepfe erreichbar bleiben statt umzubrechen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterZeile, rtl && styles.filterZeileRtl]}>
          {(['alle', ...KATEGORIEN] as Filter[]).map((k) => {
            const aktiv = filter === k;
            return (
              <Pressable
                key={k}
                // Bewusst OHNE Haptik: das ist reines Umschalten der Ansicht.
                // Haptik ist in dieser App den bedeutsamen Momenten
                // vorbehalten, nicht jedem Knopf (s. lib/haptics.ts).
                onPress={() => setFilter(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: aktiv }}
                accessibilityLabel={k === 'alle' ? t('challenges.alle') : t(kategorieTextSchluessel(k))}
                style={({ pressed }) => [
                  styles.filterChip,
                  { borderColor: aktiv ? Brand.gold : colors.textSecondary },
                  aktiv && { backgroundColor: Brand.gold },
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={aktiv ? { color: Brand.ink } : { color: colors.textSecondary }}>
                  {k === 'alle' ? t('challenges.alle') : t(kategorieTextSchluessel(k))}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <FlatList
          data={sichtbar}
          keyExtractor={(f) => f.herausforderung.id}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.leer}>
              {t('challenges.leer')}
            </ThemedText>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={Math.min(index, 12)}>
              <Zeile fortschritt={item} />
            </AnimatedListItem>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );

  function Zeile({ fortschritt }: { fortschritt: Fortschritt }) {
    const { herausforderung: h, wert, anteil, erreicht } = fortschritt;
    const satz = t(vorlageTextSchluessel(h.vorlageId)).replace('{n}', String(h.ziel));
    const istFrisch = frisch.has(h.id);
    const manuell = h.quelle === 'manuell';

    return (
      <ThemedView
        type={erreicht ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.karte}
        // Ohne diese Zusammenfassung liest der Screenreader Satz, Bereich,
        // Stufe und Zahlen als vier zusammenhanglose Fetzen vor. Die Kinder
        // werden deshalb zu EINEM Element zusammengefasst; die beiden Knoepfe
        // darunter bleiben davon unberuehrt, weil sie eigene Bedienelemente
        // sind (accessibilityRole="button").
        accessible
        accessibilityLabel={[
          satz,
          t(kategorieTextSchluessel(h.kategorie)),
          t('challenges.stufe').replace('{n}', String(h.stufe)),
          `${wert}/${h.ziel}`,
          erreicht ? t('challenges.erreichtLabel') : '',
        ]
          .filter(Boolean)
          .join(' · ')}>
        <View style={[styles.karteKopf, rtl && styles.karteKopfRtl]}>
          <View style={[styles.iconKreis, { borderColor: erreicht ? Brand.gold : colors.textSecondary }]}>
            <IconSymbol
              name={erreicht ? 'checkmark' : h.icon}
              size={20}
              color={erreicht ? Brand.gold : colors.textSecondary}
            />
          </View>
          <View style={styles.karteText}>
            <ThemedText type="smallBold" themeColor="text">
              {satz}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t(kategorieTextSchluessel(h.kategorie))} · {t('challenges.stufe').replace('{n}', String(h.stufe))}
              {manuell ? ` · ${t('challenges.selbstGezaehlt')}` : ''}
            </ThemedText>
          </View>
          {istFrisch && (
            <View style={styles.frischChip}>
              <ThemedText type="smallBold" style={styles.frischChipText}>
                {t('challenges.frisch')}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.fortschrittZeile, rtl && styles.karteKopfRtl]}>
          <ThemedView type="background" style={styles.balkenSpur}>
            <View style={[styles.balkenFuellung, { width: `${Math.round(anteil * 100)}%` }]} />
          </ThemedView>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={[styles.zahl, { textAlign: rtl ? 'left' : 'right' }]}>
            {wert}/{h.ziel}
          </ThemedText>
        </View>

        {manuell && (
          <View style={[styles.knopfZeile, rtl && styles.karteKopfRtl]}>
            <Pressable
              onPress={() => verschiebe(h.id, -1)}
              disabled={(stand[h.id]?.zaehler ?? 0) === 0}
              accessibilityRole="button"
              accessibilityLabel={t('challenges.wenigerLabel').replace('{ziel}', satz)}
              style={({ pressed }) => [
                styles.knopf,
                { borderColor: colors.textSecondary },
                (stand[h.id]?.zaehler ?? 0) === 0 && styles.knopfAus,
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && styles.pressed,
              ]}>
              <IconSymbol name="remove" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => verschiebe(h.id, 1)}
              accessibilityRole="button"
              accessibilityLabel={t('challenges.mehrLabel').replace('{ziel}', satz)}
              style={({ pressed }) => [
                styles.knopf,
                styles.knopfHaupt,
                Platform.OS === 'web' ? styles.pressableWeb : undefined,
                pressed && styles.pressed,
              ]}>
              <IconSymbol name="add" size={18} color={Brand.ink} />
              <ThemedText type="smallBold" style={{ color: Brand.ink }}>
                {t('challenges.eintragen')}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { textAlign: 'center', paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Brand.gold, borderRadius: 4 },
  filterZeile: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    alignItems: 'center',
  },
  filterZeileRtl: { flexDirection: 'row-reverse' },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    // 44 dp Mindesthoehe fuer die Tippflaeche (Audit 2026-07-22).
    minHeight: 44,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  leer: { textAlign: 'center', marginTop: Spacing.five },
  karte: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  karteKopf: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  karteKopfRtl: { flexDirection: 'row-reverse' },
  karteText: { flex: 1, gap: 2 },
  iconKreis: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fortschrittZeile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  balkenSpur: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  balkenFuellung: { height: 6, backgroundColor: Brand.gold, borderRadius: 3 },
  zahl: { minWidth: 56 },
  knopfZeile: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
  knopf: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  knopfHaupt: { backgroundColor: Brand.gold, borderColor: Brand.gold },
  knopfAus: { opacity: 0.4 },
  frischChip: {
    backgroundColor: Brand.gold,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  frischChipText: { color: Brand.ink, fontSize: 11, lineHeight: 14 },
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.7 },
});

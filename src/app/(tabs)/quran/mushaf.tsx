import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BackChipInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  JUZ_START_PAGES,
  MUSHAF_TOTAL_PAGES,
  RECOMMENDED_RECITERS,
  RECOMMENDED_TRANSLATIONS,
  toArabicDigits,
  type MushafStyle,
  type MushafSurahGroup,
  type MushafWord,
  type SurahMeta,
} from '@/features/quran/api';
import { EditionPicker, editionDisplayName } from '@/features/quran/EditionPicker';
import {
  useAudioEditions,
  useMushafGroupReadings,
  useMushafPage,
  useSurahList,
  useSurahStartPage,
  useTranslationEditions,
} from '@/features/quran/hooks';
import { buildMushafPlaylist, findMushafPlaylistIndex } from '@/features/quran/mushafPlaylist';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { useAyahPlayer } from '@/features/quran/usePlayer';
import { WordInfoSheet } from '@/features/quran/WordInfoSheet';
import { dayIndexForDate, pageRangeForDay, useKhatmah } from '@/features/khatmah/plan';
import { useSettings } from '@/features/settings/store';
import { dayKey } from '@/features/tracker/store';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTheme } from '@/hooks/use-theme';
import { ayahMarker, quranFontDef, quranFontForScript } from '@/features/quran/fonts';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { splitArabicWords } from '@/lib/arabicText';
import { isRtlLanguageCode } from '@/lib/locale-detect';
import { backOr } from '@/lib/nav';
import { useTranslation } from '@/lib/i18n';

// Doppelseiten-Breakpoint (Task #62): ab dieser Breite zeigen wir zwei Mushaf-
// Seiten nebeneinander wie ein aufgeschlagenes Buch — analog zum wide-Breakpoint
// in components/prayer-times-screen.tsx (dort ebenfalls >= 900px).
const WIDE_BREAKPOINT = 900;

// Mushaf-Seitenansicht: der Koran als 604 Druckseiten (Madina-Zählung) im
// zusammenhängenden RTL-Fließtext — wie im gedruckten Mushaf, mit wählbarem
// Schriftstil (Uthmani/IndoPak). Ergänzt den Vers-für-Vers-Reader und teilt
// dessen Einstellungen (Rezitator, Übersetzung, Schriftgröße, Sepia) über
// ein eigenes Options-Sheet, statt nur die Stil-Umschaltung anzubieten.
const LAST_PAGE_KEY = 'salatibox:mushaf-page';

const PAGE_FONT_SIZES = { small: 20, medium: 24, large: 30, xlarge: 36 } as const;
const PAGE_LINE_HEIGHTS = { small: 40, medium: 48, large: 60, xlarge: 72 } as const;
const FONT_SIZE_ORDER = ['small', 'medium', 'large', 'xlarge'] as const;
const FONT_SIZE_LABEL_KEYS = {
  small: 'settings.fontSmall',
  medium: 'settings.fontMedium',
  large: 'settings.fontLarge',
  xlarge: 'settings.fontXLarge',
} as const;

// Basmala erscheint im gedruckten Mushaf über jeder Sure außer 1 (dort ist
// sie Vers 1) und 9 (At-Tawba hat keine Basmala).
const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

const SEPIA_BG = '#f1e7d0';
const SEPIA_CARD = '#e9dcbf';

export default function MushafScreen() {
  const params = useLocalSearchParams<{ page?: string; surah?: string }>();
  const { t, locale } = useTranslation();
  const { settings, update } = useSettings();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const sepia = settings.readerSepia;
  // Sepia-aware Farben für Header-/Nav-Icons + Sprungfeld — dieselbe Logik wie
  // ThemedText (sepia erzwingt die helle Tinten-Palette), aber für Elemente mit
  // rohem `color`-Prop statt ThemedText/ThemedView (Audit 2026-07-20, analog
  // zum Sure-Reader [surah].tsx).
  const cardColors = useTheme(sepia);

  const paramPage = Number(params.page);
  const paramSurah = Number(params.surah);
  const startPage = useSurahStartPage(Number.isFinite(paramSurah) && paramSurah >= 1 ? paramSurah : null);

  // Seite wird abgeleitet: Nutzer-Navigation > page-Param > Suren-Startseite >
  // zuletzt gelesene Seite (0 = noch unbestimmt, zeigt Spinner). Vor der
  // Hydration immer 0 — die Query-Params existieren im Static-Export-HTML
  // nicht, ein param-abhängiger Erstrender wäre React-Fehler #418.
  const hydrated = useHydrated();
  const fromSurah = Number.isFinite(paramSurah) && paramSurah >= 1;
  const paramPageValid =
    Number.isFinite(paramPage) && paramPage >= 1 && paramPage <= MUSHAF_TOTAL_PAGES ? paramPage : null;
  const [pageOverride, setPageOverride] = useState<number | null>(null);
  const [savedPage, setSavedPage] = useState<number | null>(null);
  const [jumpText, setJumpText] = useState('');
  // Wort-Info: schaltet die Block-Ansicht mit Übersetzung je Vers um. Das
  // Antippen eines Worts öffnet IMMER das Wort-Lexikon-Sheet (Task #55) —
  // auch in der normalen, durchgehenden Mushaf-Ansicht ohne diesen Umschalter,
  // weil genau das der User-Wunsch ist ("man liest den Mushaf und tippt
  // trotzdem auf ein Wort"). Wortdaten werden daher immer mitgeladen
  // (useMushafPage withWords=true, s.u.), nicht mehr an wordInfoOn gekoppelt.
  const [wordInfoOn, setWordInfoOn] = useState(false);
  const [selectedWord, setSelectedWord] = useState<MushafWord | null>(null);
  // Optionen-Sheet: bündelt Stil, Wort-Info, Schriftgröße, Sepia, Rezitator
  // und Übersetzung an einer Stelle — analog zum "Ansicht & Wiedergabe"-Sheet
  // im normalen Sure-Reader, statt einzelner Chips im knappen Kopfbereich
  // (die dort auf schmalen Handy-Breiten den Titel umgebrochen haben).
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'reciter' | 'translation' | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_PAGE_KEY).then((raw) => {
      const saved = Number(raw);
      setSavedPage(Number.isFinite(saved) && saved >= 1 && saved <= MUSHAF_TOTAL_PAGES ? saved : 1);
    });
  }, []);

  const page = !hydrated
    ? 0
    : (pageOverride ?? paramPageValid ?? (fromSurah ? (startPage.data ?? 0) : (savedPage ?? 0)));

  useEffect(() => {
    if (page >= 1) AsyncStorage.setItem(LAST_PAGE_KEY, String(page)).catch(() => {});
  }, [page]);

  const { data, isLoading, isError, refetch } = useMushafPage(page, settings.mushafStyle, true);

  // Doppelseiten-Ansicht (Task #62): ab WIDE_BREAKPOINT zwei Seiten wie ein
  // aufgeschlagenes Buch. Im gedruckten Mushaf (Arabisch = RTL) liegt die
  // Seite mit der niedrigeren Nummer rechts, die mit der höheren links —
  // Seite 1 rechts, Seite 2 links, usw. (ungerade = rechts, gerade = links).
  // Die "page"-Ablösung bleibt der alleinige Anker (Sprung/Juz/URL-Param);
  // wide lädt zusätzlich nur die fehlende Partnerseite des Spreads nach.
  // Vor der Hydration immer false (wie bei `page` oben): react-native-webs
  // useWindowDimensions() seedet ihren State beim allerersten Client-Render
  // bereits mit der ECHTEN Fensterbreite (Dimensions.get() initialisiert
  // sofort per shouldInit/canUseDOM), während das Static-Export-HTML immer
  // mit width=0 vorgerendert wurde — auf Bildschirmen ≥ WIDE_BREAKPOINT
  // driftet der allererste Client-Render (Doppelseiten-Layout) dadurch vom
  // Server-HTML (Einzelseiten-Layout) auseinander (React-Fehler #418), live
  // beobachtet auf Desktop-Breite. Ohne `hydrated` bleibt der erste
  // Client-Render mit dem Server-HTML identisch, danach schaltet ein
  // normaler (kein Hydrations-)Re-Render auf die echte Breite um.
  const { width } = useWindowDimensions();
  const wide = hydrated && width >= WIDE_BREAKPOINT;
  const partnerPage = wide && page >= 1 ? (page % 2 === 1 ? page + 1 : page - 1) : 0;
  const dataPartner = useMushafPage(partnerPage, settings.mushafStyle, true);
  const rightPage = page % 2 === 1 ? page : partnerPage;
  const leftPage = page % 2 === 1 ? partnerPage : page;
  const rightData = page % 2 === 1 ? data : dataPartner.data;
  const leftData = page % 2 === 1 ? dataPartner.data : data;
  const spreadLoading = isLoading || (wide && dataPartner.isLoading);
  const spreadError = isError || (wide && dataPartner.isError);

  // Fallback-Zerlegung nach Leerzeichen, falls die Wort-Daten für einen Vers
  // ausnahmsweise fehlen (z. B. kurzzeitig während des ersten Ladens) — ohne
  // Übersetzung/Transliteration/Tajwid-Regeln, das Sheet zeigt dafür den
  // ehrlichen "keine Daten"-Hinweis statt erfundener Angaben.
  const verseWords = useCallback(
    (v: { text: string; words?: MushafWord[] }): MushafWord[] =>
      v.words && v.words.length > 0
        ? v.words
        : splitArabicWords(v.text).map((arabic) => ({
            arabic,
            translation: '',
            transliteration: '',
            tajweedRules: [],
          })),
    [],
  );
  const surahList = useSurahList();
  const surahMeta = useMemo(() => {
    const map = new Map<number, SurahMeta>();
    for (const s of surahList.data ?? []) map.set(s.number, s);
    return map;
  }, [surahList.data]);

  // Übersetzung + Rezitations-Audio je Vers für die Suren dieser Seite (und,
  // in der Doppelseiten-Ansicht, der Partnerseite) — nur geladen, wenn die
  // Seite(n) stehen (teilt Cache mit dem normalen Reader).
  const pageSurahNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (const g of data?.groups ?? []) nums.add(g.surah);
    if (wide) for (const g of dataPartner.data?.groups ?? []) nums.add(g.surah);
    return Array.from(nums);
  }, [data, dataPartner.data, wide]);
  const groupReadings = useMushafGroupReadings(
    pageSurahNumbers,
    settings.quranTranslation,
    settings.quranReciter,
    !!data && pageSurahNumbers.length > 0,
  );
  const readingBySurah = useMemo(() => {
    const map = new Map<number, (typeof groupReadings)[number]['data']>();
    pageSurahNumbers.forEach((sn, i) => map.set(sn, groupReadings[i]?.data));
    return map;
  }, [pageSurahNumbers, groupReadings]);

  // Mushaf-Seiten-Wiedergabe (Task: "Seite vorlesen"): eine flache Playlist
  // über alle Suren dieser Druckseite, geteilt zwischen dem neuen Play-Button
  // ("ganze Seite") und dem bereits bestehenden Einzelvers-Tap (playFrom mit
  // continuous=false stoppt nach dem einen Vers, wie im normalen Reader) —
  // EIN Player statt zwei getrennter Instanzen, sonst könnten beide
  // gleichzeitig überlappend Audio abspielen.
  const audioBySurah = useMemo(() => {
    const map = new Map<number, Map<number, string | undefined>>();
    readingBySurah.forEach((reading, surahNumber) => {
      const inner = new Map<number, string | undefined>();
      reading?.ayahs.forEach((a) => inner.set(a.numberInSurah, a.audio));
      map.set(surahNumber, inner);
    });
    return map;
  }, [readingBySurah]);
  const pagePlaylist = useMemo(
    () => buildMushafPlaylist(data?.groups ?? [], audioBySurah),
    [data, audioBySurah],
  );
  const pagePlayer = useAyahPlayer(
    pagePlaylist.map((v) => ({ numberInSurah: v.ayah, audio: v.audio })),
    `${t('quran.mushafTitle')} · ${t('quran.mushafPage')} ${page}`,
    settings.quranPlaybackSpeed,
  );
  const playPageVerse = useCallback(
    (surah: number, ayah: number) => {
      const idx = findMushafPlaylistIndex(pagePlaylist, surah, ayah);
      if (idx === -1) return;
      pagePlayer.playFrom(idx, false);
    },
    [pagePlaylist, pagePlayer],
  );
  function togglePagePlayback() {
    if (pagePlayer.playing) {
      pagePlayer.pause();
    } else if (pagePlayer.currentIndex !== null) {
      pagePlayer.resume();
    } else {
      pagePlayer.playFrom(0, true);
    }
  }
  const pageHasAudio = pagePlaylist.some((v) => !!v.audio);
  const activePlaylistVerse = pagePlayer.currentIndex !== null ? pagePlaylist[pagePlayer.currentIndex] : null;
  // Seite verlassen (Blättern/Sprung/Juz) beendet eine laufende Wiedergabe —
  // sonst liefe Audio einer bereits verlassenen Seite unsichtbar weiter.
  useEffect(() => {
    pagePlayer.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const audioEditions = useAudioEditions();
  const translationEditions = useTranslationEditions();
  const currentReciterEdition = audioEditions.data?.find((e) => e.identifier === settings.quranReciter);
  const currentReciterName = currentReciterEdition
    ? editionDisplayName(currentReciterEdition)
    : settings.quranReciter;
  const currentTranslationEdition = translationEditions.data?.find(
    (e) => e.identifier === settings.quranTranslation,
  );
  const currentTranslationName = currentTranslationEdition
    ? editionDisplayName(currentTranslationEdition)
    : settings.quranTranslation;

  // Khatmah-Fortschritt (Task #65): nur sichtbar, wenn ein Leseplan aktiv ist.
  // Der Plan speichert Juz'-Bereiche pro Tag (plan.ts) — für "Seite X von Y"
  // rechnen wir den heutigen Juz'-Bereich über JUZ_START_PAGES in einen
  // Mushaf-Seitenbereich um; X ist die Position der gerade offenen Seite
  // darin (0 vor Bereichsbeginn, gedeckelt am Bereichsende).
  const { plan: khatmahPlan } = useKhatmah();
  const khatmahDayIndex = khatmahPlan ? dayIndexForDate(khatmahPlan, dayKey(new Date())) : null;
  const khatmahRange =
    khatmahPlan && khatmahDayIndex !== null
      ? pageRangeForDay(khatmahPlan, khatmahDayIndex, JUZ_START_PAGES, MUSHAF_TOTAL_PAGES)
      : null;
  const khatmahTotal = khatmahRange ? khatmahRange.to - khatmahRange.from + 1 : 0;
  const khatmahPos = khatmahRange
    ? Math.min(Math.max(page - khatmahRange.from + 1, 0), khatmahTotal)
    : 0;

  function go(next: number) {
    if (next < 1 || next > MUSHAF_TOTAL_PAGES) return;
    setPageOverride(next);
  }

  function jump() {
    const n = Number(jumpText);
    if (Number.isFinite(n)) go(Math.min(MUSHAF_TOTAL_PAGES, Math.max(1, Math.round(n))));
    setJumpText('');
  }

  function setStyle(style: MushafStyle) {
    if (style !== settings.mushafStyle) update({ mushafStyle: style });
  }

  function cycleFontSize() {
    const idx = FONT_SIZE_ORDER.indexOf(settings.quranFontSize);
    update({ quranFontSize: FONT_SIZE_ORDER[(idx + 1) % FONT_SIZE_ORDER.length] });
  }

  // Schriftgrad/Zeilenhöhe auf die gewählte Koran-Schrift umgerechnet: jede
  // Schrift hat eine andere natürliche Zeilenbox, zu enge Zeilen schneiden die
  // hohen Koran-Zeichen oben ab (features/quran/fonts.ts).
  // Das IndoPak-Schriftbild braucht Buchstaben (ک ھ ہ ی ے), die zwei der acht
  // Schriften nicht haben — dort wird auf eine Schrift ausgewichen, die sie hat.
  const effektiveSchrift = quranFontForScript(settings.quranFont, settings.mushafStyle);
  const quranFont = useQuranFont(effektiveSchrift.id);
  const schriftErsetzt = effektiveSchrift.id !== quranFontDef(settings.quranFont).id;
  const { fontSize, lineHeight } = quranFont.metrics(
    PAGE_FONT_SIZES[settings.quranFontSize],
    PAGE_LINE_HEIGHTS[settings.quranFontSize],
  );
  const pageTextStyle = [styles.pageText, quranFont.style];

  // Ausgelagert aus der Einzelseiten-Ansicht, damit die Doppelseiten-Ansicht
  // (Task #62) dieselbe Vers-Darstellung (Sure-Header, Wort-Tap, Übersetzung,
  // Vers-Rezitation) für zwei unabhängige Seiten wiederverwenden kann, statt
  // das Options-Sheet-Muster bzw. die Renderlogik zu duplizieren.
  function renderGroups(groups: MushafSurahGroup[]) {
    return groups.map((group) => {
      const meta = surahMeta.get(group.surah);
      const reading = readingBySurah.get(group.surah);
      const perVerseBlocks = wordInfoOn || showTranslation;
      return (
        <View key={group.surah} style={styles.group}>
          {group.verses[0]?.ayah === 1 && (
            <ThemedView
              type="backgroundElement"
              style={[styles.surahHeader, sepia && { backgroundColor: SEPIA_CARD }]}>
              <ThemedText type="subtitle" sepia={sepia} style={styles.surahHeaderText}>
                {meta?.name ?? `${group.surah}`}
              </ThemedText>
              {meta && (
                <ThemedText type="small" themeColor="textSecondary" sepia={sepia} style={styles.surahHeaderText}>
                  {group.surah}. {meta.englishName} · {surahNameTranslation(group.surah, locale, meta.englishNameTranslation)} · {meta.numberOfAyahs}{' '}
                  {t('quran.verses')}
                </ThemedText>
              )}
              {group.surah !== 1 && group.surah !== 9 && (
                <ThemedText
                  themeColor="textSecondary"
                  sepia={sepia}
                  style={[styles.basmala, quranFont.style]}>
                  {quranFont.text(BASMALA)}
                </ThemedText>
              )}
            </ThemedView>
          )}
          {perVerseBlocks
            ? group.verses.map((v) => {
                const ayahReading = reading?.ayahs.find((a) => a.numberInSurah === v.ayah);
                // Seiten-Wiedergabe (Play-Button): der gerade rezitierte Vers
                // wird golden hervorgehoben, analog zum wortsynchronen
                // Highlighting im normalen Sure-Reader.
                const isActive =
                  activePlaylistVerse?.surah === group.surah && activePlaylistVerse?.ayah === v.ayah;
                return (
                  <View key={v.ayah} style={[styles.verseBlock, isActive && styles.verseActive]}>
                    <ThemedText sepia={sepia} style={[pageTextStyle, { fontSize, lineHeight }]}>
                      {verseWords(v).map((w, wi) => (
                        <ThemedText
                          key={wi}
                          sepia={sepia}
                          onPress={() => setSelectedWord(w)}
                          accessibilityRole="button"
                          accessibilityLabel={t('quran.wordInfo.title')}
                          style={[pageTextStyle, { fontSize, lineHeight }]}>
                          {quranFont.text(w.arabic)}{' '}
                        </ThemedText>
                      ))}
                      <ThemedText
                        sepia={sepia}
                        onPress={() => playPageVerse(group.surah, v.ayah)}
                        accessibilityRole={ayahReading?.audio ? 'button' : undefined}
                        accessibilityLabel={t('quran.mushafPlayAyah')}
                        style={[pageTextStyle, { fontSize, lineHeight }, styles.ayahMarker]}>
                        {`${v.sajda ? '۩ ' : ''}${ayahMarker(quranFont.def, toArabicDigits(v.ayah))}`}
                      </ThemedText>
                    </ThemedText>
                    {showTranslation && ayahReading?.translation && (
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        sepia={sepia}
                        style={
                          isRtlLanguageCode(currentTranslationEdition?.language)
                            ? styles.verseTranslationRtl
                            : styles.verseTranslation
                        }>
                        {ayahReading.translation}
                      </ThemedText>
                    )}
                  </View>
                );
              })
            : (
                <ThemedText sepia={sepia} style={[pageTextStyle, { fontSize, lineHeight }]}>
                  {group.verses.map((v) => {
                    const audioUrl = reading?.ayahs.find((a) => a.numberInSurah === v.ayah)?.audio;
                    const isActive =
                      activePlaylistVerse?.surah === group.surah && activePlaylistVerse?.ayah === v.ayah;
                    return (
                      <ThemedText
                        key={v.ayah}
                        sepia={sepia}
                        style={[pageTextStyle, { fontSize, lineHeight }, isActive && styles.pageVerseActive]}>
                        {verseWords(v).map((w, wi) => (
                          <ThemedText
                            key={wi}
                            sepia={sepia}
                            onPress={() => setSelectedWord(w)}
                            accessibilityRole="button"
                            accessibilityLabel={t('quran.wordInfo.title')}
                            style={[pageTextStyle, { fontSize, lineHeight }]}>
                            {quranFont.text(w.arabic)}{' '}
                          </ThemedText>
                        ))}
                        {v.sajda && (
                          <ThemedText sepia={sepia} style={[pageTextStyle, { fontSize, lineHeight }]}>
                            {'۩ '}
                          </ThemedText>
                        )}
                        <ThemedText
                          sepia={sepia}
                          onPress={() => playPageVerse(group.surah, v.ayah)}
                          accessibilityRole={audioUrl ? 'button' : undefined}
                          accessibilityLabel={t('quran.mushafPlayAyah')}
                          style={[pageTextStyle, { fontSize, lineHeight }, styles.ayahMarker]}>
                          {`${ayahMarker(quranFont.def, toArabicDigits(v.ayah))} `}
                        </ThemedText>
                      </ThemedText>
                    );
                  })}
                </ThemedText>
              )}
        </View>
      );
    });
  }

  return (
    <ThemedView style={[styles.container, sepia && { backgroundColor: SEPIA_BG }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => backOr('/quran')}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={[styles.backChip, sepia && { backgroundColor: SEPIA_CARD }]}>
              <IconSymbol name="chevron-back" size={16} color={cardColors.text} />
            </ThemedView>
          </Pressable>
          <View style={styles.headerText}>
            <ThemedText type="subtitle" sepia={sepia} numberOfLines={1}>
              {t('quran.mushafTitle')}
            </ThemedText>
            {data && (
              <ThemedText type="small" themeColor="textSecondary" sepia={sepia} numberOfLines={1}>
                {/* ⁦…⁩ (LRI/PDI) erzwingen aufsteigende Ziffernfolge "603–604" auch im
                    arabischen (RTL) Interface — zwei bloße, nur durch Gedankenstrich getrennte
                    Zahlen würden sonst vom Unicode-Bidi-Algorithmus visuell vertauscht. */}
                {t('quran.mushafPage')} {wide ? `⁦${rightPage}–${leftPage}⁩` : page} / {MUSHAF_TOTAL_PAGES}{' '}
                · {t('quran.juz')} {data.juz}
                {khatmahRange ? ` · ${t('khatmah.title')} ${khatmahPos}/${khatmahTotal}` : ''}
              </ThemedText>
            )}
          </View>
          <Pressable
            onPress={togglePagePlayback}
            disabled={!pageHasAudio}
            accessibilityRole="button"
            accessibilityLabel={pagePlayer.playing ? t('quran.pause') : t('quran.mushafPlayPage')}
            accessibilityState={{ disabled: !pageHasAudio, selected: pagePlayer.playing }}
            style={({ pressed }) => [
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
              !pageHasAudio && styles.navDisabled,
            ]}>
            <ThemedView
              type={pagePlayer.playing ? 'backgroundSelected' : 'backgroundElement'}
              style={[styles.backChip, sepia && { backgroundColor: SEPIA_CARD }]}>
              <IconSymbol
                name={pagePlayer.playing ? 'pause' : 'play'}
                size={18}
                color={pagePlayer.playing ? cardColors.accent : cardColors.text}
              />
            </ThemedView>
          </Pressable>
          <Pressable
            onPress={() => setOptionsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('quran.viewSettings')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={[styles.backChip, sepia && { backgroundColor: SEPIA_CARD }]}>
              <IconSymbol name="options-outline" size={18} color={cardColors.text} />
            </ThemedView>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.juzBar}
          contentContainerStyle={styles.juzBarContent}>
          {JUZ_START_PAGES.map((startPageNr, i) => {
            const juzNr = i + 1;
            const active = data?.juz === juzNr;
            return (
              <Pressable
                key={juzNr}
                onPress={() => go(startPageNr)}
                accessibilityRole="button"
                accessibilityLabel={`${t('quran.juz')} ${juzNr}`}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView
                  type={active ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.juzChip, sepia && { backgroundColor: SEPIA_CARD }]}>
                  <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'} sepia={sepia}>
                    {juzNr}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </ScrollView>

        <Modal
          visible={optionsOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setOptionsOpen(false)}>
          <Pressable
            style={styles.sheetBackdrop}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.close')}
            onPress={() => setOptionsOpen(false)}
          />
          <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
            <View style={[styles.sheetHandle, { backgroundColor: colors.textSecondary }]} />
            <Pressable
              onPress={() => setOptionsOpen(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
              style={styles.sheetDone}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('common.done')}
              </ThemedText>
            </Pressable>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetSection}>
                {t('quran.viewSettings')}
              </ThemedText>
              <View style={styles.pickerRow}>
                <Pressable
                  onPress={() => setWordInfoOn((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: wordInfoOn }}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type={wordInfoOn ? 'backgroundSelected' : 'backgroundElement'} style={[styles.chip, styles.chipRow]}>
                    <IconSymbol name="grid-outline" size={13} color={wordInfoOn ? colors.accent : colors.text} />
                    <ThemedText type="small" themeColor={wordInfoOn ? 'accent' : 'text'}>
                      {t('quran.mushafWordInfo')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                {(['uthmani', 'indopak'] as const).map((style) => (
                  <Pressable
                    key={style}
                    onPress={() => setStyle(style)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: settings.mushafStyle === style }}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                    <ThemedView
                      type={settings.mushafStyle === style ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.chip}>
                      <ThemedText type="small" themeColor={settings.mushafStyle === style ? 'accent' : 'text'}>
                        {t(style === 'uthmani' ? 'quran.mushafUthmani' : 'quran.mushafIndopak')}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
                {/* Ehrlich sagen, warum hier eine andere Schrift steht als
                    eingestellt — sonst wirkt es wie ein Fehler. */}
                {schriftErsetzt && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.schriftHinweis}>
                    {t('quran.mushafFontFallback').replace('{{font}}', effektiveSchrift.name)}
                  </ThemedText>
                )}
                <Pressable
                  onPress={cycleFontSize}
                  accessibilityRole="button"
                  accessibilityLabel={t('quran.fontSize')}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type="backgroundElement" style={[styles.chip, styles.chipRow]}>
                    <IconSymbol name="resize-outline" size={13} color={colors.text} />
                    <ThemedText type="small">{t(FONT_SIZE_LABEL_KEYS[settings.quranFontSize])}</ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable
                  onPress={() => update({ readerSepia: !sepia })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sepia }}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type={sepia ? 'backgroundSelected' : 'backgroundElement'} style={[styles.chip, styles.chipRow]}>
                    <IconSymbol name="color-palette-outline" size={13} color={sepia ? colors.accent : colors.text} />
                    <ThemedText type="small" themeColor={sepia ? 'accent' : 'text'}>
                      {t('quran.sepia')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable
                  onPress={() => setPickerOpen('reciter')}
                  accessibilityRole="button"
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type="backgroundElement" style={[styles.chip, styles.chipRow]}>
                    <IconSymbol name="mic" size={13} color={colors.text} />
                    <ThemedText type="small">{currentReciterName}</ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable
                  onPress={() => setShowTranslation((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: showTranslation }}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type={showTranslation ? 'backgroundSelected' : 'backgroundElement'} style={[styles.chip, styles.chipRow]}>
                    <IconSymbol name="globe" size={13} color={showTranslation ? colors.accent : colors.text} />
                    <ThemedText type="small" themeColor={showTranslation ? 'accent' : 'text'}>
                      {t('quran.translation')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                {showTranslation && (
                  <Pressable
                    onPress={() => setPickerOpen('translation')}
                    accessibilityRole="button"
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                    <ThemedView type="backgroundElement" style={styles.chip}>
                      <ThemedText type="small">{currentTranslationName}</ThemedText>
                    </ThemedView>
                  </Pressable>
                )}
              </View>

              {khatmahRange && khatmahDayIndex !== null && (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetSection}>
                    {t('khatmah.title')}
                  </ThemedText>
                  <View style={styles.khatmahRow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('khatmah.day')} {khatmahDayIndex + 1} · {t('quran.mushafPage')} {khatmahPos}/{khatmahTotal}
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        go(khatmahRange.from);
                        setOptionsOpen(false);
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                      <ThemedView type="backgroundSelected" style={styles.chip}>
                        <ThemedText type="smallBold" themeColor="accent">
                          {t('quran.khatmahGoTo')}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </ThemedView>
        </Modal>

        <WordInfoSheet
          visible={selectedWord !== null}
          word={selectedWord}
          loading={selectedWord !== null && spreadLoading}
          error={selectedWord !== null && spreadError}
          onClose={() => setSelectedWord(null)}
        />

        <EditionPicker
          visible={pickerOpen === 'reciter'}
          title={t('quran.chooseReciter')}
          editions={audioEditions.data ?? []}
          recommended={RECOMMENDED_RECITERS}
          selected={settings.quranReciter}
          onSelect={(id) => {
            update({ quranReciter: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'translation'}
          title={t('quran.chooseTranslation')}
          editions={translationEditions.data ?? []}
          recommended={RECOMMENDED_TRANSLATIONS}
          selected={settings.quranTranslation}
          onSelect={(id) => {
            update({ quranTranslation: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />

        {page === 0 || spreadLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={cardColors.accent} />
          </View>
        ) : spreadError ? (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
              {t('quran.loadError')}
            </ThemedText>
            <Pressable
              onPress={() => {
                refetch();
                if (wide) dataPartner.refetch();
              }}
              accessibilityRole="button">
              <ThemedView type="backgroundSelected" style={[styles.retryBtn, sepia && { backgroundColor: SEPIA_CARD }]}>
                <ThemedText type="smallBold" themeColor="accent" sepia={sepia}>
                  {t('common.retry')}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        ) : wide ? (
          // Doppelseiten-Ansicht (Task #62): rechte Seite = niedrigere
          // Seitenzahl (Mushaf-Konvention, RTL-Blätterrichtung) — Spalten
          // werden links→rechts deklariert, damit die niedrigere Nummer
          // unabhängig von der Textrichtung des Containers rechts erscheint.
          <ScrollView
            key={`spread-${rightPage}-${leftPage}-${settings.mushafStyle}`}
            contentContainerStyle={styles.scrollWide}>
            <View style={styles.spreadRow}>
              <View style={styles.pageColumn}>
                <ThemedText type="small" themeColor="textSecondary" sepia={sepia} style={styles.pageColumnLabel}>
                  {leftPage}
                </ThemedText>
                {renderGroups(leftData?.groups ?? [])}
              </View>
              <View style={styles.pageColumn}>
                <ThemedText type="small" themeColor="textSecondary" sepia={sepia} style={styles.pageColumnLabel}>
                  {rightPage}
                </ThemedText>
                {renderGroups(rightData?.groups ?? [])}
              </View>
            </View>

            <View style={styles.pageNav}>
              {/* Im Mushaf liest man von rechts nach links — nächster Spread links */}
              <Pressable
                onPress={() => go(rightPage + 2)}
                disabled={leftPage >= MUSHAF_TOTAL_PAGES}
                accessibilityRole="button"
                accessibilityLabel={t('quran.mushafNext')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.navBtn, sepia && { backgroundColor: SEPIA_CARD }, leftPage >= MUSHAF_TOTAL_PAGES && styles.navDisabled]}>
                  <IconSymbol name="chevron-back" size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
              <View style={styles.jumpRow}>
                <TextInput
                  value={jumpText}
                  onChangeText={setJumpText}
                  onSubmitEditing={jump}
                  keyboardType="number-pad"
                  placeholder={String(page)}
                  placeholderTextColor={cardColors.textSecondary}
                  accessibilityLabel={t('quran.mushafGoTo')}
                  style={[styles.jumpInput, { color: cardColors.text, borderColor: cardColors.textSecondary }]}
                />
                <Pressable
                  onPress={jump}
                  accessibilityRole="button"
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                  <ThemedView type="backgroundSelected" style={[styles.goBtn, sepia && { backgroundColor: SEPIA_CARD }]}>
                    <ThemedText type="smallBold" themeColor="accent" sepia={sepia}>
                      {t('quran.mushafGoTo')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </View>
              <Pressable
                onPress={() => go(rightPage - 2)}
                disabled={rightPage <= 1}
                accessibilityRole="button"
                accessibilityLabel={t('quran.mushafPrev')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.navBtn, sepia && { backgroundColor: SEPIA_CARD }, rightPage <= 1 && styles.navDisabled]}>
                  <IconSymbol name="chevron-forward" size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <ScrollView key={`${page}-${settings.mushafStyle}`} contentContainerStyle={styles.scroll}>
            {renderGroups(data?.groups ?? [])}

            <View style={styles.pageNav}>
              {/* Im Mushaf liest man von rechts nach links — nächste Seite links */}
              <Pressable
                onPress={() => go(page + 1)}
                disabled={page >= MUSHAF_TOTAL_PAGES}
                accessibilityRole="button"
                accessibilityLabel={t('quran.mushafNext')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.navBtn, sepia && { backgroundColor: SEPIA_CARD }, page >= MUSHAF_TOTAL_PAGES && styles.navDisabled]}>
                  <IconSymbol name="chevron-back" size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
              <View style={styles.jumpRow}>
                <TextInput
                  value={jumpText}
                  onChangeText={setJumpText}
                  onSubmitEditing={jump}
                  keyboardType="number-pad"
                  placeholder={String(page)}
                  placeholderTextColor={cardColors.textSecondary}
                  accessibilityLabel={t('quran.mushafGoTo')}
                  style={[styles.jumpInput, { color: cardColors.text, borderColor: cardColors.textSecondary }]}
                />
                <Pressable
                  onPress={jump}
                  accessibilityRole="button"
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                  <ThemedView type="backgroundSelected" style={[styles.goBtn, sepia && { backgroundColor: SEPIA_CARD }]}>
                    <ThemedText type="smallBold" themeColor="accent" sepia={sepia}>
                      {t('quran.mushafGoTo')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </View>
              <Pressable
                onPress={() => go(page - 1)}
                disabled={page <= 1}
                accessibilityRole="button"
                accessibilityLabel={t('quran.mushafPrev')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.navBtn, sepia && { backgroundColor: SEPIA_CARD }, page <= 1 && styles.navDisabled]}>
                  <IconSymbol name="chevron-forward" size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two + BackChipInset },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  backChip: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0, gap: 1 },
  juzBar: { flexGrow: 0, marginBottom: Spacing.one },
  juzBarContent: { gap: Spacing.one, paddingHorizontal: Spacing.three },
  juzChip: {
    minWidth: 40,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  retryBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: 999 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(11,11,13,0.45)' },
  sheet: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    marginBottom: Spacing.two,
  },
  sheetDone: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  sheetContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  sheetSection: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.three,
  },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipPressed: { opacity: 0.6 },
  khatmahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  scroll: {
    padding: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  // Doppelseiten-Ansicht (Task #62): breiterer Rahmen als die Einzelseite,
  // damit beide Spalten genug Platz für Fließtext behalten.
  scrollWide: {
    padding: Spacing.four,
    paddingTop: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth * 2,
  },
  spreadRow: { flexDirection: 'row', gap: Spacing.five, alignItems: 'flex-start' },
  pageColumn: { flex: 1, minWidth: 0, gap: Spacing.three },
  pageColumnLabel: { textAlign: 'center', opacity: 0.6, marginBottom: Spacing.one },
  group: { gap: Spacing.two },
  surahHeader: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  surahHeaderText: { textAlign: 'center' },
  basmala: { fontSize: 20, lineHeight: 36, textAlign: 'center' },
  // fontFamily kommt zur Laufzeit aus useQuranFont() (einstellbare Schrift).
  pageText: { textAlign: 'right', writingDirection: 'rtl' },
  ayahMarker: { opacity: 0.7 },
  schriftHinweis: { width: '100%', paddingTop: Spacing.one },
  verseBlock: { gap: 2, borderRadius: Spacing.two },
  // Seiten-Wiedergabe: Hervorhebung des gerade rezitierten Verses — in der
  // Block-Ansicht als Hintergrund (View), im Fließtext als Text-Hintergrund
  // (Text unterstützt in RN backgroundColor als Inline-Highlight).
  verseActive: { backgroundColor: 'rgba(212,175,55,0.14)' },
  pageVerseActive: { backgroundColor: 'rgba(212,175,55,0.30)', borderRadius: 6 },
  verseTranslation: { textAlign: 'left', writingDirection: 'ltr' },
  verseTranslationRtl: { textAlign: 'right', writingDirection: 'rtl' },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  navBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navDisabled: { opacity: 0.3 },
  jumpRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  jumpInput: {
    minWidth: 64,
    textAlign: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  goBtn: { paddingVertical: 8, paddingHorizontal: Spacing.two, borderRadius: 999 },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});

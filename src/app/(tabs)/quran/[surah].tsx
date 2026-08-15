import { useSsrSafeAudioPlayer } from '@/lib/ssrSafeAudio';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard, stopNestedPressBubble } from '@/components/ui/pressable-card';
import { ShareCardModal } from '@/components/share-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { recognitionAvailable } from '@/features/hifz/speech';
import { whisperSupported } from '@/features/hifz/whisperCheck';
import { wordToIsolatedForms } from '@/features/learn/letters';
import { EditionPicker, editionDisplayName } from '@/features/quran/EditionPicker';
import {
  BASMALA,
  BEST_TAFSIRS,
  fetchAyahAudio,
  RECOMMENDED_RECITERS,
  RECOMMENDED_TRANSLATIONS,
  segmentMatchesPulseColor,
  TAJWEED_COLORS,
  wordSyncRecitationId,
} from '@/features/quran/api';
import {
  useAudioEditions,
  useSurahList,
  useSurahReading,
  useSurahSecondTranslation,
  useSurahSegments,
  useSurahTafsir,
  useSurahTajweed,
  useSurahTransliteration,
  useSurahWordByWord,
  useTafsirEditions,
  useTranslationEditions,
} from '@/features/quran/hooks';
import { crossSurahCompletionLeg, crossSurahLegEndIndex, type CrossSurahLeg, type CrossSurahTarget } from '@/features/quran/crossSurahQueue';
import { useOfflineAudio } from '@/features/quran/offline-audio';
import { getNoteText, isBookmarked, useQuranProgress } from '@/features/quran/progress';
import { surahNameTranslation } from '@/features/quran/surahNames';
import { SurahRangePicker } from '@/features/quran/SurahRangePicker';
import { toggleTafsirSelection } from '@/features/quran/tafsirSelection';
import { useAyahPlayer, useComparePlayer, useSharedPlayer } from '@/features/quran/usePlayer';
import { canShareVerseImage, shareVerseImage } from '@/features/quran/shareImage';
import { useShareCard } from '@/features/share/useShareCard';
import { WordInfoSheet } from '@/features/quran/WordInfoSheet';
import { getGermanWordGlosses, hasGermanWordByWord } from '@/features/quran/wbw-de';
import { useSettings } from '@/features/settings/store';
import { PLAYBACK_SPEED_OPTIONS } from '@/features/settings/types';
import { useHydrated } from '@/hooks/use-hydrated';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { splitArabicWords } from '@/lib/arabicText';
import { quranAyahDeepLink } from '@/lib/deepLinks';
import { useTranslation } from '@/lib/i18n';
import { isRtlLanguageCode } from '@/lib/locale-detect';
import { backOr } from '@/lib/nav';
import { useRtl } from '@/hooks/use-rtl';

const ARABIC_FONT_SIZES = { small: 16, medium: 20, large: 26, xlarge: 32 } as const;
const ARABIC_LINE_HEIGHTS = { small: 28, medium: 34, large: 42, xlarge: 50 } as const;
// Wort-für-Wort-Zeile: fester, kleinerer Grad (unabhängig vom Vers-Schriftgrad).
const WORD_ARABIC_FONT_SIZE = 18;
const WORD_ARABIC_LINE_HEIGHT = 26;

// Seitenmodus (Task #66): feste Vers-Anzahl pro "Seite" statt Scroll —
// bewusst simpel gehalten (keine Messung der tatsächlichen gerenderten Höhe
// pro Vers, die stark je nach aktivierten Zusatzansichten wie Wort-für-Wort/
// Tafsir variiert). Anders als der Mushaf sind das normale Verse, keine
// Druckseiten-Daten.
const AYAHS_PER_READER_PAGE = 8;

// Gruppierte Legende statt aller 15 Rohklassen — für eine kompakte,
// verständliche UI-Anzeige. Farben stammen direkt aus TAJWEED_COLORS.
const TAJWEED_LEGEND: { color: string; labelKey: string }[] = [
  { color: TAJWEED_COLORS.ghunnah, labelKey: 'quran.tajweedLegend.ghunnah' },
  { color: TAJWEED_COLORS.idgham_wo_ghunnah, labelKey: 'quran.tajweedLegend.idgham' },
  { color: TAJWEED_COLORS.ikhafa, labelKey: 'quran.tajweedLegend.ikhafa' },
  { color: TAJWEED_COLORS.iqlab, labelKey: 'quran.tajweedLegend.iqlab' },
  { color: TAJWEED_COLORS.qalaqah, labelKey: 'quran.tajweedLegend.qalqalah' },
  { color: TAJWEED_COLORS.madda_obligatory, labelKey: 'quran.tajweedLegend.madd' },
  { color: TAJWEED_COLORS.slnt, labelKey: 'quran.tajweedLegend.silent' },
];

// Tajwid-Übungsmodus: eine Legende-Farbe antippen lässt alle gleichfarbigen
// Segmente auf der Seite 3× kurz aufblitzen (~2,1s, im gewünschten
// 2-3-Sekunden-Rahmen), danach zurück zur normalen Deckkraft.
const PULSE_FLASH_MS = 350;
const PULSE_REPEATS = 3;

/** Ein einzelnes Tajwid-Textsegment, das bei aktivem pulseToken > 0 pulsiert.
 * Nested <Text> statt <View>, weil Geschwister-Segmente innerhalb desselben
 * arabischen Verses als EIN Fließtext (RTL-Bidi) gerendert werden müssen. */
function TajweedSegmentText({ text, color, pulseToken }: { text: string; color?: string; pulseToken: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (pulseToken > 0) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: PULSE_FLASH_MS }),
          withTiming(1, { duration: PULSE_FLASH_MS }),
        ),
        PULSE_REPEATS,
        false,
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 150 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseToken]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.Text style={[color ? { color } : undefined, animatedStyle]}>{text}</Animated.Text>;
}

// Jede weitere Sure-Etappe der suren-übergreifenden Abschnitts-Wiedergabe
// lädt als NEUE Screen-Instanz per router.replace (nicht push — sonst wächst
// der Back-Stack mit jeder durchlaufenen Sure, spürbar z. B. bei "ganzer
// Koran"). Die reine Entscheidungslogik ("welche Sure/welcher Vers kommt als
// Nächstes") sitzt getestet in crossSurahQueue.ts; hier nur der dünne
// Navigations-Wrapper. Ein rein internes Austauschen der Audio-Queue ohne
// Navigation würde NICHT reichen: `player.currentIndex` indiziert in die
// gerade gerenderte Versliste dieses Screens (Highlighting/Auto-Scroll) — die
// muss zur neuen Sure passen, sonst zeigt der Reader falsche Verse als
// "gerade spielend" an.
function goToCrossSurahLeg(leg: CrossSurahLeg, target: CrossSurahTarget) {
  router.replace({
    pathname: '/quran/[surah]',
    params: {
      surah: String(leg.surah),
      playFrom: String(leg.playFrom),
      crossEndSurah: String(target.endSurah),
      crossEndAyah: String(target.endAyah),
      crossLoop: target.loop ? '1' : '0',
      crossStartSurah: String(target.startSurah),
      crossStartAyah: String(target.startAyah),
    },
  });
}

export default function SurahReaderScreen() {
  // playFrom/crossEndSurah/crossEndAyah/crossLoop/crossStartSurah/crossStartAyah:
  // tragen eine Suren-übergreifende Abschnitts-Wiedergabe über den Suren-
  // Wechsel hinweg (s. crossSurahQueue.ts + goToCrossSurahLeg oben +
  // Autoplay-Effekt) — jede Etappe ist eine neue Screen-Instanz dieser Route
  // mit neuen Query-Params, weil `player.currentIndex` in die VERSLISTE
  // DIESES Screens indiziert (Highlighting/Scroll würden sonst falsch laufen,
  // s. Kommentar bei goToCrossSurahLeg).
  const {
    surah,
    ayah,
    playFrom: playFromParam,
    crossEndSurah: crossEndSurahParam,
    crossEndAyah: crossEndAyahParam,
    crossLoop: crossLoopParam,
    crossStartSurah: crossStartSurahParam,
    crossStartAyah: crossStartAyahParam,
  } = useLocalSearchParams<{
    surah: string;
    ayah?: string;
    playFrom?: string;
    crossEndSurah?: string;
    crossEndAyah?: string;
    crossLoop?: string;
    crossStartSurah?: string;
    crossStartAyah?: string;
  }>();
  const surahNumber = Number(surah);
  const targetAyah = ayah ? Number(ayah) : null;
  const crossSurahTarget: CrossSurahTarget | null =
    playFromParam && crossEndSurahParam && crossEndAyahParam && crossStartSurahParam && crossStartAyahParam
      ? {
          startSurah: Number(crossStartSurahParam),
          startAyah: Number(crossStartAyahParam),
          endSurah: Number(crossEndSurahParam),
          endAyah: Number(crossEndAyahParam),
          loop: crossLoopParam === '1',
        }
      : null;
  const { settings, update } = useSettings();
  const { t, locale } = useTranslation();
  const rtl = useRtl();
  // Gewählte Koran-Schrift: Familie + arabische OpenType-Merkmale + die auf
  // diese Schrift umgerechneten Maße (jede Schrift hat eine andere natürliche
  // Zeilenbox — zu enge Zeilen schneiden die hohen Koran-Zeichen ab,
  // s. features/quran/fonts.ts).
  const quranFont = useQuranFont();
  const arabicMetrics = quranFont.metrics(
    ARABIC_FONT_SIZES[settings.quranFontSize],
    ARABIC_LINE_HEIGHTS[settings.quranFontSize],
  );
  const wordArabicMetrics = quranFont.metrics(WORD_ARABIC_FONT_SIZE, WORD_ARABIC_LINE_HEIGHT);
  // Deutsche Wort-für-Wort-Glossen (nur für die Kernsuren gepflegt, s.
  // features/quran/wbw-de) — quran.com liefert die Wort-Bedeutung sonst NUR
  // auf Englisch. Nur relevant, wenn die App auf Deutsch läuft.
  const germanWbwAvailable = locale === 'de' && hasGermanWordByWord(surahNumber);
  const [pickerOpen, setPickerOpen] = useState<
    'reciter' | 'translation' | 'translation2' | 'tafsir' | 'compareA' | 'compareB' | null
  >(null);
  // Ansicht-&-Wiedergabe-Menü (Al-Quran-Muster): alle Optionen hinter EINEM
  // Button statt einer verankerten Chip-Wand über der Versliste.
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  // Fokus-Lesemodus: alles außer dem Verstext ausblenden (User-Vorschlag).
  const [focusMode, setFocusMode] = useState(false);
  // Seitenmodus (Task #66): Verse in feste Blöcke statt Endlos-Scroll —
  // Vor/Zurück blättert durch die Blöcke. Kombinierbar mit dem bestehenden
  // Fokus-Modus für eine ablenkungsfreie "Vollbild"-Blätter-Ansicht.
  const [readerMode, setReaderMode] = useState<'scroll' | 'page'>('scroll');
  const [pageIndex, setPageIndex] = useState(0);
  // Echtzeit-Mitlesen: Liste folgt automatisch dem gerade rezitierten Vers
  // (abschaltbar im Mini-Player, falls man beim Hören woanders liest).
  const [followAlong, setFollowAlong] = useState(true);
  // Suche innerhalb der Sure (Arabisch + Übersetzung), springt zum Treffer.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchPos, setMatchPos] = useState(0);
  const sepia = settings.readerSepia;
  const [rangeFrom, setRangeFrom] = useState(1);
  // Default folgt der Suren-Länge (wird nach dem Laden gesetzt) — vorher stand
  // hier fest 7, was in jeder längeren Sure als "Bis Vers 7" auftauchte.
  const [rangeTo, setRangeTo] = useState(7);
  const [rangeLoop, setRangeLoop] = useState(true);
  // Suren-übergreifende Abschnitts-Wiedergabe (Al-Quran-Parität): Start UND
  // Ende bestehen aus Sure+Vers statt nur Versnummern innerhalb der offenen
  // Sure — z. B. "Al-Fatiha Vers 1 bis Al-Baqara Vers 286". Default = die
  // gerade offene Sure (unverändertes Verhalten, solange nicht per
  // SurahRangePicker geändert); Reset beim Suren-Wechsel unten bei rangeFrom/-To.
  const [rangeFromSurah, setRangeFromSurah] = useState(surahNumber);
  const [rangeToSurah, setRangeToSurah] = useState(surahNumber);
  const [surahPickerFor, setSurahPickerFor] = useState<'from' | 'to' | null>(null);
  // Rezitatoren-Vergleich (Al-Quran-Parität): derselbe Vers A→B mit zwei
  // wählbaren Rezitatoren hintereinander abhören. Nutzt bewusst den "Von"-
  // Vers des bestehenden Abschnitts-Steppers als Referenzvers statt einem
  // eigenen dritten Stepper — spart UI-Duplikate, der Nutzer stellt den
  // gewünschten Vers ohnehin schon dort ein.
  const [compareReciterA, setCompareReciterA] = useState('ar.alafasy');
  const [compareReciterB, setCompareReciterB] = useState('ar.husary');
  const [compareLoading, setCompareLoading] = useState(false);
  const [showTafsir, setShowTafsir] = useState(false);
  const [showTransliteration, setShowTransliteration] = useState(false);
  const [showIsolatedLetters, setShowIsolatedLetters] = useState(false);
  const [showWordByWord, setShowWordByWord] = useState(false);
  const [showTajweed, setShowTajweed] = useState(false);
  // Anfänger-Modus-Preset (User-Wunsch: "jeder Anfänger soll perfekt Arabisch
  // lesen lernen können"): bündelt drei bereits bestehende, unabhängige
  // Toggles zu EINEM Tap statt drei separaten im Options-Sheet. Aktiv gilt
  // als "alle drei an" — erneutes Antippen schaltet alle drei wieder aus.
  const beginnerModeActive = showIsolatedLetters && showTransliteration && showWordByWord;
  const toggleBeginnerMode = () => {
    const next = !beginnerModeActive;
    setShowIsolatedLetters(next);
    setShowTransliteration(next);
    setShowWordByWord(next);
  };
  // Vers-Interpretations-Vergleich: zweite Übersetzung optional zusätzlich
  // einblenden, unabhängig von der Haupt-Übersetzung wählbar.
  const [showSecondTranslation, setShowSecondTranslation] = useState(false);
  // Tajwid-Übungsmodus: Legende antippen pulsiert alle gleichfarbigen
  // Vorkommen kurz auf. `token` erzwingt einen Animations-Neustart, auch wenn
  // dieselbe Regel erneut angetippt wird, während sie noch pulsiert.
  const [tajweedPulse, setTajweedPulse] = useState<{ color: string; token: number } | null>(null);
  const tajweedPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerTajweedPulse = useCallback((color: string) => {
    if (tajweedPulseTimer.current) clearTimeout(tajweedPulseTimer.current);
    setTajweedPulse((prev) => ({ color, token: (prev?.token ?? 0) + 1 }));
    tajweedPulseTimer.current = setTimeout(() => setTajweedPulse(null), PULSE_FLASH_MS * PULSE_REPEATS * 2 + 100);
  }, []);
  useEffect(
    () => () => {
      if (tajweedPulseTimer.current) clearTimeout(tajweedPulseTimer.current);
    },
    [],
  );
  const { bookmarks, notes, toggle, setLastRead, saveNote } = useQuranProgress();
  const [editingNoteAyah, setEditingNoteAyah] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Fokusmodus-Exit-Button ist absolut positioniert und liegt daher relativ
  // zum Rand von SafeAreaView, NICHT relativ zu dessen Padding-Box — die
  // SafeAreaView-Insets werden also ignoriert und der Button überlappt die
  // Statusleiste (dort de facto nicht antippbar). Insets separat holen und
  // dem Button addieren (Bugfix 2026-07-20, Audit Teil B).
  const insets = useSafeAreaInsets();
  // Sepia-aware Icon-/Steuerelement-Farben: dieselbe Logik wie ThemedText
  // (sepia erzwingt die helle Tinten-Palette) — für Elemente, die ihre Farbe
  // als rohen `color`-Prop brauchen (IconSymbol, TextInput) statt über
  // ThemedText/ThemedView zu laufen. Ohne das blieben Action-Icons (Lesezeichen/
  // Kopieren/Teilen/Mic/Notiz) und Kopfzeile/Mini-Player im Dark-Mode+Sepia
  // hell/weiß auf dem warmen Papierhintergrund und damit unlesbar (User-Fund
  // 2026-07-20, Nachtrag zum Sepia-Fix aus einer früheren Session).
  const cardColors = useTheme(sepia);
  const hydrated = useHydrated();
  // "Aufsagen prüfen" führt in den Hifz-Check — nur zeigen, wenn dort auch
  // eine Aufnahme-Engine verfügbar ist (Browser-ASR oder lokales Whisper).
  const reciteCheckAvailable =
    settings.speechExercisesEnabled && hydrated && (recognitionAvailable() || whisperSupported());
  const wordPlayer = useSsrSafeAudioPlayer(null);
  const playWord = useCallback(
    (audioUrl: string | null) => {
      if (!audioUrl) return;
      wordPlayer.replace(audioUrl);
      wordPlayer.play();
    },
    [wordPlayer],
  );
  // Wort-Lexikon (Task #55): Tippen auf ein Wort in der Wort-für-Wort-Zeile
  // öffnet ein Info-Sheet statt direkt die Audiodatei abzuspielen — das
  // Abspielen ist im Sheet weiterhin per Button möglich. `wordSheetUsed`
  // hält den Wort-für-Wort-Fetch dauerhaft an, sobald einmal getippt wurde,
  // auch wenn der Nutzer die Wort-für-Wort-Ansicht danach wieder ausschaltet.
  const [wordSheetUsed, setWordSheetUsed] = useState(false);
  const [selectedWordPos, setSelectedWordPos] = useState<{ ayahIndex: number; wordIndex: number } | null>(null);
  const listRef = useRef<FlatList>(null);
  // Signatur (surah:ayah) statt reinem Boolean: Expo Router mountet diesen
  // Screen bei einem Wechsel zwischen zwei Deep-Links auf verschiedene Suren
  // (z. B. zwei geteilte Vers-Links nacheinander antippen) NICHT neu, da beide
  // auf dasselbe Routen-Pattern "[surah]" matchen — ein reiner Boolean-Ref
  // blieb dadurch nach dem ersten Sprung für immer "true" und der zweite
  // Deep-Link scrollte nie zum Ziel-Vers (nur die Sure öffnete sich korrekt).
  const scrolledToTargetKey = useRef<string | null>(null);

  const { data, isLoading, isError } = useSurahReading(
    surahNumber,
    settings.quranTranslation,
    settings.quranReciter,
  );
  const { data: audioEditions } = useAudioEditions();
  const { data: translationEditions } = useTranslationEditions();

  // Anzeigenamen der gerade aktiven Übersetzungen, für die Fußzeile unter der
  // Vers-Liste (s. ListFooterComponent). `editionDisplayName` fängt die
  // Ausgaben ab, bei denen die Schnittstelle "Unknown" als englishName liefert.
  const uebersetzerZeilen = useMemo(() => {
    const zeilen: string[] = [];
    const finde = (id: string | undefined) =>
      id ? translationEditions?.find((e) => e.identifier === id) : undefined;
    const erste = finde(settings.quranTranslation);
    if (erste) zeilen.push(`${t('quran.translation')}: ${editionDisplayName(erste)}`);
    const zweite = showSecondTranslation ? finde(settings.quranTranslation2) : undefined;
    if (zweite) zeilen.push(`${t('quran.secondTranslation')}: ${editionDisplayName(zweite)}`);
    return zeilen;
  }, [translationEditions, settings.quranTranslation, settings.quranTranslation2, showSecondTranslation, t]);
  // Suren-Metadaten (Nummer + Namen + Vers-Anzahl) aller 114 Suren — Basis für
  // den Sure-Picker der Suren-übergreifenden Abschnitts-Wiedergabe unten.
  const { data: surahList } = useSurahList();
  // Abschnitts-Player: Bereich beim (Sure-)Laden auf die komplette Sure
  // stellen statt auf den alten Fatiha-Default 1-7. "State reset on prop
  // change" während des Renders (gleiches Muster wie quran/search.tsx),
  // kein Effect nötig.
  const ayahCount = data?.meta.numberOfAyahs;
  const [rangeInitKey, setRangeInitKey] = useState<number | null>(null);
  if (ayahCount && rangeInitKey !== surahNumber) {
    setRangeInitKey(surahNumber);
    setRangeFrom(1);
    setRangeTo(ayahCount);
    setRangeFromSurah(surahNumber);
    setRangeToSurah(surahNumber);
  }
  // Vers-Obergrenzen für die Von-/Bis-Stepper: für die gerade offene Sure aus
  // `ayahCount` (sofort verfügbar), für eine ANDERE gewählte Sure aus der
  // Suren-Metadatenliste (kann kurz nach Auswahl noch laden — 300 als sicherer
  // Fallback, größer als die längste Sure mit 286 Versen).
  const rangeFromAyahCount =
    rangeFromSurah === surahNumber ? (ayahCount ?? 300) : (surahList?.find((s) => s.number === rangeFromSurah)?.numberOfAyahs ?? 300);
  const rangeToAyahCount =
    rangeToSurah === surahNumber ? (ayahCount ?? 300) : (surahList?.find((s) => s.number === rangeToSurah)?.numberOfAyahs ?? 300);
  const rangeSurahDisplayName = (num: number): string => {
    if (num === surahNumber && data) return surahNameTranslation(num, locale, data.meta.englishNameTranslation);
    const meta = surahList?.find((s) => s.number === num);
    return meta ? surahNameTranslation(num, locale, meta.englishNameTranslation) : String(num);
  };
  const { data: tafsirEditions } = useTafsirEditions();
  // Feste Slots statt Schleife über eine dynamische Liste — Hooks dürfen nicht
  // bedingt/in variabler Anzahl aufgerufen werden. `enabled` gated pro Slot.
  const { data: tafsirTexts0 } = useSurahTafsir(
    surahNumber,
    settings.quranTafsirs[0] ?? '',
    showTafsir && !!settings.quranTafsirs[0],
  );
  const { data: tafsirTexts1 } = useSurahTafsir(
    surahNumber,
    settings.quranTafsirs[1] ?? '',
    showTafsir && !!settings.quranTafsirs[1],
  );
  const { data: tafsirTexts2 } = useSurahTafsir(
    surahNumber,
    settings.quranTafsirs[2] ?? '',
    showTafsir && !!settings.quranTafsirs[2],
  );
  const tafsirTextsBySlot = [tafsirTexts0, tafsirTexts1, tafsirTexts2];
  const { data: transliterationTexts } = useSurahTransliteration(surahNumber, showTransliteration);
  const { data: secondTranslationTexts } = useSurahSecondTranslation(
    surahNumber,
    settings.quranTranslation2,
    showSecondTranslation,
  );
  const {
    data: wordByWord,
    isLoading: wordByWordLoading,
    isError: wordByWordError,
  } = useSurahWordByWord(surahNumber, showWordByWord || wordSheetUsed);
  const { data: tajweedSegments } = useSurahTajweed(surahNumber, showTajweed);

  const offline = useOfflineAudio(settings.quranReciter, surahNumber);
  const { audioFor } = offline;
  // Wortsynchrones Highlighting: Wort-Zeitstempel gibt es für die meisten
  // Rezitatoren (Mapping in api.ts); die Zeitstempel gelten nur für die
  // verses.quran.com-Dateien, daher wechselt der Player im Sync-Fall dorthin.
  const syncRecitationId = wordSyncRecitationId(settings.quranReciter);
  const wordSyncEligible = syncRecitationId !== null;
  const { data: ayahSegments } = useSurahSegments(surahNumber, wordSyncEligible ? syncRecitationId : null);
  const ayahsForPlayer = useMemo(
    () =>
      data?.ayahs.map((a) => ({
        numberInSurah: a.numberInSurah,
        // audioFor() selbst bevorzugt bereits die LOKALE Datei, wenn die Sure
        // heruntergeladen ist (offline.downloaded) — die Sync-URL wird nur als
        // "remoteUrl"-Kandidat durchgereicht, falls NICHT heruntergeladen ist.
        // Vorher stand die Sync-URL VOR audioFor() (`... || audioFor(...)`),
        // wurde also auch bei heruntergeladener Sure immer zuerst versucht —
        // im Flugmodus schlug das lautlos fehl, obwohl "Offline ✓" anzeigte
        // (Bugfix 2026-07-20, Audit Teil B, s. auch Download-Button unten:
        // lädt bei Sync-fähigen Rezitatoren dieselbe Sync-Audiodatei herunter,
        // damit die Wort-Zeitstempel auch offline noch zur Datei passen).
        audio: audioFor(
          a.numberInSurah,
          (wordSyncEligible && ayahSegments?.[a.numberInSurah]?.audioUrl) || a.audio,
        ),
      })) ?? [],
    [data, audioFor, wordSyncEligible, ayahSegments],
  );
  // 100ms statt des expo-audio-Standards (500ms): Wort-Sync-Segmente können
  // nur 460-660ms lang sein, mit 500ms sprang das Highlighting sichtbar.
  // sharedPlayer statt eines lokalen Players (App-weiter Mini-Player, Audit
  // 2026-07-20 Punkt D): expo-audio gibt einen lokalen Player beim Unmount
  // des Screens frei, Wiedergabe stoppte bislang beim Verlassen der Sure.
  const sharedPlayer = useSharedPlayer();
  const player = useAyahPlayer(
    ayahsForPlayer,
    data?.meta.englishName ?? '',
    settings.quranPlaybackSpeed,
    100,
    sharedPlayer,
    { pathname: '/quran/[surah]', params: { surah: String(surahNumber) } },
  );
  // Wort-Sync-Rennen-Schutz (Audit 2026-07-20): useSurahSegments lädt async;
  // tippt der Nutzer sofort nach einem Sure-/Rezitator-Wechsel auf Play, BEVOR
  // die Zeitstempel da sind, startet playFrom() mit der NICHT-synchronen
  // Standard-Audiodatei (ayahsForPlayer fällt oben auf audioFor() zurück).
  // Treffen die Zeitstempel danach ein, ändert sich zwar ayahsForPlayer, aber
  // der bereits spielende native Track wird NICHT automatisch ersetzt — die
  // Zeitstempel gehören dann zu einer ANDEREN Aufnahme, ein Abgleich wäre
  // falsches statt nur ungenaues Highlighting. syncSourceReady friert daher
  // pro Abspiel-Session (= pro currentIndex-Wechsel) fest, ob die Sync-Quelle
  // zu diesem Zeitpunkt bereits geladen war. State-Ableitung während des
  // Renders (gleiches Muster wie rangeInitKey/pageIndexSurah oben) statt ein
  // Effekt mit setState im Body, den die Lint-Regel react-hooks/set-state-in-
  // effect zu Recht ablehnt (kaskadierende Re-Renders).
  const [syncSourceReady, setSyncSourceReady] = useState(false);
  const [syncCheckedIndex, setSyncCheckedIndex] = useState<number | null>(null);
  if (player.currentIndex !== syncCheckedIndex) {
    setSyncCheckedIndex(player.currentIndex);
    const ayahNr = player.currentIndex !== null ? data?.ayahs[player.currentIndex]?.numberInSurah : undefined;
    setSyncSourceReady(!!(wordSyncEligible && ayahNr && ayahSegments?.[ayahNr]?.audioUrl));
  }
  const cyclePlaybackSpeed = () => {
    const currentIdx = PLAYBACK_SPEED_OPTIONS.indexOf(settings.quranPlaybackSpeed);
    const next = PLAYBACK_SPEED_OPTIONS[(currentIdx + 1) % PLAYBACK_SPEED_OPTIONS.length];
    update({ quranPlaybackSpeed: next });
  };

  // Rezitatoren-Vergleich: lädt die Audio-URL des Referenzverses (rangeFrom-
  // Sure + -Vers) für beide gewählten Rezitatoren separat vom Reader-Player,
  // dann A→B nacheinander abspielen (useComparePlayer). Eigener Fetch statt
  // Wiederverwendung von data.ayahs, weil dort nur die Audio-URL des IM
  // READER aktuell gewählten Rezitators steckt — hier braucht es zwei
  // beliebige, unabhängig wählbare Rezitatoren für denselben Vers.
  const comparePlayer = useComparePlayer();
  const playCompareVerse = useCallback(async () => {
    setCompareLoading(true);
    try {
      const [urlA, urlB] = await Promise.all([
        fetchAyahAudio(rangeFromSurah, rangeFrom, compareReciterA),
        fetchAyahAudio(rangeFromSurah, rangeFrom, compareReciterB),
      ]);
      if (!urlA || !urlB) {
        Alert.alert(t('quran.compareLoadError'));
        return;
      }
      comparePlayer.playCompare(urlA, urlB);
    } catch {
      Alert.alert(t('quran.compareLoadError'));
    } finally {
      setCompareLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFromSurah, rangeFrom, compareReciterA, compareReciterB]);

  // Auto-Follow: beim Vers-Wechsel der Rezitation sanft mitscrollen.
  useEffect(() => {
    if (!followAlong || player.currentIndex === null) return;
    listRef.current?.scrollToIndex({ index: player.currentIndex, viewPosition: 0.25, animated: true });
  }, [followAlong, player.currentIndex]);

  // Direkter Einstieg bei ?ayah= (Weiterlesen, Juz, Lesezeichen, Deep-Link).
  useEffect(() => {
    if (!data || targetAyah === null) return;
    const key = `${surahNumber}:${targetAyah}`;
    if (scrolledToTargetKey.current === key) return;
    const index = data.ayahs.findIndex((a) => a.numberInSurah === targetAyah);
    if (index < 0) return;
    scrolledToTargetKey.current = key;
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: false });
    }, 100);
  }, [data, targetAyah, surahNumber]);

  // Autoplay-Einstieg für eine Sure-Etappe der suren-übergreifenden
  // Abschnitts-Wiedergabe (?playFrom=… + crossEndSurah/crossEndAyah/…, s.
  // crossSurahQueue.ts + goToCrossSurahLeg oben). `autoplaySig` ändert sich
  // bei jeder neuen Etappe (neue Query-Params durch router.replace) — der Ref
  // verhindert einen zweiten Start beim erneuten Rendern derselben Etappe
  // (z. B. durch andere State-Änderungen im Screen).
  const autoplaySig =
    data && playFromParam
      ? `${surahNumber}:${playFromParam}:${crossEndSurahParam ?? ''}:${crossEndAyahParam ?? ''}:${crossLoopParam ?? ''}`
      : null;
  const startedAutoplayRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !autoplaySig || !playFromParam) return;
    if (startedAutoplayRef.current === autoplaySig) return;
    startedAutoplayRef.current = autoplaySig;
    const fromIdx = Math.max(0, Number(playFromParam) - 1);
    const toIdx = crossSurahLegEndIndex(crossSurahTarget, surahNumber, fromIdx, data.ayahs.length - 1);
    player.playRange(fromIdx, toIdx, false, () => {
      if (!crossSurahTarget) return;
      const nextLeg = crossSurahCompletionLeg(crossSurahTarget, surahNumber);
      if (nextLeg) goToCrossSurahLeg(nextLeg, crossSurahTarget);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, autoplaySig]);

  // Beim Suren-Wechsel wieder auf die erste Seite springen — sonst zeigt der
  // Seitenmodus z.B. "Seite 4" einer viel kürzeren neuen Sure. State-Reset
  // während des Renderns (React-Pattern für "state ableiten, wenn sich eine
  // Prop ändert") statt useEffect, um keine Zusatz-Renderrunde zu erzwingen.
  // Number.isFinite-Guard ist Pflicht, nicht kosmetisch: NaN !== NaN ist in
  // JS immer true, darum wäre der Vergleich ohne Guard ein Endlos-Render-
  // Loop, sobald surahNumber NaN ist — genau der Fall bei der statisch
  // exportierten Route-Vorlage `/quran/[surah]` (Platzhalter-Segment ohne
  // generateStaticParams, `Number('[surah]')` = NaN). Der Loop wirft
  // serverseitig "Too many re-renders", was React in der von Expo Router
  // automatisch um jedes Routen-Segment gelegten Suspense-Boundary als
  // ungelöst markiert (leeres `<!--$!-->`-Server-HTML, Client-seitig
  // unsichtbar da dort surahNumber immer eine echte Zahl ist) — nachgewiesen
  // per renderToStaticMarkup-Reproduktion und Vorher/Nachher-HTML-Diff.
  const [pageIndexSurah, setPageIndexSurah] = useState(surahNumber);
  if (Number.isFinite(surahNumber) && surahNumber !== pageIndexSurah) {
    setPageIndexSurah(surahNumber);
    setPageIndex(0);
  }
  const totalReaderPages = data ? Math.max(1, Math.ceil(data.ayahs.length / AYAHS_PER_READER_PAGE)) : 1;
  const clampedPageIndex = Math.min(pageIndex, totalReaderPages - 1);
  const pageAyahs = data
    ? data.ayahs.slice(
        clampedPageIndex * AYAHS_PER_READER_PAGE,
        (clampedPageIndex + 1) * AYAHS_PER_READER_PAGE,
      )
    : [];
  const goToReaderPage = (next: number) => {
    if (next < 0 || next >= totalReaderPages) return;
    setPageIndex(next);
  };

  // Leseposition: oberster sichtbarer Vers zählt als "zuletzt gelesen".
  // setLastRead ist ein stabiler useCallback — darf direkt als Dep verwendet werden.
  const lastVisibleAyah = useRef<number | null>(null);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as { numberInSurah?: number } | undefined;
      if (first?.numberInSurah) lastVisibleAyah.current = first.numberInSurah;
    },
    [],
  );
  useEffect(() => {
    if (!Number.isFinite(surahNumber)) return;
    const interval = setInterval(() => {
      if (lastVisibleAyah.current) setLastRead(surahNumber, lastVisibleAyah.current);
    }, 5000);
    return () => {
      clearInterval(interval);
      if (lastVisibleAyah.current) setLastRead(surahNumber, lastVisibleAyah.current);
    };
  }, [surahNumber, setLastRead]);

  const shareAyah = useCallback(
    (item: { numberInSurah: number; arabic: string; translation: string }) => {
      const surahName = data?.meta.englishName ?? t('quran.surahN').replace('{n}', String(surahNumber));
      // Deep-Link mit anhängen (salatibox://quran/…?ayah=…, springt beim
      // Empfänger automatisch zum Vers): anders als beim Bild-Teilen (s.
      // shareCard-Kompromiss unten) gibt es hier KEINE Plattform-Einschränkung
      // — RN-Core-`Share.share` teilt reinen Text, der Link ist einfach Teil
      // der Message.
      Share.share({
        message: `${item.arabic}\n\n${item.translation}\n\n— ${surahName} ${surahNumber}:${item.numberInSurah}\n\n${quranAyahDeepLink(surahNumber, item.numberInSurah)}`,
      }).catch(() => {});
    },
    [data, surahNumber, t],
  );

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !data) return [];
    return data.ayahs
      .map((a, index) => ({ index, hit: a.translation.toLowerCase().includes(q) || a.arabic.includes(searchQuery.trim()) }))
      .filter((x) => x.hit)
      .map((x) => x.index);
  }, [data, searchQuery]);

  const jumpToMatch = useCallback(
    (pos: number) => {
      if (searchMatches.length === 0) return;
      const wrapped = ((pos % searchMatches.length) + searchMatches.length) % searchMatches.length;
      setMatchPos(wrapped);
      listRef.current?.scrollToIndex({ index: searchMatches[wrapped], viewPosition: 0.2, animated: true });
    },
    [searchMatches],
  );

  const copyAyah = useCallback(
    (item: { numberInSurah: number; arabic: string; translation: string }) => {
      const surahName = data?.meta.englishName ?? t('quran.surahN').replace('{n}', String(surahNumber));
      Clipboard.setStringAsync(
        `${item.arabic}\n\n${item.translation}\n\n— ${surahName} ${surahNumber}:${item.numberInSurah}`,
      ).catch(() => {});
    },
    [data, surahNumber, t],
  );

  // Web: eigene Canvas-Lösung (shareImage.ts, kein DOM-Canvas nativ verfügbar).
  // iOS/Android: Vorschau-Sheet + react-native-view-shot (shareCard.open).
  const shareCard = useShareCard();
  const shareAyahImage = useCallback(
    (item: { numberInSurah: number; arabic: string; translation: string }) => {
      const surahName = data?.meta.englishName ?? t('quran.surahN').replace('{n}', String(surahNumber));
      const source = `${surahName} ${surahNumber}:${item.numberInSurah}`;
      const deepLink = quranAyahDeepLink(surahNumber, item.numberInSurah);
      if (canShareVerseImage) {
        shareVerseImage({ arabic: item.arabic, translation: item.translation, source, deepLink }).catch(() => {});
      } else {
        shareCard.open({ arabic: item.arabic, translation: item.translation, source, deepLink });
      }
    },
    [data, surahNumber, shareCard, t],
  );

  const currentReciterEdition = audioEditions?.find((e) => e.identifier === settings.quranReciter);
  const currentReciterName = currentReciterEdition
    ? editionDisplayName(currentReciterEdition)
    : settings.quranReciter;
  const currentTranslationEdition = translationEditions?.find(
    (e) => e.identifier === settings.quranTranslation,
  );
  const currentTranslationName = currentTranslationEdition
    ? editionDisplayName(currentTranslationEdition)
    : settings.quranTranslation;
  const currentTranslation2Edition = translationEditions?.find(
    (e) => e.identifier === settings.quranTranslation2,
  );
  const currentTranslation2Name = currentTranslation2Edition
    ? editionDisplayName(currentTranslation2Edition)
    : settings.quranTranslation2;

  // Aus FlatLists renderItem herausgezogen (Task #66 Seitenmodus): dieselbe
  // Vers-Karte wird jetzt sowohl vom Endlos-Scroll (FlatList) als auch von
  // der paginierten Blockansicht aufgerufen, statt die Darstellung zu
  // duplizieren. `index` bleibt immer der Index in der VOLLEN Verse-Liste
  // (data.ayahs), auch aus der Seiten-Ansicht heraus — Audio-Player,
  // Wort-Sync-Highlight und Wort-Info-Sheet referenzieren Verse über genau
  // diesen Index.
  function renderAyahCard(
    item: {
      arabic: string;
      translation: string;
      audio?: string;
      numberInSurah: number;
      sajda?: boolean;
      sajdaObligatory?: boolean;
    },
    index: number,
  ) {
    const bookmarked = isBookmarked(bookmarks, surahNumber, item.numberInSurah);
    const savedNote = getNoteText(notes, surahNumber, item.numberInSurah);
    const isEditingNote = editingNoteAyah === item.numberInSurah;
    // Deutsche Wort-Glossen für diesen Vers (nur wenn App = Deutsch UND Sure
    // gepflegt). Wird beim Rendern gegen die tatsächliche Wortanzahl geprüft;
    // bei Abweichung fällt jedes Wort sauber auf das englische Gloss zurück.
    const germanGlosses = germanWbwAvailable
      ? getGermanWordGlosses(surahNumber, item.numberInSurah)
      : undefined;
    return (
      <AnimatedListItem index={index % 12}>
        <PressableCard
          onPress={() => player.playFrom(index, false)}
          type={player.currentIndex === index ? 'backgroundSelected' : 'backgroundElement'}
          style={[styles.ayah, sepia && styles.sepiaCard]}>
          {!focusMode && (
          <View style={styles.ayahHeader}>
            <View style={styles.ayahNumberRow}>
              <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
                {item.numberInSurah}
              </ThemedText>
              {item.sajda && (
                <Pressable
                  onPress={(e) => {
                    stopNestedPressBubble(e);
                    Alert.alert(
                      t('quran.sajdaTitle'),
                      item.sajdaObligatory ? t('quran.sajdaHintObligatory') : t('quran.sajdaHintRecommended'),
                    );
                  }}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel={t('quran.sajdaTitle')}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedText type="small" themeColor="accent" sepia={sepia} style={styles.sajdaMark}>
                    {'۩'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <View style={styles.ayahActions}>
              <Pressable
                onPress={(e) => {
                  stopNestedPressBubble(e);
                  toggle(surahNumber, item.numberInSurah);
                }}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={bookmarked ? t('a11y.removeBookmark') : t('a11y.addBookmark')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <IconSymbol
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={bookmarked ? cardColors.accent : cardColors.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  stopNestedPressBubble(e);
                  copyAyah(item);
                }}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('quran.copyVerse')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <IconSymbol name="copy-outline" size={16} color={cardColors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  stopNestedPressBubble(e);
                  shareAyah(item);
                }}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.share')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <IconSymbol name="share-outline" size={16} color={cardColors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  stopNestedPressBubble(e);
                  shareAyahImage(item);
                }}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('quran.shareImage')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <IconSymbol name="image-outline" size={16} color={cardColors.textSecondary} />
              </Pressable>
              {reciteCheckAvailable && (
                <Pressable
                  onPress={(e) => {
                    stopNestedPressBubble(e);
                    router.push({
                      pathname: '/hifz/[surah]',
                      params: {
                        surah: String(surahNumber),
                        ayah: String(item.numberInSurah),
                        recite: '1',
                      },
                    });
                  }}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel={t('quran.reciteCheck')}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <IconSymbol name="mic-outline" size={16} color={cardColors.textSecondary} />
                </Pressable>
              )}
              <Pressable
                onPress={(e) => {
                  stopNestedPressBubble(e);
                  if (isEditingNote) {
                    saveNote(surahNumber, item.numberInSurah, noteDraft);
                    setEditingNoteAyah(null);
                  } else {
                    setNoteDraft(savedNote);
                    setEditingNoteAyah(item.numberInSurah);
                  }
                }}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.noteAyah')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <IconSymbol
                  name={isEditingNote || savedNote ? 'create' : 'create-outline'}
                  size={16}
                  color={isEditingNote || savedNote ? cardColors.accent : cardColors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
          )}
          <ThemedText
            type="default"
            sepia={sepia}
            style={[styles.arabic, quranFont.style, arabicMetrics]}>
            {showTajweed && tajweedSegments?.[index]
              ? tajweedSegments[index].map((seg, si) => (
                  <TajweedSegmentText
                    key={si}
                    text={quranFont.text(seg.text)}
                    color={seg.className ? TAJWEED_COLORS[seg.className] : undefined}
                    pulseToken={
                      tajweedPulse && segmentMatchesPulseColor(seg.className, tajweedPulse.color)
                        ? tajweedPulse.token
                        : 0
                    }
                  />
                ))
              : // Wort-Sync direkt im Haupttext (User-Wunsch: "immer jedes
                // Wort markieren, wenn es rezitiert wird") — beim gerade
                // spielenden Vers wird das aktive Wort golden hinterlegt.
                player.playing &&
                  player.currentIndex === index &&
                  syncSourceReady &&
                  ayahSegments?.[item.numberInSurah]?.segments.length
                ? (() => {
                    const activeWord =
                      ayahSegments[item.numberInSurah].segments.find(
                        (sg) => player.positionMs >= sg[2] && player.positionMs < sg[3],
                      )?.[0] ?? -1;
                    // splitArabicWords statt split(/\s+/): der Uthmani-Text hat
                    // allein stehende Waqf-Zeichen (z. B. "… رَيْبَ ۛ فِيهِ ۛ …"
                    // in 2:2). Als eigenes <Text> gerendert beginnt der Lauf mit
                    // einem Kombinationszeichen → die Engine setzt "◌" davor.
                    // Zweiter Effekt: quran.com zählt sie zum Wort davor, das
                    // naive Split lieferte ein Token mehr und verschob damit die
                    // Wort-Markierung für den Rest des Verses.
                    return splitArabicWords(quranFont.text(item.arabic)).map((w: string, wi: number) => (
                      <Text key={wi} style={wi === activeWord && styles.mainWordActive}>
                        {w}
                        {' '}
                      </Text>
                    ));
                  })()
                : quranFont.text(item.arabic)}
          </ThemedText>
          {/* Feste Stapel-Reihenfolge (Anfänger-Modus-Wunsch): verbundene Schrift →
              isolierte Buchstaben → Umschrift MÜSSEN unmittelbar aufeinander folgen,
              wenn alle drei aktiv sind. Wort-für-Wort deshalb bewusst NACH der
              Umschrift gerendert statt dazwischen. */}
          {showIsolatedLetters && (
            <ThemedText
              type="default"
              themeColor="accent"
              sepia={sepia}
              style={[styles.arabic, quranFont.style, wordArabicMetrics, styles.isolatedLetters]}>
              {quranFont.text(wordToIsolatedForms(item.arabic))}
            </ThemedText>
          )}
          {showTransliteration && transliterationTexts?.[index] && (
            <ThemedText type="small" themeColor="accent" sepia={sepia} style={styles.transliteration}>
              {transliterationTexts[index]}
            </ThemedText>
          )}
          {showWordByWord && wordByWord?.[index] && (
            <View style={styles.wordByWordRow}>
              {wordByWord[index].map((w, wi, words) => {
                // Deutsches Gloss NUR wenn die Wortanzahl exakt passt — sonst
                // wäre die Zuordnung verschoben, dann lieber Englisch.
                const gloss =
                  germanGlosses && germanGlosses.length === words.length ? germanGlosses[wi] : w.translation;
                // Aktives Wort während der Rezitation (Wort-Sync):
                // Segment [wortIdx, wortNr, startMs, endMs] gegen
                // die aktuelle Wiedergabeposition.
                const isActiveWord =
                  player.playing &&
                  player.currentIndex === index &&
                  syncSourceReady &&
                  (ayahSegments?.[item.numberInSurah]?.segments.find(
                    (s) => player.positionMs >= s[2] && player.positionMs < s[3],
                  )?.[0] ?? -1) === wi;
                return (
                  <Pressable
                    key={wi}
                    onPress={(e) => {
                      stopNestedPressBubble(e);
                      setWordSheetUsed(true);
                      setSelectedWordPos({ ayahIndex: index, wordIndex: wi });
                    }}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={t('quran.wordInfo.title')}
                    style={({ pressed }) => [
                      styles.wordColumn,
                      isActiveWord && styles.wordActive,
                      Platform.OS === 'web' ? styles.pressableWeb : undefined,
                      pressed && styles.chipPressed,
                    ]}>
                    <ThemedText type="default" sepia={sepia} style={[styles.wordArabic, quranFont.style, wordArabicMetrics]}>
                      {quranFont.text(w.arabic)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" sepia={sepia} style={styles.wordGloss}>
                      {gloss}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            sepia={sepia}
            style={
              isRtlLanguageCode(currentTranslationEdition?.language)
                ? styles.translationRtl
                : undefined
            }>
            {item.translation}
          </ThemedText>
          {showSecondTranslation && secondTranslationTexts?.[index] && (
            <ThemedView
              type="backgroundElement"
              style={[styles.secondTranslationBox, sepia && styles.sepiaCard]}>
              <ThemedText type="small" themeColor="accent" sepia={sepia} style={styles.secondTranslationLabel}>
                {currentTranslation2Name}
              </ThemedText>
              <ThemedText
                type="small"
                sepia={sepia}
                style={
                  isRtlLanguageCode(currentTranslation2Edition?.language)
                    ? styles.translationRtl
                    : undefined
                }>
                {secondTranslationTexts[index]}
              </ThemedText>
            </ThemedView>
          )}
          {isEditingNote ? (
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              onBlur={() => {
                saveNote(surahNumber, item.numberInSurah, noteDraft);
                setEditingNoteAyah(null);
              }}
              placeholder={t('quran.notePlaceholder')}
              placeholderTextColor={cardColors.textSecondary}
              multiline
              autoFocus
              style={[
                styles.noteInput,
                {
                  color: cardColors.text,
                  borderColor: cardColors.accent,
                },
              ]}
            />
          ) : (
            savedNote !== '' && (
              <ThemedView type="backgroundElement" style={[styles.noteBox, sepia && styles.sepiaCard]}>
                <ThemedText type="small" themeColor="accent" sepia={sepia} style={styles.noteLabel}>
                  {t('quran.noteLabel')}
                </ThemedText>
                <ThemedText type="small" sepia={sepia}>{savedNote}</ThemedText>
              </ThemedView>
            )
          )}
          {showTafsir &&
            settings.quranTafsirs.map((id, slot) => {
              const text = tafsirTextsBySlot[slot]?.[index];
              if (!text) return null;
              const edition = tafsirEditions?.find((e) => e.identifier === id);
              const name = edition?.englishName ?? id;
              // RTL generisch (nicht nur Arabisch): ur/fa/ps-Tafsir/Editionen
              // brauchen dieselbe rechtsläufige Ausrichtung wie Arabisch.
              const isRtl = isRtlLanguageCode(edition?.language ?? 'ar');
              return (
                <TafsirBlock
                  key={id}
                  name={name}
                  showName={settings.quranTafsirs.length > 1}
                  text={text}
                  isRtl={isRtl}
                  sepia={sepia}
                />
              );
            })}
        </PressableCard>
      </AnimatedListItem>
    );
  }

  return (
    <ThemedView style={[styles.container, sepia && styles.sepiaBg]}>
      <SafeAreaView style={styles.safeArea}>
        {isLoading && (
          <View style={styles.center}>
            <ThemedActivityIndicator />
          </View>
        )}
        {isError && (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
              {t('quran.loadError')}
            </ThemedText>
          </View>
        )}

        {data && (
          <>
            {!focusMode && (
            <View style={styles.headerCompact}>
              {/* Zurück zur Suren-Liste (Audit 2026-07-27, U1): der Stack ist
                  headerShown:false, ohne diesen Knopf gab es auf nativ keinen
                  sichtbaren Weg zurück — nur den Edge-Swipe. */}
              <Pressable
                onPress={() => backOr('/quran')}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.back')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView type="backgroundElement" style={[styles.headerIconBtn, sepia && styles.sepiaCard]}>
                  <IconSymbol name={rtl ? 'chevron-forward' : 'chevron-back'} size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
              <View style={styles.headerTitleBlock}>
                <ThemedText type="subtitle" sepia={sepia} numberOfLines={1}>
                  {data.meta.englishName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" sepia={sepia} numberOfLines={1}>
                  {surahNameTranslation(surahNumber, locale, data.meta.englishNameTranslation)} · {data.meta.numberOfAyahs} {t('quran.verses')}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => (player.playing ? player.pause() : player.playFrom(player.currentIndex ?? 0))}
                accessibilityRole="button"
                accessibilityLabel={player.playing ? t('quran.pause') : t('quran.playSurah')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView type="backgroundSelected" style={[styles.headerIconBtn, sepia && styles.sepiaCard]}>
                  <IconSymbol name={player.playing ? 'pause' : 'play'} size={18} color={cardColors.accent} />
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSearchOpen((v) => !v);
                  setSearchQuery('');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('quran.searchInSurah')}
                accessibilityState={{ expanded: searchOpen }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={searchOpen ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.headerIconBtn, sepia && styles.sepiaCard]}>
                  <IconSymbol name="search" size={18} color={searchOpen ? cardColors.accent : cardColors.text} />
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setViewSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('quran.viewSettings')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView type="backgroundElement" style={[styles.headerIconBtn, sepia && styles.sepiaCard]}>
                  <IconSymbol name="options-outline" size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
            </View>
            )}

            {!focusMode && searchOpen && (
              <View style={styles.searchRow}>
                <ThemedView type="backgroundElement" style={[styles.searchBox, sepia && styles.sepiaCard]}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => jumpToMatch(0)}
                    autoFocus
                    placeholder={t('quran.searchInSurah')}
                    placeholderTextColor={cardColors.textSecondary}
                    style={[styles.searchInput, { color: cardColors.text }]}
                  />
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
                  {searchMatches.length > 0 ? `${matchPos + 1}/${searchMatches.length}` : searchQuery.trim() ? '0' : ''}
                </ThemedText>
                <Pressable
                  onPress={() => jumpToMatch(matchPos + 1)}
                  disabled={searchMatches.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel={t('quran.searchNext')}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView
                    type="backgroundElement"
                    style={[styles.headerIconBtn, sepia && styles.sepiaCard, searchMatches.length === 0 && styles.searchNextDisabled]}>
                    <IconSymbol name="arrow-down" size={16} color={cardColors.text} />
                  </ThemedView>
                </Pressable>
              </View>
            )}

            {focusMode && (
              <Pressable
                onPress={() => setFocusMode(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('quran.focusExit')}
                style={({ pressed }) => [
                  styles.focusExit,
                  { top: insets.top + Spacing.two },
                  Platform.OS === 'web' ? styles.pressableWeb : undefined,
                  pressed && styles.chipPressed,
                ]}>
                <ThemedView type="backgroundElement" style={[styles.headerIconBtn, sepia && styles.sepiaCard]}>
                  <IconSymbol name="contract-outline" size={18} color={cardColors.text} />
                </ThemedView>
              </Pressable>
            )}

            <Modal
              visible={viewSheetOpen}
              transparent
              animationType="slide"
              onRequestClose={() => setViewSheetOpen(false)}>
              <Pressable
                style={styles.sheetBackdrop}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.close')}
                onPress={() => setViewSheetOpen(false)}
              />
              <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
                <View style={[styles.sheetHandle, { backgroundColor: colors.textSecondary }]} />
                <Pressable
                  onPress={() => setViewSheetOpen(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.done')}
                  style={styles.sheetDone}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('common.done')}
                  </ThemedText>
                </Pressable>
                <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetSection}>
                    {t('quran.viewSettings')}
                  </ThemedText>
                  <View style={styles.pickerRow}>
              <Pressable
                onPress={toggleBeginnerMode}
                accessibilityRole="button"
                accessibilityState={{ selected: beginnerModeActive }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={beginnerModeActive ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="school-outline" size={13} color={beginnerModeActive ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={beginnerModeActive ? 'accent' : 'text'}>
                    {t('quran.beginnerMode')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFocusMode(true);
                  setViewSheetOpen(false);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView type="backgroundElement" style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="expand-outline" size={13} color={colors.text} />
                  <ThemedText type="small">{t('quran.focusMode')}</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setReaderMode((m) => (m === 'page' ? 'scroll' : 'page'))}
                accessibilityRole="button"
                accessibilityState={{ selected: readerMode === 'page' }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={readerMode === 'page' ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="reader-outline" size={13} color={readerMode === 'page' ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={readerMode === 'page' ? 'accent' : 'text'}>
                    {t('quran.pageMode')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => {
                  setViewSheetOpen(false);
                  router.push({ pathname: '/quran/mushaf', params: { surah: String(surahNumber) } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView type="backgroundElement" style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="book-outline" size={13} color={colors.text} />
                  <ThemedText type="small">{t('quran.mushafOpen')}</ThemedText>
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
                onPress={() => setPickerOpen('translation')}
                accessibilityRole="button"
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView type="backgroundElement" style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="globe" size={13} color={colors.text} />
                  <ThemedText type="small">{currentTranslationName}</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setShowSecondTranslation((s) => !s)}
                onLongPress={() => setPickerOpen('translation2')}
                accessibilityRole="button"
                accessibilityState={{ selected: showSecondTranslation }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={showSecondTranslation ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="swap-horizontal-outline" size={13} color={showSecondTranslation ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={showSecondTranslation ? 'accent' : 'text'}>
                    {t('quran.secondTranslation')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              {showSecondTranslation && (
                <Pressable
                  onPress={() => setPickerOpen('translation2')}
                  accessibilityRole="button"
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type="backgroundElement" style={styles.chip}>
                    <ThemedText type="small">{currentTranslation2Name}</ThemedText>
                  </ThemedView>
                </Pressable>
              )}
              <Pressable
                onPress={cyclePlaybackSpeed}
                accessibilityRole="button"
                accessibilityLabel={t('quran.playbackSpeed')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={settings.quranPlaybackSpeed !== 1 ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="speedometer-outline" size={13} color={settings.quranPlaybackSpeed !== 1 ? colors.accent : colors.text} />
                  <ThemedText
                    type="small"
                    themeColor={settings.quranPlaybackSpeed !== 1 ? 'accent' : 'text'}>
                    {settings.quranPlaybackSpeed}×
                  </ThemedText>
                </ThemedView>
              </Pressable>
              {offline.supported && data && (
                <Pressable
                  onPress={() =>
                    offline.downloaded
                      ? offline.remove()
                      : // Bei Sync-fähigen Rezitatoren dieselbe Audiodatei laden,
                        // die auch für die Wort-Zeitstempel benutzt wird
                        // (verses.quran.com statt alquran.cloud) — sonst
                        // passen die Zeitstempel offline nicht mehr zur
                        // heruntergeladenen Datei (s. Kommentar bei
                        // ayahsForPlayer oben).
                        offline.download(
                          data.ayahs.map(
                            (a) => (wordSyncEligible && ayahSegments?.[a.numberInSurah]?.audioUrl) || a.audio,
                          ),
                        )
                  }
                  disabled={offline.downloading}
                  accessibilityRole="button"
                  accessibilityState={{ selected: offline.downloaded, busy: offline.downloading }}
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView
                    type={offline.downloaded ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.chip, styles.chipRow]}>
                    <IconSymbol
                      name={offline.downloaded ? 'checkmark-circle' : 'cloud-download'}
                      size={13}
                      color={offline.downloaded ? colors.accent : colors.text}
                    />
                    <ThemedText type="small" themeColor={offline.downloaded ? 'accent' : 'text'}>
                      {offline.downloading
                        ? `${Math.round(offline.progress * 100)} %`
                        : offline.downloaded
                          ? t('quran.offline')
                          : t('quran.download')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              )}
              <Pressable
                onPress={() => setShowTransliteration((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ selected: showTransliteration }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={showTransliteration ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="text-outline" size={13} color={showTransliteration ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={showTransliteration ? 'accent' : 'text'}>
                    {t('quran.transliteration')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setShowIsolatedLetters((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ selected: showIsolatedLetters }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={showIsolatedLetters ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="apps-outline" size={13} color={showIsolatedLetters ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={showIsolatedLetters ? 'accent' : 'text'}>
                    {t('quran.isolatedLetters')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setShowTajweed((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ selected: showTajweed }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={showTajweed ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="color-palette-outline" size={13} color={showTajweed ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={showTajweed ? 'accent' : 'text'}>
                    {t('quran.tajweed')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setShowWordByWord((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ selected: showWordByWord }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={showWordByWord ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="grid-outline" size={13} color={showWordByWord ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={showWordByWord ? 'accent' : 'text'}>
                    {/* Wort-Glossen kommen von quran.com nur auf Englisch. Für
                        die Kernsuren gibt es aber gepflegte DEUTSCHE Glossen
                        (germanWbwAvailable) — dann kein "(EN)"-Hinweis. Sonst in
                        allen Nicht-EN-Sprachen ehrlich als Englisch kennzeichnen. */}
                    {locale === 'en' || germanWbwAvailable
                      ? t('quran.wordByWord')
                      : `${t('quran.wordByWord')} (EN)`}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                onPress={() => setShowTafsir((s) => !s)}
                onLongPress={() => setPickerOpen('tafsir')}
                accessibilityRole="button"
                accessibilityState={{ selected: showTafsir }}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                <ThemedView
                  type={showTafsir ? 'backgroundSelected' : 'backgroundElement'}
                  style={[styles.chip, styles.chipRow]}>
                  <IconSymbol name="book" size={13} color={showTafsir ? colors.accent : colors.text} />
                  <ThemedText type="small" themeColor={showTafsir ? 'accent' : 'text'}>
                    {t('quran.tafsir')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              {showTafsir && (
                <Pressable
                  onPress={() => setPickerOpen('tafsir')}
                  accessibilityRole="button"
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                  <ThemedView type="backgroundElement" style={styles.chip}>
                    <ThemedText type="small">
                      {settings.quranTafsirs.length > 1
                        ? t('quran.tafsirCount').replace('{count}', String(settings.quranTafsirs.length))
                        : (tafsirEditions?.find((e) => e.identifier === settings.quranTafsirs[0])?.englishName ??
                          settings.quranTafsirs[0])}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              )}
            </View>

                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetSection}>
                    {t('quran.rangeTitle')}
                  </ThemedText>
                  <View style={styles.rangeRow}>
                    <ThemedView type="backgroundElement" style={styles.rangeStepper}>
                      <View style={styles.rangeSurahRow}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('quran.rangeFrom')}
                        </ThemedText>
                        <Pressable
                          onPress={() => setSurahPickerFor('from')}
                          accessibilityRole="button"
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <ThemedText type="small" themeColor="accent" numberOfLines={1} style={styles.rangeSurahName}>
                            {rangeSurahDisplayName(rangeFromSurah)}
                          </ThemedText>
                        </Pressable>
                      </View>
                      <View style={styles.rangeControls}>
                        <Pressable
                          onPress={() => setRangeFrom((v) => Math.max(1, v - 1))}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('quran.rangeFrom')} ${t('a11y.decrease')}`}
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <IconSymbol name="remove-circle-outline" size={22} color={colors.accent} />
                        </Pressable>
                        <ThemedText type="smallBold">{rangeFrom}</ThemedText>
                        <Pressable
                          onPress={() => setRangeFrom((v) => Math.min(rangeFromAyahCount, v + 1))}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('quran.rangeFrom')} ${t('a11y.increase')}`}
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <IconSymbol name="add-circle-outline" size={22} color={colors.accent} />
                        </Pressable>
                      </View>
                    </ThemedView>
                    <ThemedView type="backgroundElement" style={styles.rangeStepper}>
                      <View style={styles.rangeSurahRow}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('quran.rangeTo')}
                        </ThemedText>
                        <Pressable
                          onPress={() => setSurahPickerFor('to')}
                          accessibilityRole="button"
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <ThemedText type="small" themeColor="accent" numberOfLines={1} style={styles.rangeSurahName}>
                            {rangeSurahDisplayName(rangeToSurah)}
                          </ThemedText>
                        </Pressable>
                      </View>
                      <View style={styles.rangeControls}>
                        <Pressable
                          onPress={() => setRangeTo((v) => Math.max(1, v - 1))}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('quran.rangeTo')} ${t('a11y.decrease')}`}
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <IconSymbol name="remove-circle-outline" size={22} color={colors.accent} />
                        </Pressable>
                        <ThemedText type="smallBold">{rangeTo}</ThemedText>
                        <Pressable
                          onPress={() => setRangeTo((v) => Math.min(rangeToAyahCount, v + 1))}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('quran.rangeTo')} ${t('a11y.increase')}`}
                          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                          <IconSymbol name="add-circle-outline" size={22} color={colors.accent} />
                        </Pressable>
                      </View>
                    </ThemedView>
                  </View>
                  {rangeFromSurah !== rangeToSurah && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.rangeCrossHint}>
                      {t('quran.rangeCrossSurahHint')}
                    </ThemedText>
                  )}
                  <View style={styles.rangeActions}>
                    <Pressable
                      onPress={() => setRangeLoop((v) => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: rangeLoop }}
                      style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                      <ThemedView
                        type={rangeLoop ? 'backgroundSelected' : 'backgroundElement'}
                        style={[styles.chip, styles.chipRow]}>
                        <IconSymbol name="repeat" size={13} color={rangeLoop ? colors.accent : colors.text} />
                        <ThemedText type="small" themeColor={rangeLoop ? 'accent' : 'text'}>
                          {t('quran.rangeLoop')}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        // Reiner Innerhalb-der-offenen-Sure-Fall: unverändert
                        // der direkte Aufruf wie vorher (kein Navigations-
                        // Umweg nötig). Jede andere Kombination (Start-Sure
                        // ≠ offene Sure und/oder Ende in einer anderen Sure)
                        // läuft über die Etappen-Navigation (s.
                        // goToCrossSurahLeg oben + Autoplay-Effekt).
                        if (rangeFromSurah === rangeToSurah && rangeFromSurah === surahNumber) {
                          player.playRange(rangeFrom - 1, rangeTo - 1, rangeLoop);
                        } else {
                          router.replace({
                            pathname: '/quran/[surah]',
                            params: {
                              surah: String(rangeFromSurah),
                              playFrom: String(rangeFrom),
                              crossEndSurah: String(rangeToSurah),
                              crossEndAyah: String(rangeTo),
                              crossLoop: rangeLoop ? '1' : '0',
                              crossStartSurah: String(rangeFromSurah),
                              crossStartAyah: String(rangeFrom),
                            },
                          });
                        }
                        setViewSheetOpen(false);
                      }}
                      accessibilityRole="button"
                      style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                      <ThemedView type="backgroundSelected" style={[styles.chip, styles.chipRow]}>
                        <IconSymbol name="play" size={13} color={colors.accent} />
                        <ThemedText type="smallBold" themeColor="accent">
                          {t('quran.rangePlay')}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  </View>

                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetSection}>
                    {t('quran.compareReciters')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.compareHint}>
                    {t('quran.compareHint').replace('{verse}', `${rangeSurahDisplayName(rangeFromSurah)} ${rangeFrom}`)}
                  </ThemedText>
                  <View style={styles.rangeRow}>
                    <Pressable
                      onPress={() => setPickerOpen('compareA')}
                      accessibilityRole="button"
                      style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                      <ThemedView type="backgroundElement" style={[styles.compareChip]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('quran.compareReciterA')}
                        </ThemedText>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {audioEditions?.find((e) => e.identifier === compareReciterA)
                            ? editionDisplayName(audioEditions.find((e) => e.identifier === compareReciterA)!)
                            : compareReciterA}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                    <Pressable
                      onPress={() => setPickerOpen('compareB')}
                      accessibilityRole="button"
                      style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                      <ThemedView type="backgroundElement" style={[styles.compareChip]}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('quran.compareReciterB')}
                        </ThemedText>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {audioEditions?.find((e) => e.identifier === compareReciterB)
                            ? editionDisplayName(audioEditions.find((e) => e.identifier === compareReciterB)!)
                            : compareReciterB}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  </View>
                  <View style={styles.rangeActions}>
                    <Pressable
                      onPress={() => (comparePlayer.stage !== 'idle' ? comparePlayer.stop() : playCompareVerse())}
                      disabled={compareLoading}
                      accessibilityRole="button"
                      accessibilityState={{ busy: compareLoading }}
                      style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                      <ThemedView
                        type={comparePlayer.stage !== 'idle' ? 'backgroundSelected' : 'backgroundElement'}
                        style={[styles.chip, styles.chipRow]}>
                        <IconSymbol
                          name={comparePlayer.stage !== 'idle' ? 'stop' : 'git-compare-outline'}
                          size={13}
                          color={comparePlayer.stage !== 'idle' ? colors.accent : colors.text}
                        />
                        <ThemedText
                          type="smallBold"
                          themeColor={comparePlayer.stage !== 'idle' ? 'accent' : 'text'}>
                          {compareLoading
                            ? t('common.loading')
                            : comparePlayer.stage === 'a'
                              ? t('quran.compareStageA')
                              : comparePlayer.stage === 'b'
                                ? t('quran.compareStageB')
                                : t('quran.comparePlay')}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  </View>
                </ScrollView>
              </ThemedView>
            </Modal>

            {surahList && (
              <SurahRangePicker
                visible={surahPickerFor !== null}
                title={t('quran.rangeSelectSurah')}
                surahs={surahList}
                selected={surahPickerFor === 'from' ? rangeFromSurah : rangeToSurah}
                onSelect={(num) => {
                  if (surahPickerFor === 'from') {
                    setRangeFromSurah(num);
                    setRangeFrom(1);
                  } else if (surahPickerFor === 'to') {
                    setRangeToSurah(num);
                    setRangeTo(surahList.find((s) => s.number === num)?.numberOfAyahs ?? 1);
                  }
                  setSurahPickerFor(null);
                }}
                onClose={() => setSurahPickerFor(null)}
              />
            )}

            {showTajweed && (
              <>
                <View style={styles.legendRow}>
                  {TAJWEED_LEGEND.map((entry) => (
                    <Pressable
                      key={entry.labelKey}
                      onPress={() => triggerTajweedPulse(entry.color)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(entry.labelKey)} — ${t('quran.tajweedPracticeHint')}`}
                      style={({ pressed }) => [styles.legendItem, Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                      <View style={[styles.legendSwatch, { backgroundColor: entry.color }]} />
                      <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
                        {t(entry.labelKey)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
                <ThemedText type="small" themeColor="textSecondary" sepia={sepia} style={styles.tajweedHint}>
                  {t('quran.tajweedPracticeHint')}
                </ThemedText>
              </>
            )}

            {readerMode === 'page' ? (
              <ScrollView
                key={`page-${surahNumber}-${clampedPageIndex}`}
                contentContainerStyle={styles.list}>
                {!focusMode && data.hasBasmala && clampedPageIndex === 0 && (
                  <ThemedText
                    sepia={sepia}
                    style={[styles.arabic, styles.basmala, quranFont.style, arabicMetrics]}>
                    {quranFont.text(BASMALA)}
                  </ThemedText>
                )}
                {pageAyahs.map((item, i) => (
                  <View key={item.numberInSurah}>
                    {renderAyahCard(item, clampedPageIndex * AYAHS_PER_READER_PAGE + i)}
                  </View>
                ))}
                <View style={styles.pageNav}>
                  <Pressable
                    onPress={() => goToReaderPage(clampedPageIndex - 1)}
                    disabled={clampedPageIndex <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={t('quran.mushafPrev')}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.navBtn, sepia && styles.sepiaCard, clampedPageIndex <= 0 && styles.navDisabled]}>
                      <IconSymbol name="chevron-back" size={18} color={cardColors.text} />
                    </ThemedView>
                  </Pressable>
                  <ThemedText type="small" themeColor="textSecondary" sepia={sepia}>
                    {t('quran.mushafPage')} {clampedPageIndex + 1}/{totalReaderPages}
                  </ThemedText>
                  <Pressable
                    onPress={() => goToReaderPage(clampedPageIndex + 1)}
                    disabled={clampedPageIndex >= totalReaderPages - 1}
                    accessibilityRole="button"
                    accessibilityLabel={t('quran.mushafNext')}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.chipPressed]}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.navBtn, sepia && styles.sepiaCard, clampedPageIndex >= totalReaderPages - 1 && styles.navDisabled]}>
                      <IconSymbol name="chevron-forward" size={18} color={cardColors.text} />
                    </ThemedView>
                  </Pressable>
                </View>
              </ScrollView>
            ) : (
              <FlatList
                ref={listRef}
                data={data.ayahs}
                keyExtractor={(a) => String(a.numberInSurah)}
                contentContainerStyle={styles.list}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
                onScrollToIndexFailed={({ index, averageItemLength }) => {
                  // averageItemLength (von der FlatList selbst gemessen) statt fixem Wert:
                  // Vers-Karten sind 150-900px hoch (Arabisch + Übersetzung + evtl. Wort-für-Wort),
                  // ein fixer Schätzwert (früher 120) lag weit unter der echten Höhe und ließ
                  // scrollToIndex bei großen Ziel-Indizes (z. B. Deep-Link auf Vers 255) nur
                  // um denselben zu kleinen Sprung je Versuch vorankriechen (Minuten statt Sekunden).
                  const estimate = Math.max(averageItemLength, 300);
                  listRef.current?.scrollToOffset({ offset: index * estimate, animated: false });
                  setTimeout(() => {
                    listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: false });
                  }, 250);
                }}
                ListHeaderComponent={
                  !focusMode && data.hasBasmala ? (
                    <ThemedText
                      sepia={sepia}
                      style={[styles.arabic, styles.basmala, quranFont.style, arabicMetrics]}>
                      {quranFont.text(BASMALA)}
                    </ThemedText>
                  ) : null
                }
                renderItem={({ item, index }) => renderAyahCard(item, index)}
                /* Nennung der Übersetzer am Ort der Nutzung.
                 *
                 * Al Quran Cloud gibt die Ausgaben unter der Auflage weiter:
                 * "If you republish a translation, please attribute the
                 * translator by name." Bis 1.41.0 stand nur die Ausgabe
                 * Bubenheim auf der Lizenzseite, während der Reader jede der
                 * 100+ Ausgaben anzeigen kann — die Auflage war damit für alle
                 * übrigen nicht erfüllt. Eine statische Liste hilft nicht, weil
                 * die Auswahl aus der Schnittstelle kommt; deshalb steht der
                 * Name dort, wo der Text tatsächlich gelesen wird. Unabhängig
                 * davon ist die Namensnennung das Urheberpersönlichkeitsrecht
                 * des Übersetzers (§ 13 UrhG).
                 *
                 * Im Fokus-Modus ausgeblendet: dort zählt nur der Vers. */
                ListFooterComponent={
                  !focusMode && uebersetzerZeilen.length > 0 ? (
                    <View style={styles.uebersetzerFuss}>
                      {uebersetzerZeilen.map((zeile) => (
                        <ThemedText key={zeile} type="small" themeColor="textSecondary" sepia={sepia}>
                          {zeile}
                        </ThemedText>
                      ))}
                    </View>
                  ) : null
                }
              />
            )}
          </>
        )}

        <WordInfoSheet
          visible={selectedWordPos !== null}
          word={
            selectedWordPos
              ? (wordByWord?.[selectedWordPos.ayahIndex]?.[selectedWordPos.wordIndex] ?? null)
              : null
          }
          // Deutsches Gloss ins Lexikon-Sheet durchreichen (nur Kernsuren, App=DE),
          // sonst null → englisches quran.com-Gloss. Gleicher Längen-Guard wie in
          // der Inline-Ansicht: bei abweichender Wortanzahl kein deutsches Gloss.
          translationOverride={(() => {
            if (!selectedWordPos || !germanWbwAvailable) return null;
            const words = wordByWord?.[selectedWordPos.ayahIndex];
            const ayahNo = data?.ayahs?.[selectedWordPos.ayahIndex]?.numberInSurah;
            if (!words || ayahNo == null) return null;
            const glosses = getGermanWordGlosses(surahNumber, ayahNo);
            return glosses && glosses.length === words.length
              ? (glosses[selectedWordPos.wordIndex] ?? null)
              : null;
          })()}
          loading={selectedWordPos !== null && wordByWordLoading}
          error={selectedWordPos !== null && wordByWordError}
          audioUrl={
            selectedWordPos
              ? (wordByWord?.[selectedWordPos.ayahIndex]?.[selectedWordPos.wordIndex]?.audioUrl ?? null)
              : null
          }
          onPlay={() => {
            const w = selectedWordPos
              ? wordByWord?.[selectedWordPos.ayahIndex]?.[selectedWordPos.wordIndex]
              : null;
            playWord(w?.audioUrl ?? null);
          }}
          onClose={() => setSelectedWordPos(null)}
        />

        <ShareCardModal content={shareCard.content} onClose={shareCard.close} />

        <EditionPicker
          visible={pickerOpen === 'reciter'}
          title={t('quran.chooseReciter')}
          editions={audioEditions ?? []}
          recommended={RECOMMENDED_RECITERS}
          selected={settings.quranReciter}
          onSelect={(id) => {
            update({ quranReciter: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          multi
          visible={pickerOpen === 'tafsir'}
          title={t('quran.chooseTafsir')}
          editions={tafsirEditions ?? []}
          // Muttersprachlicher Tafsir der App-Sprache zuerst (bn/ur/ru haben
          // einen, siehe BEST_TAFSIRS), danach die arabische Standardausgabe.
          recommended={[BEST_TAFSIRS[locale] ?? 'qc.169', 'ar.muyassar']}
          selected={settings.quranTafsirs}
          onSelect={(id) => update({ quranTafsirs: toggleTafsirSelection(settings.quranTafsirs, id) })}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'translation'}
          title={t('quran.chooseTranslation')}
          editions={translationEditions ?? []}
          recommended={RECOMMENDED_TRANSLATIONS}
          selected={settings.quranTranslation}
          onSelect={(id) => {
            update({ quranTranslation: id });
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'translation2'}
          title={t('quran.chooseSecondTranslation')}
          editions={translationEditions ?? []}
          recommended={RECOMMENDED_TRANSLATIONS}
          selected={settings.quranTranslation2}
          onSelect={(id) => {
            update({ quranTranslation2: id });
            setShowSecondTranslation(true);
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'compareA'}
          title={t('quran.chooseReciterA')}
          editions={audioEditions ?? []}
          recommended={RECOMMENDED_RECITERS}
          selected={compareReciterA}
          onSelect={(id) => {
            setCompareReciterA(id);
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />
        <EditionPicker
          visible={pickerOpen === 'compareB'}
          title={t('quran.chooseReciterB')}
          editions={audioEditions ?? []}
          recommended={RECOMMENDED_RECITERS}
          selected={compareReciterB}
          onSelect={(id) => {
            setCompareReciterB(id);
            setPickerOpen(null);
          }}
          onClose={() => setPickerOpen(null)}
        />

        {/* Schwebender Mini-Player: bleibt beim Scrollen sichtbar, sobald
            eine Rezitation läuft oder pausiert ist (User-Wunsch). */}
        {data && player.currentIndex !== null && (
          <View style={styles.miniPlayerWrap} pointerEvents="box-none">
            <ThemedView type="backgroundSelected" style={[styles.miniPlayer, sepia && styles.sepiaCard]}>
              <Pressable
                onPress={() => (player.playing ? player.pause() : player.resume())}
                accessibilityRole="button"
                accessibilityLabel={player.playing ? t('quran.pause') : t('quran.playSurah')}
                hitSlop={8}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <IconSymbol name={player.playing ? 'pause' : 'play'} size={20} color={cardColors.accent} />
              </Pressable>
              <Pressable
                onPress={() =>
                  listRef.current?.scrollToIndex({
                    index: player.currentIndex ?? 0,
                    viewPosition: 0.2,
                    animated: true,
                  })
                }
                accessibilityRole="button"
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <ThemedText type="small" sepia={sepia}>
                  {data.meta.englishName} · {data.ayahs[player.currentIndex]?.numberInSurah}/
                  {data.meta.numberOfAyahs}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setFollowAlong((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ selected: followAlong }}
                accessibilityLabel={t('quran.followAlong')}
                hitSlop={8}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <IconSymbol
                  name={followAlong ? 'locate' : 'locate-outline'}
                  size={18}
                  color={followAlong ? cardColors.accent : cardColors.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={() => player.stop()}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.close')}
                hitSlop={8}
                style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
                <IconSymbol name="close" size={18} color={cardColors.textSecondary} />
              </Pressable>
            </ThemedView>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Tafsir-Absatz mit Einklapp-Logik: Ibn-Kathir-Einträge zu Vers 1 enthalten
 * oft die komplette Sureneinleitung (mehrere Bildschirmseiten) — lange Texte
 * starten daher als 6-Zeilen-Vorschau mit "Mehr anzeigen" (Audit 2026-07-19
 * B4), kurze Verstafsire bleiben wie bisher voll sichtbar.
 */
function TafsirBlock({
  name,
  showName,
  text,
  isRtl,
  sepia,
}: {
  name: string;
  showName: boolean;
  text: string;
  isRtl: boolean;
  sepia: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 600;

  return (
    <ThemedView type="backgroundElement" style={[styles.tafsirBox, sepia && styles.sepiaCard]}>
      {showName && (
        <ThemedText type="small" themeColor="accent" sepia={sepia} style={styles.tafsirLabel}>
          {name}
        </ThemedText>
      )}
      <ThemedText
        type="small"
        sepia={sepia}
        numberOfLines={isLong && !expanded ? 6 : undefined}
        style={[
          styles.tafsirText,
          { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' },
        ]}>
        {text}
      </ThemedText>
      {isLong && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
          style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
          <ThemedText type="smallBold" themeColor="accent" sepia={sepia}>
            {expanded ? t('quran.tafsirLess') : t('quran.tafsirMore')}
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  searchBox: { flex: 1, borderRadius: 999 },
  searchInput: { paddingVertical: 8, paddingHorizontal: Spacing.three, fontSize: 14 },
  searchNextDisabled: { opacity: 0.3 },
  focusExit: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.three,
    zIndex: 20,
    elevation: 20,
  },
  // Sepia: warmer Papierton wie bei E-Readern — bewusst als Override über
  // beiden Themes (klassischer Lesemodus ist hell).
  sepiaBg: { backgroundColor: '#f1e7d0' },
  sepiaCard: { backgroundColor: '#e9dcbf' },
  headerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  headerTitleBlock: { flex: 1, minWidth: 0 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(11,11,13,0.45)' },
  sheet: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
    // overflow:'hidden' + flexShrink auf der ScrollView (s. sheetScroll) sind
    // beide nötig: ohne style-Prop auf der ScrollView ignoriert Android das
    // maxHeight des Elternteils, der Inhalt malt dann optisch normal über den
    // Rand hinaus, ABER der Touch-Bereich endet trotzdem an der echten
    // Layout-Grenze — der unterste Button ("Abschnitt abspielen") sah aus wie
    // er da ist, Taps trafen aber das Backdrop dahinter und schlossen nur das
    // Sheet (Bugfix 2026-07-20, Audit Teil B).
    overflow: 'hidden',
  },
  sheetScroll: { flexShrink: 1 },
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
  rangeRow: { flexDirection: 'row', gap: Spacing.two },
  rangeStepper: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  rangeControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  // Suren-Auswahl-Chip innerhalb des Von-/Bis-Steppers (öffnet SurahRangePicker).
  rangeSurahRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: Spacing.one },
  rangeSurahName: { maxWidth: 90 },
  // Fußzeile mit den Übersetzer-Namen: deutlich abgesetzt, aber ohne eigene
  // Fläche — sie ist eine Herkunftsangabe, kein Inhalt.
  uebersetzerFuss: { paddingTop: Spacing.four, paddingBottom: Spacing.two, gap: Spacing.half },
  rangeCrossHint: { marginTop: -Spacing.one, marginBottom: Spacing.one },
  mainWordActive: {
    backgroundColor: 'rgba(212,175,55,0.35)',
    borderRadius: 6,
  },
  rangeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    flexWrap: 'wrap',
  },
  miniPlayerWrap: {
    position: 'absolute',
    bottom: Spacing.four,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  miniPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(11,11,13,0.25)' },
      default: {
        shadowColor: '#0b0b0d',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  center: { alignItems: 'center', paddingVertical: Spacing.five },
  header: { alignItems: 'center', marginBottom: Spacing.three, paddingHorizontal: Spacing.four },
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
  compareChip: { flex: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: 2 },
  compareHint: { marginBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth, },
  // Seitenmodus-Navigation (Task #66): Vor/Zurück-Pfeile + Seitenzahl unter
  // dem letzten Vers-Block, analog zum Mushaf-Pattern (app/(tabs)/quran/mushaf.tsx).
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  navBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navDisabled: { opacity: 0.3 },
  ayah: { paddingVertical: Spacing.two, borderRadius: Spacing.two, gap: Spacing.one },
  ayahActive: { backgroundColor: 'rgba(212,175,55,0.12)' },
  ayahHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ayahNumberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  sajdaMark: { fontSize: 15 },
  ayahActions: { flexDirection: 'row', gap: Spacing.three },
  // writingDirection ist Pflicht, sobald der Vers in MEHRERE Geschwister-
  // <Text>-Knoten zerlegt wird (Tajwid-Segmente, Wort-Sync-Highlight):
  // ohne diese CSS-direction reiht der Browser die Spans in DOM- statt
  // Bidi-Reihenfolge — der Vers erscheint komplett gespiegelt/LTR
  // (kritischer Nutzer-Fund: Sure 18, Tajwid-Ansicht).
  // fontFamily/Größe kommen zur Laufzeit aus useQuranFont() — die Schrift ist
  // einstellbar (features/quran/fonts.ts).
  arabic: { textAlign: 'right', writingDirection: 'rtl' },
  basmala: { textAlign: 'center', marginBottom: Spacing.three, opacity: 0.85 },
  transliteration: { fontStyle: 'italic' },
  isolatedLetters: { letterSpacing: 4 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  tajweedHint: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: -Spacing.two,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  wordActive: {
    backgroundColor: 'rgba(212,175,55,0.30)',
    borderRadius: 8,
  },
  wordByWordRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  wordColumn: { alignItems: 'center', minWidth: 44 },
  wordArabic: {},
  wordGloss: { fontSize: 11, textAlign: 'center' },
  tafsirBox: { padding: Spacing.two, borderRadius: Spacing.two, gap: Spacing.half },
  tafsirLabel: { fontWeight: '700' },
  tafsirText: { lineHeight: 24 },
  translationRtl: { textAlign: 'right', writingDirection: 'rtl' },
  noteBox: { padding: Spacing.two, borderRadius: Spacing.two, gap: Spacing.half },
  noteLabel: { fontWeight: '700' },
  secondTranslationBox: { padding: Spacing.two, borderRadius: Spacing.two, gap: Spacing.half },
  secondTranslationLabel: { fontWeight: '700' },
  noteInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    minHeight: 44,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  pressableWeb: { cursor: 'pointer' },
});

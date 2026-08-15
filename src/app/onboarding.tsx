// Erststart-Onboarding (nur nativ, Audit C2): 5 skippbare Schritte —
// Willkommen, Standort, Berechnungsmethode + Asr-Schule, Benachrichtigungen,
// Offline-Download (STEP_COUNT=5).
// Mit `?mode=location` läuft NUR der Standort-Schritt als fokussiertes
// Standort-Setup (aus getting-started.tsx) und kehrt danach per „Zurück" dorthin
// zurück — statt den kompletten Erststart-Flow neu zu starten (Audit 2026-07-22).
// Web zeigt diesen Flow nie (Landingpage übernimmt dort das Onboarding);
// die Weiche sitzt im nativen Home-Tab ((tabs)/index.tsx) + features/onboarding/flag.ts.
// Alle gewählten Werte laufen über den bestehenden Settings-Store — keine
// Parallel-Persistenz.
// Berechtigungen (Standort, Benachrichtigungen): Der „Weiter"-Knopf unter der
// jeweiligen Erklärung löst IMMER die Systemabfrage aus — siehe Kommentar am
// Fußzeilen-Knopf (Apple-Ablehnung 1.33.0, Guideline 5.1.1(iv)).
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  aktuelleModellGroesse,
  istWhisperModellHeruntergeladen,
  whisperModellHerunterladen,
} from '@/features/hifz/whisperModel';
import { useDeviceLocation } from '@/features/location/useDeviceLocation';
import { nominatimResultToLocation, searchCity, type NominatimResult } from '@/features/location/nominatim';
import { markOnboardingDone } from '@/features/onboarding/flag';
import { requestNotificationPermission } from '@/features/prayer-times/notifications';
import { formatBytes } from '@/features/settings/storage';
import { recommendMethod } from '@/features/prayer-times/method-country';
import { useMethodLabels } from '@/features/settings/MethodPicker';
import { PRAYER_METHODS, SCHOOLS, methodParamsLabel } from '@/features/settings/methods';
import { useSettings } from '@/features/settings/store';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

const STEP_COUNT = 5;

export default function OnboardingScreen() {
  const { settings, update } = useSettings();
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { requestLocation, loading: locLoading } = useDeviceLocation();

  // Fokussiertes Standort-Setup (aus getting-started.tsx): nur der Standort-
  // Schritt, danach zurück statt zur Startseite (Audit 2026-07-22).
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const locationOnly = mode === 'location';

  const [step, setStep] = useState(locationOnly ? 1 : 0);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<NominatimResult[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  // Treffer mit unbrauchbaren Koordinaten (s. pickCity).
  const [cityError, setCityError] = useState(false);
  const cityRequestId = useRef(0);
  const cityDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Offline-Vorab-Download (Schritt 4): Sprachmodell (Rezitations-Check) und
  // optional das KI-Modell. pct=null & !done = noch nicht gestartet.
  const [whisperDl, setWhisperDl] = useState<{ pct: number | null; done: boolean }>({ pct: null, done: false });

  // Standort-Schritt: wurde die Systemabfrage schon ausgeloest ODER hat der
  // Nutzer stattdessen manuell eine Stadt gewaehlt? Steuert, ob „Weiter" noch
  // zur Systemabfrage fuehren muss (siehe standortSchrittWeiter).
  const [standortGeklaert, setStandortGeklaert] = useState(false);

  // Hat der Nutzer die Berechnungsmethode im Onboarding schon selbst angefasst?
  // Solange nicht, zieht ein Ortswechsel die Methode des Landes nach — danach
  // nie wieder, sonst überschriebe die Ortung eine bewusste Wahl.
  const [methodeSelbstGewaehlt, setMethodeSelbstGewaehlt] = useState(false);
  const methodLabels = useMethodLabels();
  const landesEmpfehlung = recommendMethod(settings.location.country);

  useEffect(() => {
    let cancelled = false;
    istWhisperModellHeruntergeladen().then((d) => {
      if (!cancelled) setWhisperDl((s) => ({ ...s, done: d }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function downloadWhisper() {
    if (whisperDl.pct !== null || whisperDl.done) return;
    setWhisperDl({ pct: 0, done: false });
    try {
      await whisperModellHerunterladen((p) => setWhisperDl({ pct: Math.round(p.anteil * 100), done: false }));
      setWhisperDl({ pct: null, done: true });
    } catch {
      setWhisperDl({ pct: null, done: false });
    }
  }

  function finish() {
    // Standort-Setup-Modus: Onboarding ist längst abgeschlossen, nur zurück
    // zur aufrufenden Seite (getting-started) statt zur Startseite.
    if (locationOnly) {
      router.back();
      return;
    }
    markOnboardingDone().finally(() => router.replace('/'));
  }

  function next() {
    // Im Standort-Setup-Modus beendet „Weiter" nach dem Standort-Schritt direkt.
    if (locationOnly) {
      router.back();
      return;
    }
    if (step >= STEP_COUNT - 1) {
      finish();
      return;
    }
    setStep(step + 1);
  }

  async function enableNotifications() {
    // Permission-Dialog des Systems; Ergebnis egal — die eigentliche Planung
    // übernimmt der Gebetszeiten-Screen (rescheduleNotifications), sobald
    // Timings geladen sind. Bei "verweigert" bleibt die App voll nutzbar.
    // Danach weiter zum Offline-Schritt (nicht mehr Ende).
    await requestNotificationPermission();
    next();
  }

  // Apple-Ablehnung 1.33.0 (Guideline 5.1.1(iv)): Vor der Systemabfrage steht
  // hier ein eigener Erklärtext — dessen Knopf MUSS zur Systemabfrage führen.
  // Vorher sprang „Weiter" am Dialog vorbei direkt zum nächsten Schritt, der
  // Nutzer konnte die Erklärung also wegdrücken und die Abfrage verzögern.
  // Wer den Standort nicht freigeben will, hat weiterhin zwei klar erkennbare,
  // getrennte Wege: die Stadtsuche auf demselben Schritt und „Überspringen"
  // in der Kopfzeile. Hat der Nutzer einen dieser Wege genutzt (oder die
  // Abfrage bereits gesehen), fragt „Weiter" nicht erneut.
  async function standortSchrittWeiter() {
    if (!standortGeklaert) {
      await ortungStarten();
    }
    next();
  }

  function onCityQueryChange(q: string) {
    setCityQuery(q);
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (q.trim().length < 3) {
      setCityResults([]);
      setCitySearching(false);
      return;
    }
    // 400ms Debounce: ohne Bremse feuert jeder Tastendruck sofort einen
    // eigenen Nominatim-Request ab, was gegen deren 1req/s-Nutzungsrichtlinie
    // verstößt und dort zu Rate-Limit-Antworten (kein valides JSON) führt.
    // requestId verwirft veraltete Antworten, falls der Nutzer weitertippt.
    setCitySearching(true);
    const requestId = ++cityRequestId.current;
    cityDebounce.current = setTimeout(async () => {
      try {
        const results = await searchCity(q);
        if (requestId === cityRequestId.current) setCityResults(results);
      } catch {
        if (requestId === cityRequestId.current) setCityResults([]);
      } finally {
        if (requestId === cityRequestId.current) setCitySearching(false);
      }
    }, 400);
  }

  function pickCity(r: NominatimResult) {
    // Audit 2026-07-27 (O4): siehe settings.tsx — unbrauchbare Koordinaten
    // dürfen den Erststart nicht mit einem NaN-Standort abschließen lassen.
    const loc = nominatimResultToLocation(r);
    if (!loc) {
      setCityError(true);
      return;
    }
    setCityError(false);
    // Mit dem Ort steht auch das Land fest — und damit die Behörde, nach der
    // dort gerechnet wird. Das ist der Kern des Erststarts: niemand soll aus
    // 23 Behörden raten müssen, welche die seines Landes ist.
    const empfehlung = recommendMethod(loc.country);
    update(
      methodeSelbstGewaehlt || empfehlung.basis !== 'country'
        ? { location: loc }
        : { location: loc, method: empfehlung.methodId },
    );
    setCityQuery('');
    setCityResults([]);
    // Manuell gewählter Ort = der getrennte Weg am Systemdialog vorbei;
    // „Weiter" muss danach nicht mehr nach der Ortung fragen.
    setStandortGeklaert(true);
  }

  async function ortungStarten() {
    setStandortGeklaert(true);
    const pos = await requestLocation();
    if (pos) {
      update({
        location: {
          ...pos,
          label: `${pos.lat.toFixed(3)}, ${pos.lon.toFixed(3)}`,
          city: settings.location.city,
          country: settings.location.country,
        },
      });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, rtl && styles.headerRtl]}>
          <Pressable
            onPress={finish}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('onboarding.skip')}
            </ThemedText>
          </Pressable>
        </View>

        {/* key={step}: remountet den Inhalt pro Schritt, damit die
            Stagger-Animation bei jedem Schrittwechsel erneut abläuft. */}
        <ScrollView key={step} contentContainerStyle={styles.scroll}>
          {step === 0 && (
            <>
              <AnimatedListItem index={0} style={styles.centered}>
                <View style={[styles.logoBadge, { backgroundColor: colors.backgroundElement }]}>
                  <Image
                    source={require('@/assets/images/icon.png')}
                    style={styles.logo}
                    contentFit="cover"
                    alt=""
                  />
                </View>
              </AnimatedListItem>
              <AnimatedListItem index={1}>
                <ThemedText type="subtitle" style={styles.centerText}>
                  {t('onboarding.welcomeTitle')}
                </ThemedText>
              </AnimatedListItem>
              <AnimatedListItem index={2}>
                <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                  {t('onboarding.welcomeTagline')}
                </ThemedText>
              </AnimatedListItem>
              <AnimatedListItem index={3} style={styles.centered}>
                <ThemedView type="backgroundElement" style={styles.privacyPill}>
                  <IconSymbol name="shield-checkmark-outline" size={16} color={colors.accent} />
                  <ThemedText type="small" themeColor="accent" style={styles.privacyText}>
                    {t('onboarding.welcomePrivacy')}
                  </ThemedText>
                </ThemedView>
              </AnimatedListItem>
              {/* Optionaler Einstieg für Konvertiten/Neu-Muslime (User-Wunsch):
                  kuratierte "Erste Schritte"-Übersicht zu bereits vorhandenen
                  Inhalten (getting-started.tsx), keine neue Lehre hier. Push
                  statt finish(): der Onboarding-Flow bleibt im Hintergrund
                  bestehen, "Zurück" führt genau hierher zurück. */}
              <AnimatedListItem index={4} style={styles.centered}>
                <Pressable
                  onPress={() => router.push('/getting-started')}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.newToIslamLink}>
                    {t('onboarding.newToIslam')}
                  </ThemedText>
                </Pressable>
              </AnimatedListItem>
            </>
          )}

          {step === 1 && (
            <>
              <StepIntro
                icon="location-outline"
                title={t('onboarding.locationTitle')}
                hint={t('onboarding.locationHint')}
                rtl={rtl}
              />
              <AnimatedListItem index={2}>
                <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                  {t('settings.current')}: {settings.location.label}
                </ThemedText>
              </AnimatedListItem>
              <AnimatedListItem index={3}>
                <OptionRow
                  onPress={ortungStarten}
                  label={locLoading ? t('settings.locating') : t('common.useLocation')}
                  accent
                  rtl={rtl}
                />
              </AnimatedListItem>
              <AnimatedListItem index={4}>
                <ThemedView type="backgroundElement" style={styles.inputBox}>
                  <TextInput
                    value={cityQuery}
                    onChangeText={onCityQueryChange}
                    placeholder={t('settings.searchCity')}
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.textInput, { color: colors.text }, rtl && styles.rtlText]}
                  />
                </ThemedView>
                {citySearching && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('common.loading')}
                  </ThemedText>
                )}
                {cityError && (
                  <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                    {t('settings.cityInvalid')}
                  </ThemedText>
                )}
                {cityResults.map((r) => (
                  <OptionRow key={r.place_id} onPress={() => pickCity(r)} label={r.display_name} rtl={rtl} />
                ))}
              </AnimatedListItem>
            </>
          )}

          {step === 2 && (
            <>
              <StepIntro
                icon="compass-outline"
                title={t('onboarding.methodTitle')}
                hint={t('onboarding.methodHint')}
                rtl={rtl}
              />
              <AnimatedListItem index={2}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {/* Die Behörde des eigenen Landes steht oben — sonst müsste
                      man sie in einer Liste aus 23 Einträgen suchen. */}
                  {[...PRAYER_METHODS]
                    .sort((a, b) =>
                      Number(b.id === landesEmpfehlung.methodId) - Number(a.id === landesEmpfehlung.methodId),
                    )
                    .map((m) => (
                      <OptionRow
                        key={m.id}
                        onPress={() => {
                          setMethodeSelbstGewaehlt(true);
                          update({ method: m.id });
                        }}
                        label={m.name}
                        description={
                          m.id === landesEmpfehlung.methodId && landesEmpfehlung.basis === 'country'
                            ? `${t('settings.methodForCountry').replace('{country}', settings.location.label)} · ${methodParamsLabel(m, methodLabels)}`
                            : methodParamsLabel(m, methodLabels)
                        }
                        selected={settings.method === m.id}
                        rtl={rtl}
                      />
                    ))}
                </ThemedView>
              </AnimatedListItem>
              <AnimatedListItem index={3}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.sectionLabel, rtl && styles.rtlText]}>
                  {t('settings.asrSchool').toUpperCase()}
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.card}>
                  {SCHOOLS.map((s) => (
                    <OptionRow
                      key={s.id}
                      onPress={() => update({ school: s.id })}
                      label={t(s.id === 0 ? 'settings.asrEarlier' : 'settings.asrLater')}
                      selected={settings.school === s.id}
                      rtl={rtl}
                    />
                  ))}
                </ThemedView>
              </AnimatedListItem>
            </>
          )}

          {step === 3 && (
            <>
              <StepIntro
                icon="notifications-outline"
                title={t('onboarding.notifTitle')}
                hint={t('onboarding.notifHint')}
                rtl={rtl}
              />
            </>
          )}

          {step === 4 && (
            <>
              <StepIntro
                icon="cloud-download-outline"
                title={t('onboarding.offlineTitle')}
                hint={t('onboarding.offlineHint')}
                rtl={rtl}
              />
              <AnimatedListItem index={2}>
                <DownloadCard
                  icon="mic-outline"
                  name={t('onboarding.offlineSpeech')}
                  size={formatBytes(aktuelleModellGroesse())}
                  state={whisperDl}
                  onPress={downloadWhisper}
                  downloadLabel={t('settings.storage.whisperModel.download')}
                  readyLabel={t('onboarding.offlineReady')}
                  rtl={rtl}
                />
              </AnimatedListItem>
              <AnimatedListItem index={4}>
                <ThemedText type="small" themeColor="textSecondary" style={[styles.centerText, rtl && styles.rtlText]}>
                  {t('onboarding.offlineLater')}
                </ThemedText>
              </AnimatedListItem>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {!locationOnly && (
            <View style={styles.dots}>
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === step ? colors.accent : colors.backgroundSelected },
                  ]}
                />
              ))}
            </View>
          )}
          {/* Der Knopf unter einer eigenen Berechtigungs-Erklärung heißt in
              JEDEM Schritt neutral „Weiter" und löst im Standort- (1) wie im
              Benachrichtigungs-Schritt (3) die Systemabfrage aus — nie eine
              „…aktivieren"/„…erlauben"-Beschriftung, die dem Systemdialog
              vorgreift (Apple-Ablehnung 1.33.0, Guideline 5.1.1(iv)). Der
              frühere „Später"-Knopf im Benachrichtigungs-Schritt ist entfallen:
              er ließ genau die Erklärung wegdrücken, ohne dass die Abfrage je
              erschien. Wer nicht möchte, lehnt im Systemdialog ab oder nutzt
              „Überspringen" in der Kopfzeile. */}
          <Pressable
            onPress={step === 1 ? standortSchrittWeiter : step === 3 ? enableNotifications : next}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryBtn,
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={styles.primaryBtnText}>
              {step === 4 ? t('onboarding.done') : t('onboarding.next')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function StepIntro({ icon, title, hint, rtl }: { icon: IconName; title: string; hint: string; rtl: boolean }) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <>
      <AnimatedListItem index={0} style={rtl ? styles.iconWrapRtl : undefined}>
        <View style={[styles.stepIcon, { backgroundColor: colors.backgroundElement }]}>
          <IconSymbol name={icon} size={26} color={colors.accent} />
        </View>
      </AnimatedListItem>
      <AnimatedListItem index={1}>
        <ThemedText type="subtitle" style={rtl && styles.rtlText}>
          {title}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={rtl && styles.rtlText}>
          {hint}
        </ThemedText>
      </AnimatedListItem>
    </>
  );
}

function OptionRow({
  onPress,
  label,
  description,
  selected,
  accent,
  rtl,
}: {
  onPress: () => void;
  label: string;
  /** Zweite Zeile — bei den Berechnungsmethoden die Winkel, ohne die sich
   * „Gulf Region" und „Kuwait" nicht unterscheiden lassen. */
  description?: string;
  selected?: boolean;
  accent?: boolean;
  rtl: boolean;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={[label, description].filter(Boolean).join(', ')}
      style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
      <View style={[styles.row, rtl && styles.rowRtl]}>
        <View style={styles.rowMain}>
          <ThemedText
            type={selected ? 'smallBold' : 'default'}
            themeColor={accent || selected ? 'accent' : 'text'}
            style={[styles.rowLabel, rtl && styles.rtlText]}>
            {label}
          </ThemedText>
          {description ? (
            <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
              {description}
            </ThemedText>
          ) : null}
        </View>
        {selected && <IconSymbol name="checkmark" size={16} color={colors.accent} />}
      </View>
    </Pressable>
  );
}

function DownloadCard({
  icon,
  name,
  size,
  state,
  onPress,
  downloadLabel,
  readyLabel,
  rtl,
}: {
  icon: IconName;
  name: string;
  size: string;
  state: { pct: number | null; done: boolean };
  onPress: () => void;
  downloadLabel: string;
  readyLabel: string;
  rtl: boolean;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <ThemedView type="backgroundElement" style={[styles.dlCard, rtl && styles.rowRtl]}>
      <View style={[styles.dlLabel, rtl && styles.rowRtl]}>
        <IconSymbol name={icon} size={20} color={colors.accent} />
        <View style={styles.dlLabelText}>
          <ThemedText type="default" style={rtl && styles.rtlText}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
            {size}
          </ThemedText>
        </View>
      </View>
      {state.done ? (
        <View style={styles.dlStatus}>
          <IconSymbol name="checkmark-circle" size={18} color={colors.accent} />
          <ThemedText type="smallBold" themeColor="accent">
            {readyLabel}
          </ThemedText>
        </View>
      ) : state.pct !== null ? (
        <View style={styles.dlStatus}>
          <ThemedActivityIndicator size="small" />
          <ThemedText type="smallBold" themeColor="accent">
            {state.pct}%
          </ThemedText>
        </View>
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={downloadLabel}
          style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
          <ThemedView type="backgroundSelected" style={styles.dlBtn}>
            <IconSymbol name="download-outline" size={14} color={colors.accent} />
            <ThemedText type="smallBold" themeColor="accent">
              {downloadLabel}
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  dlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dlLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  dlLabelText: { flex: 1, gap: 2 },
  dlStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerRtl: { flexDirection: 'row-reverse' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  rtlText: { textAlign: 'right' },
  iconWrapRtl: { alignItems: 'flex-end' },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  logo: { width: 96, height: 96 },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    maxWidth: '100%',
  },
  privacyText: { flexShrink: 1, textAlign: 'center' },
  newToIslamLink: { textDecorationLine: 'underline' },
  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { letterSpacing: 0.5, marginBottom: Spacing.one, marginLeft: Spacing.two },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,124,116,0.35)',
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rowLabel: { flex: 1 },
  rowMain: { flex: 1, gap: 2 },
  inputBox: { borderRadius: Spacing.two, marginBottom: Spacing.one },
  textInput: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 15 },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  primaryBtn: {
    backgroundColor: Brand.gold,
    borderRadius: 999,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryBtnText: { color: Brand.ink },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});

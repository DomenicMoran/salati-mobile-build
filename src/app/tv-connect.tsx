// „TV verbinden" — Handy als Fernbedienung + Quiz-Zweitschirm für Salati TV.
// Nativ (iOS/Android): QR-Code des Fernsehers scannen → direkte LAN-Verbindung
// (react-native-tcp-socket, kein Backend) → Screens fernsteuern und beim Quiz
// vom Handy aus antworten. Web nutzt tv-connect.web.tsx (nur Hinweis).
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useRtl } from '@/hooks/use-rtl';
import { useTranslation } from '@/lib/i18n';
import { backOr } from '@/lib/nav';
import { useSettings } from '@/features/settings/store';
import { parseManualPair, parsePairPayload, useTvConnection } from '@/features/tv/pairing-client';
import { tvShortcutsFor } from '@/features/tv/screens';

export default function TvConnectScreen() {
  const { t } = useTranslation();
  const rtl = useRtl();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const [permission, requestPermission] = useCameraPermissions();
  const { status, tvName, tvScreens, quiz, connect, disconnect, nav, key, answerQuiz, sendeEinstellungen } =
    useTvConnection();
  // Manuelle Eingabe — eingeklappt, damit der Scan-Weg der normale bleibt.
  const [manuellOffen, setManuellOffen] = useState(false);
  const [manuellHost, setManuellHost] = useState('');
  const [manuellCode, setManuellCode] = useState('');
  const [manuellFehler, setManuellFehler] = useState(false);
  const { settings } = useSettings();
  // Sobald die Kopplung steht, gehen Ort, Berechnungsmethode, Madhab,
  // Hochbreiten-Regel, Minuten-Korrektur und Zeitformat EINMAL an den
  // Fernseher — bis 1.2.0 musste der Nutzer beides von Hand gleich einstellen,
  // sonst zeigten Handy und Fernseher verschiedene Gebetszeiten
  // (docs/audit-2026-07-27/HANDY-TV-ABGLEICH.md). Aendert der Nutzer waehrend
  // der Verbindung etwas, geht die Aenderung ebenfalls raus (Abhaengigkeit
  // `settings`).
  useEffect(() => {
    if (status !== 'connected') return;
    sendeEinstellungen(settings);
  }, [status, settings, sendeEinstellungen]);
  // Sprungziele: bevorzugt die Liste, die der Fernseher im Handshake meldet
  // (Audit 2026-07-28, T14) — sonst der eigene Katalog.
  const shortcuts = useMemo(() => tvShortcutsFor(tvScreens), [tvScreens]);
  // Mehrfach-Scans desselben Codes unterdrücken, bis wieder gescannt werden soll.
  const scannedRef = useRef(false);

  const onScan = useCallback(
    ({ data }: { data: string }) => {
      if (scannedRef.current) return;
      const target = parsePairPayload(data);
      if (!target) return;
      scannedRef.current = true;
      connect(target);
    },
    [connect],
  );

  const styles = makeStyles();

  // Sichtbarer Zurueck-Weg (Audit 2026-07-27, U1): alle drei Zustaende dieses
  // Screens hatten keinen — der Root-Stack laeuft mit headerShown:false, und
  // diese Datei ist native-only (Web nutzt tv-connect.web.tsx), es gibt hier
  // also auch keinen schwebenden Web-Chip, der einspringen koennte.
  const backButton = (onDark = false) => (
    <Pressable
      onPress={() => backOr('/more')}
      accessibilityRole="button"
      accessibilityLabel={t('a11y.back')}
      hitSlop={10}
      style={styles.screenBackBtn}>
      <IconSymbol
        name={rtl ? 'chevron-forward' : 'chevron-back'}
        size={24}
        color={onDark ? '#fff' : colors.text}
      />
    </Pressable>
  );

  const manuellVerbinden = () => {
    const ziel = parseManualPair(manuellHost, manuellCode);
    if (!ziel) {
      setManuellFehler(true);
      return;
    }
    setManuellFehler(false);
    scannedRef.current = true;
    connect(ziel);
  };

  /**
   * Der manuelle Weg — sichtbar auf BEIDEN Bildschirmen.
   *
   * Zuerst hing er nur an der Scan-Ansicht, also HINTER der Kamera-Erlaubnis.
   * Genau wer sie ablehnt, kam damit nie an die manuelle Eingabe — obwohl das
   * der Hauptgrund ist, sie zu haben (Bildschirmbefund 2026-08-08 am
   * Handy-Emulator).
   */
  const manuellBlock = () =>
    manuellOffen ? (
      <View style={styles.manualBox}>
        <TextInput
          value={manuellHost}
          onChangeText={(v) => {
            setManuellHost(v);
            setManuellFehler(false);
          }}
          placeholder={t('tvRemote.manualHostPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          style={[styles.manualInput, { color: colors.text, borderColor: colors.separator }]}
        />
        <TextInput
          value={manuellCode}
          onChangeText={(v) => {
            setManuellCode(v);
            setManuellFehler(false);
          }}
          placeholder={t('tvRemote.manualCodePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.manualInput, { color: colors.text, borderColor: colors.separator }]}
        />
        {manuellFehler && (
          <ThemedText type="small" themeColor="accent">
            {t('tvRemote.manualInvalid')}
          </ThemedText>
        )}
        <Pressable onPress={manuellVerbinden} style={[styles.smallBtn, { borderColor: colors.accent }]}>
          <ThemedText type="small" themeColor="accent">
            {t('tvRemote.manualConnect')}
          </ThemedText>
        </Pressable>
      </View>
    ) : (
      <Pressable onPress={() => setManuellOffen(true)}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.manualLink}>
          {t('tvRemote.manualOpen')}
        </ThemedText>
      </Pressable>
    );

  // 1) Kamera-Berechtigung
  if (status === 'idle' && (!permission || !permission.granted)) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.container}>
          <View style={[styles.screenBackRow, rtl && styles.screenBackRowRtl]}>{backButton()}</View>
          <View style={styles.centerArea}>
          <IconSymbol name="tv-outline" size={64} color={colors.accent} />
          <ThemedText type="subtitle" style={styles.centerTitle}>
            {t('tvRemote.title')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            {t('tvRemote.permissionBody')}
          </ThemedText>
          {/* Dauerhaft verweigert (Audit 2026-07-27, N9): requestPermission()
              oeffnet dann keinen Systemdialog mehr — Weg in die Einstellungen.
              Sonst „Weiter"/„Continue" statt „Kamera erlauben" (Apple-
              Ablehnung 1.33.0, Guideline 5.1.1(iv)): der Knopf hinter dem
              eigenen Erklaertext oeffnet nur die Systemabfrage, er erlaubt
              nichts selbst. */}
          <Pressable
            onPress={() =>
              permission && !permission.canAskAgain
                ? void Linking.openSettings()
                : void requestPermission()
            }
            accessibilityRole="button"
            accessibilityLabel={
              permission && !permission.canAskAgain
                ? t('common.openSettings')
                : t('common.continue')
            }
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
            <ThemedText type="smallBold" style={{ color: colors.background }}>
              {permission && !permission.canAskAgain
                ? t('common.openSettings')
                : t('common.continue')}
            </ThemedText>
          </Pressable>
          {manuellBlock()}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Manuelle Eingabe: der Fernseher zeigt unter dem QR-Code „Manuell:
  // host:port · Code …" — bis 1.48.0 konnte das Handy damit nichts anfangen.
  // Wer eine verschmutzte Linse hat, die Kamera-Berechtigung abgelehnt hat oder
  // zu weit weg sitzt, stand vor einer Sackgasse, obwohl alles gross auf dem
  // Schirm stand.
  // 2) Scannen (noch nicht verbunden)
  if (status === 'idle' || status === 'connecting' || status === 'denied' || status === 'error') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
          <SafeAreaView style={styles.scanOverlay} pointerEvents="box-none">
            {/* Absolut positioniert, damit die space-between-Verteilung von
                Sucherrahmen und Hinweiskarte unveraendert bleibt. */}
            <View style={[styles.scanBackRow, rtl && styles.scanBackRowRtl]}>{backButton(true)}</View>
            <View style={styles.scanFrame} />
            <ThemedView type="backgroundElement" style={styles.scanHintCard}>
              <ThemedText type="smallBold" style={styles.scanHint}>
                {status === 'connecting'
                  ? t('tvRemote.connecting')
                  : status === 'denied'
                    ? t('tvRemote.denied')
                    : status === 'error'
                      ? t('tvRemote.error')
                      : t('tvRemote.scanHint')}
              </ThemedText>
              {(status === 'denied' || status === 'error') && (
                <Pressable
                  onPress={() => {
                    scannedRef.current = false;
                    disconnect();
                  }}
                  style={[styles.smallBtn, { borderColor: colors.accent }]}>
                  <ThemedText type="small" themeColor="accent">
                    {t('tvRemote.retry')}
                  </ThemedText>
                </Pressable>
              )}

              {manuellBlock()}
            </ThemedView>
          </SafeAreaView>
        </View>
      </ThemedView>
    );
  }

  // 3) Verbunden — Quiz-Zweitschirm hat Vorrang, sonst Fernbedienung
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.connectedArea}>
        <View style={[styles.screenBackRow, rtl && styles.screenBackRowRtl]}>{backButton()}</View>
        <ScrollView contentContainerStyle={styles.connectedContent}>
          <View style={styles.connectedHeader}>
            <View style={styles.statusDotRow}>
              <View style={[styles.dot, { backgroundColor: '#2E9E4F' }]} />
              <ThemedText type="smallBold">
                {t('tvRemote.connectedTo').replace('{name}', tvName ?? 'Salati TV')}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => {
                scannedRef.current = false;
                disconnect();
              }}>
              <ThemedText type="small" themeColor="accent">
                {t('tvRemote.disconnect')}
              </ThemedText>
            </Pressable>
          </View>

          {quiz && !quiz.final ? (
            <View style={styles.quizArea}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('tvRemote.quizProgress')
                  .replace('{i}', String(quiz.index + 1))
                  .replace('{n}', String(quiz.total))}
              </ThemedText>
              <ThemedText type="subtitle" style={styles.quizQuestion}>
                {quiz.question}
              </ThemedText>
              {quiz.options.map((opt, i) => {
                const isCorrect = quiz.answered && i === quiz.answered.correctOption;
                const isWrong = quiz.answered && !quiz.answered.correct && !isCorrect;
                return (
                  <Pressable
                    key={i}
                    disabled={!!quiz.answered}
                    onPress={() => answerQuiz(i)}
                    style={[
                      styles.quizOption,
                      { borderColor: colors.backgroundSelected },
                      isCorrect && styles.quizCorrect,
                      isWrong && styles.quizWrong,
                    ]}>
                    <ThemedText type="default">{opt}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : quiz?.final ? (
            <View style={styles.quizArea}>
              <ThemedText type="title" themeColor="accent" style={styles.finalScore}>
                {quiz.final.score} / {quiz.final.total}
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                {t('tvRemote.quizDone')}
              </ThemedText>
            </View>
          ) : (
            <>
              {/* Direkt-Sprünge zu TV-Bereichen */}
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {t('tvRemote.openOnTv')}
              </ThemedText>
              <View style={styles.shortcutGrid}>
                {shortcuts.map((sc) => {
                  // Ohne Locale-Schluessel (Bildschirm eines neueren
                  // Fernsehers) steht der Screen-Name selbst da — erreichbar
                  // ohne passende Uebersetzung ist besser als unerreichbar.
                  const label = sc.labelKey ? t(sc.labelKey) : sc.screen;
                  return (
                    <Pressable
                      key={sc.screen}
                      onPress={() => nav(sc.screen)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      style={styles.shortcut}>
                      <ThemedView type="backgroundElement" style={styles.shortcutInner}>
                        <IconSymbol name={sc.icon} size={26} color={colors.accent} />
                        <ThemedText type="small" style={styles.shortcutLabel} numberOfLines={2}>
                          {label}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </View>

              {/* D-Pad */}
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {t('tvRemote.dpad')}
              </ThemedText>
              <View style={styles.dpad}>
                <DpadBtn icon="chevron-up-outline" label={t('a11y.up')} onPress={() => key('up')} />
                <View style={styles.dpadRow}>
                  <DpadBtn icon="chevron-back-outline" label={t('a11y.left')} onPress={() => key('left')} />
                  <Pressable onPress={() => key('select')} style={[styles.okBtn, { backgroundColor: colors.accent }]}>
                    <ThemedText type="smallBold" style={{ color: colors.background }}>
                      OK
                    </ThemedText>
                  </Pressable>
                  <DpadBtn icon="chevron-forward-outline" label={t('a11y.right')} onPress={() => key('right')} />
                </View>
                <DpadBtn icon="chevron-down-outline" label={t('a11y.down')} onPress={() => key('down')} />
                <Pressable onPress={() => key('back')} style={styles.backBtn}>
                  <IconSymbol name="arrow-undo-outline" size={20} color={colors.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('tvRemote.back')}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DpadBtn({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <ThemedView type="backgroundElement" style={dpadBtnStyle.btn}>
        <IconSymbol name={icon} size={26} color={colors.text} />
      </ThemedView>
    </Pressable>
  );
}

const dpadBtnStyle = StyleSheet.create({
  btn: { width: 68, height: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    screenBackRow: { paddingHorizontal: Spacing.three, alignItems: 'flex-start' },
    screenBackRowRtl: { alignItems: 'flex-end' },
    screenBackBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    scanBackRow: { position: 'absolute', top: Spacing.three, left: Spacing.three },
    scanBackRowRtl: { left: undefined, right: Spacing.three },
    centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
    centerTitle: { textAlign: 'center', marginTop: Spacing.two },
    centerText: { textAlign: 'center', maxWidth: 360 },
    primaryBtn: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.five, borderRadius: 999, marginTop: Spacing.two },
    cameraWrap: { flex: 1, backgroundColor: '#000' },
    scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: Spacing.four },
    scanFrame: {
      width: 240,
      height: 240,
      borderRadius: 28,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.9)',
      marginTop: '30%',
    },
    scanHintCard: { borderRadius: 16, padding: Spacing.three, alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.four },
    manualBox: { width: '100%', gap: Spacing.two, marginTop: Spacing.two },
  manualInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  manualLink: { marginTop: Spacing.two, textDecorationLine: 'underline' },
  scanHint: { textAlign: 'center' },
    smallBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
    connectedArea: { flex: 1 },
    connectedContent: { padding: Spacing.four, gap: Spacing.three },
    connectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusDotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    dot: { width: 10, height: 10, borderRadius: 5 },
    sectionLabel: { marginTop: Spacing.two, textTransform: 'uppercase', letterSpacing: 1 },
    shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    shortcut: { flexBasis: '31%', flexGrow: 1 },
    shortcutInner: { borderRadius: 16, paddingVertical: Spacing.three, alignItems: 'center', gap: Spacing.one },
    shortcutLabel: { textAlign: 'center' },
    dpad: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
    dpadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    okBtn: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two, padding: Spacing.two },
    quizArea: { gap: Spacing.three, marginTop: Spacing.two },
    quizQuestion: { marginBottom: Spacing.two },
    quizOption: { borderWidth: 2, borderRadius: 16, padding: Spacing.three },
    quizCorrect: { borderColor: '#2E9E4F', backgroundColor: 'rgba(46,158,79,0.15)' },
    quizWrong: { borderColor: '#D64545', backgroundColor: 'rgba(214,69,69,0.15)' },
    finalScore: { textAlign: 'center', marginTop: Spacing.four },
  });
}

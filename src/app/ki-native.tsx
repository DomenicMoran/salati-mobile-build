// Native Salati KI (iOS/Android) im ZITAT-MODUS.
//
// Die Antwort besteht ausschließlich aus WÖRTLICHEN Passagen der gefundenen
// Quellen (Koran, 40 Nawawi-Hadithe, geprüfte Duas, Salati-Kurstexte und
// kuratiertes Grundwissen) — ausgewählt und zugeschnitten von
// features/ki/zitat.ts, ohne Sprachmodell.
//
// WARUM KEIN MODELL MEHR: 14 Sprachen × 12 Fragen wurden am echten
// Gerätemodell (Qwen2.5-1.5B-Instruct Q4_K_M) gemessen — es drehte Verneinungen
// um, änderte Zahlen und ließ Schritte aus, obwohl die richtige Passage im
// Prompt stand (docs/audit-2026-07-27/KI-SPRACHMESSUNG.md). Auch als reines
// AUSWAHLwerkzeug, das nur wörtlich kopieren sollte, lieferte es in der Hälfte
// der Fälle keinen einzigen belegbaren Satz
// (docs/audit-2026-07-27/KI-ZITATMODUS.md). Der Zitat-Modus erreicht dagegen
// 0 erfundene Aussagen in allen 14 Sprachen — und braucht weder den 1,1-GB-
// Download noch 10–30 Sekunden Rechenzeit je Frage.
//
// Die Web-Version bleibt unabhängig unter public/ki.html (Web-Route dieser
// Datei ist ki-native.web.tsx) und folgt demselben Prinzip.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { abzuschickendeFrage, BEISPIELFRAGEN } from '@/features/ki/beispielfragen';
import { deutscherStand, dokumentNachId, ladeKorpusStand, type KorpusStand } from '@/features/ki/korpus';
import { eindeutigeQuellen, quellenZiel } from '@/features/ki/quellen';
import { istArabisch, suche, type KorpusDoc } from '@/features/ki/retrieval';
import { KORPUS_SPRACHE, sprachHinweise } from '@/features/ki/sprachen';
import { ladeVerlauf, loescheVerlauf, merkeFeedback, speichereVerlauf, type GespeicherteNachricht } from '@/features/ki/verlauf';
import { zitatAntwort } from '@/features/ki/zitat';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

interface ChatMessage {
  role: 'du' | 'ki';
  text: string;
  sources?: KorpusDoc[];
  rtl?: boolean;
  feedback?: 'gut' | 'schlecht';
}

// Minimales Modell-Markdown darstellen statt roher **Sternchen** (analog md()
// in public/ki.html): nur Fett - mehr gibt das 1.5B-Modell praktisch nicht aus.
function renderMitBold(text: string) {
  const teile = text.split(/\*\*([^*\n]+)\*\*/g);
  if (teile.length === 1) return text;
  return teile.map((teil, i) => (i % 2 === 1 ? <ThemedText key={i} type="smallBold">{teil}</ThemedText> : teil));
}

function zuGespeichert(m: ChatMessage): GespeicherteNachricht {
  return {
    role: m.role,
    text: m.text,
    quellen: m.sources?.map((d) => d.id),
    rtl: m.rtl,
    feedback: m.feedback,
  };
}

function ausGespeichert(m: GespeicherteNachricht): ChatMessage {
  return {
    role: m.role,
    text: m.text,
    // Quellen werden als IDs gespeichert und hier aus dem gebündelten Korpus
    // nachgeschlagen; unbekannte IDs (Korpus-Neubau seit dem Speichern) fallen
    // einfach weg, statt den Verlauf unbrauchbar zu machen.
    sources: m.quellen?.map((id) => dokumentNachId(id)).filter((d): d is KorpusDoc => !!d),
    rtl: m.rtl,
    feedback: m.feedback,
  };
}

export default function KiNativeScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [quelleImBlatt, setQuelleImBlatt] = useState<KorpusDoc | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Der BM25-Index über 7.000 Dokumente wird NACH dem ersten Rendern gebaut
  // (~140 ms in Node, auf dem Gerät entsprechend mehr). Als useMemo im
  // Render-Pfad hätte er den Bildschirmaufbau spürbar verzögert; gebraucht wird
  // er erst, wenn die erste Frage abgeschickt wird. Bis dahin ist das
  // Eingabefeld ohnehin über `status` gesperrt.
  //
  // Zweistufig, weil nur Deutsch im Bundle liegt: erst der gebündelte deutsche
  // Stand (sofort verfügbar, kein Netz), dann — falls die App-Sprache eine
  // andere ist — der übersetzte Korpus von R2 (features/ki/korpus.ts). Der
  // Screen wartet auf nichts davon; schlägt das Nachladen fehl, bleibt es beim
  // deutschen Stand und der Hinweis unten sagt das ehrlich.
  const [stand, setStand] = useState<KorpusStand | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    const id = setTimeout(() => {
      if (abgebrochen) return;
      setStand(deutscherStand());
      void ladeKorpusStand(locale).then((s) => {
        if (!abgebrochen) setStand(s);
      });
    }, 0);
    return () => {
      abgebrochen = true;
      clearTimeout(id);
    };
  }, [locale]);

  // Verlauf einmalig laden.
  useEffect(() => {
    let abgebrochen = false;
    void ladeVerlauf().then((verlauf) => {
      if (!abgebrochen) setMessages(verlauf.map(ausGespeichert));
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const korpusSprache = stand?.sprache ?? KORPUS_SPRACHE;
  // Hinweise zur QUELLENLAGE (Bedingungen und Begründung in
  // features/ki/sprachen.ts). Im Zitat-Modus ist die Quellenlage zugleich die
  // Antwortsprache — zitiert werden kann nur, was im Korpus steht.
  const hinweise = sprachHinweise(locale, korpusSprache, stand?.deutsch ?? 0);
  const bereit = stand !== null;

  function verlaufLoeschen() {
    Alert.alert(t('ki.clearHistory'), t('ki.clearHistoryConfirm'), [
      { text: t('common.cancel') ?? 'Abbrechen', style: 'cancel' },
      {
        text: t('ki.clearHistory'),
        style: 'destructive',
        onPress: async () => {
          setMessages([]);
          await loescheVerlauf();
        },
      },
    ]);
  }

  /** Verlauf mit dem aktuellen Stand sichern (letzte MAX_NACHRICHTEN). */
  function sichere(neu: ChatMessage[]) {
    speichereVerlauf(neu.map(zuGespeichert));
  }

  // Bewusst OHNE Zustands-Updater-Funktion: Das Speichern und der Feedback-
  // Eintrag sind Nebenwirkungen und dürfen nicht in setMessages(m => …) stehen —
  // React ruft den Updater unter Umständen zweimal auf, und das Feedback stünde
  // doppelt im lokalen Log.
  function bewerte(i: number, bewertung: 'gut' | 'schlecht') {
    const nachricht = messages[i];
    if (!nachricht || nachricht.feedback) return;
    const kopie = [...messages];
    kopie[i] = { ...nachricht, feedback: bewertung };
    setMessages(kopie);
    sichere(kopie);
    // Die zugehörige Frage steht direkt davor — nur sie ist für eine spätere
    // Korpus-Erweiterung interessant.
    const gestellteFrage = messages[i - 1]?.role === 'du' ? messages[i - 1]!.text : '';
    merkeFeedback(gestellteFrage, bewertung, nachricht.sources?.map((d) => d.src) ?? []);
  }

  function frage(text: string) {
    if (!bereit) return;
    const aktuell: ChatMessage[] = [...messages, { role: 'du', text, rtl: istArabisch(text) }];
    setMessages(aktuell);
    scrollRef.current?.scrollToEnd({ animated: true });

    // 3 Passagen (früher 6, dann 4): Mit dem erweiterten Korpus (7.000
    // Dokumente inkl. kuratiertem Grundwissen) liefern schon die ersten drei
    // Treffer die vollständige Antwort; weitere sind meist nur thematisch
    // benachbart und würden das Zitat mit Fremdem verwässern.
    // Falls der Index noch nicht fertig ist (Frage direkt nach dem Öffnen),
    // wird der deutsche synchron nachgezogen — deutscherStand() cacht intern.
    const passagen = suche(stand?.index ?? deutscherStand().index, text, 3);
    // Der Zitat-Modus rechnet in Millisekunden statt in Sekunden — es gibt
    // deshalb weder einen Ladezustand noch einen Antwort-Cache mehr.
    const ergebnis = passagen.length ? zitatAntwort(text, passagen) : null;
    // Als Quellen NUR die tatsächlich zitierten Dokumente, nicht alle drei
    // Treffer: sonst steht unter der Antwort ein antippbarer Quellen-Chip für
    // eine Passage, aus der kein einziges Wort in der Antwort steht. Genau das
    // tat der Screen bis zum 2026-07-28 (gefunden im Render-Test).
    const zitierte = ergebnis
      ? ergebnis.bloecke.map((b) => passagen.find((d) => d.id === b.id)).filter((d): d is KorpusDoc => !!d)
      : [];
    const fertig: ChatMessage[] = [
      ...aktuell,
      ergebnis && ergebnis.text
        ? { role: 'ki', text: ergebnis.text, sources: zitierte, rtl: istArabisch(ergebnis.text) }
        : { role: 'ki', text: t('ki.noAnswer') },
    ];
    setMessages(fertig);
    sichere(fertig);
  }

  function senden() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    frage(text);
  }

  const leer = messages.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Audit 2026-07-27 (U1/U6): der Screen hatte als einzige der 31
            kopflosen Stack-Routen weiterhin keinen sichtbaren Zurück-Weg.
            Das erledigt der gemeinsame ScreenHeader.
            Das Negativ-Margin gleicht aus, dass der Kopf seinen eigenen
            horizontalen Innenabstand mitbringt und die SafeArea dieses Screens
            bereits einen hat — sonst stünde der Zurück-Chevron 32 statt 16
            Punkte eingerückt, also anders als auf allen anderen Routen. */}
        <View style={styles.headerBleed}>
          <ScreenHeader title={t('ki.title')} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {t('ki.subtitle')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.disclosure}>
          {t('ki.aiDisclosure')}
        </ThemedText>

        {!bereit && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {bereit && (
          <KeyboardAvoidingView style={styles.chatWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView ref={scrollRef} contentContainerStyle={styles.chatList} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              <View style={[styles.bubble, styles.bubbleKi]}>
                <ThemedText type="small">{t('ki.welcome')}</ThemedText>
              </View>

              {/* Eine Karte für die Quellenlage. Im Zitat-Modus ist sie
                  zugleich die Antwortsprache: zitiert werden kann nur, was im
                  geladenen Korpus steht. Die frühere Qualitätswarnung und der
                  Beta-Schalter „Antwort in meiner Sprache" sind entfallen —
                  es wird nicht mehr übersetzt und nicht mehr formuliert. */}
              {hinweise.sichtbar && (
                <ThemedView type="backgroundElement" style={styles.sprachCard}>
                  {/* Quellen sind deutsch — das gehört in jeder anderen
                      App-Sprache ehrlich gesagt, nicht versteckt. */}
                  {hinweise.quellenDeutsch && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('ki.germanSourcesNote')}
                    </ThemedText>
                  )}
                  {/* Quellen liegen übersetzt vor, ein Teil (die kuratierte
                      Wissensschicht) ist aber noch deutsch. */}
                  {hinweise.teilweiseDeutsch && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('ki.partlyGermanSourcesNote')}
                    </ThemedText>
                  )}
                </ThemedView>
              )}

              {leer && (
                <View style={styles.beispiele}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('ki.examplesTitle')}
                  </ThemedText>
                  <View style={styles.beispielReihe}>
                    {/* Gesucht wird mit dem ANGEZEIGTEN Text, sobald ein
                        übersetzter Korpus geladen ist — sonst mit dem
                        deutschen Wortlaut. Begründung in
                        features/ki/beispielfragen.ts. */}
                    {BEISPIELFRAGEN.map((b) => (
                      <PressableCard
                        key={b.labelKey}
                        onPress={() => frage(abzuschickendeFrage(b, t(b.labelKey), korpusSprache))}
                        type="backgroundElement"
                        style={styles.beispielChip}>
                        <ThemedText type="small">{t(b.labelKey)}</ThemedText>
                      </PressableCard>
                    ))}
                  </View>
                </View>
              )}

              {messages.map((msg, i) => (
                <View key={i} style={[styles.bubble, msg.role === 'du' ? styles.bubbleDu : styles.bubbleKi, msg.role === 'du' && { backgroundColor: colors.text }]}>
                  <ThemedText
                    type="small"
                    themeColor={msg.role === 'du' ? 'background' : 'text'}
                    style={msg.rtl ? styles.rtlText : undefined}>
                    {renderMitBold(msg.text)}
                  </ThemedText>
                  {msg.sources && msg.sources.length > 0 && (
                    <View style={styles.quellenBlock}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('ki.sourcesLabel')}
                      </ThemedText>
                      <View style={styles.quellenReihe}>
                        {eindeutigeQuellen(msg.sources).map((doc) => {
                          const ziel = quellenZiel(doc);
                          return (
                            <PressableCard
                              key={doc.id}
                              type="backgroundSelected"
                              style={styles.quelleChip}
                              onPress={() => (ziel.art === 'route' ? ziel.oeffne() : setQuelleImBlatt(doc))}>
                              <ThemedText type="small" themeColor="accent">
                                {doc.src}
                              </ThemedText>
                              <IconSymbol name={ziel.art === 'route' ? 'open-outline' : 'document-text-outline'} size={12} color={colors.accent} />
                            </PressableCard>
                          );
                        })}
                      </View>
                    </View>
                  )}
                  {msg.role === 'ki' && (
                    <View style={styles.feedbackReihe}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {msg.feedback ? t('ki.feedbackThanks') : t('ki.feedbackQuestion')}
                      </ThemedText>
                      {!msg.feedback && (
                        <>
                          <Pressable onPress={() => bewerte(i, 'gut')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('ki.feedbackGood')}>
                            <IconSymbol name="thumbs-up-outline" size={16} color={colors.textSecondary} />
                          </Pressable>
                          <Pressable onPress={() => bewerte(i, 'schlecht')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('ki.feedbackBad')}>
                            <IconSymbol name="thumbs-down-outline" size={16} color={colors.textSecondary} />
                          </Pressable>
                        </>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            {!leer && (
              <View style={styles.chatAktionen}>
                <PressableCard onPress={verlaufLoeschen} type="backgroundElement" style={styles.stopBtn}>
                  <IconSymbol name="trash-outline" size={14} color={colors.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('ki.clearHistory')}
                  </ThemedText>
                </PressableCard>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('ki.inputPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                // Ohne eigenes Label kündigt TalkBack/VoiceOver das Feld je
                // nach Version nur als „Eingabefeld" an — der Platzhalter ist
                // dafür keine verlässliche Quelle.
                accessibilityLabel={t('ki.inputPlaceholder')}
                style={[styles.input, { color: colors.text, borderColor: colors.backgroundSelected }, istArabisch(input) && styles.rtlText]}
                onSubmitEditing={senden}
                returnKeyType="send"
              />
              <PressableCard
                onPress={senden}
                disabled={!input.trim()}
                type="backgroundSelected"
                accessibilityLabel={t('ki.send')}
                style={styles.sendBtn}>
                <IconSymbol name="send" size={16} color={colors.accent} />
              </PressableCard>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* Wissenseinträge haben keinen eigenen Screen — ihr voller Text wird
            hier gezeigt, damit auch sie nachprüfbar bleiben. */}
        <Modal visible={!!quelleImBlatt} transparent animationType="slide" onRequestClose={() => setQuelleImBlatt(null)}>
          <Pressable style={styles.backdrop} accessibilityRole="button" accessibilityLabel={t('a11y.close')} onPress={() => setQuelleImBlatt(null)} />
          <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
            <View style={[styles.sheetHandle, { backgroundColor: colors.textSecondary }]} />
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <ThemedText type="subtitle" style={styles.sheetTitle}>
                  {quelleImBlatt?.src}
                </ThemedText>
                <Pressable onPress={() => setQuelleImBlatt(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('a11y.close')}>
                  <IconSymbol name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ThemedText type="default">{quelleImBlatt?.t}</ThemedText>
            </ScrollView>
          </ThemedView>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two, paddingHorizontal: Spacing.three },
  headerBleed: { marginHorizontal: -Spacing.three },
  deleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  subtitle: { textAlign: 'center', marginTop: Spacing.one },
  disclosure: { textAlign: 'center', marginTop: Spacing.half, marginBottom: Spacing.three, fontStyle: 'italic' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: Spacing.four, gap: Spacing.two, borderRadius: 20 },
  wifiRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.three, marginTop: Spacing.two },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(128,128,128,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  chatWrap: { flex: 1 },
  chatList: { gap: Spacing.two, paddingBottom: Spacing.three },
  bubble: { maxWidth: '90%', borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  bubbleDu: { alignSelf: 'flex-end' },
  bubbleKi: { alignSelf: 'flex-start', backgroundColor: 'rgba(128,128,128,0.12)' },
  quellenBlock: { marginTop: Spacing.one, gap: Spacing.one },
  quellenReihe: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  quelleChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 999 },
  feedbackReihe: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  sprachCard: { padding: Spacing.three, gap: Spacing.two, borderRadius: 16 },
  sprachBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 999 },
  sprachBtnText: { flex: 1 },
  sprachWarnung: { fontStyle: 'italic' },
  beispiele: { gap: Spacing.two, marginTop: Spacing.one },
  beispielReihe: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  beispielChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  chatAktionen: { flexDirection: 'row', justifyContent: 'center', paddingTop: Spacing.one },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  inputRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.three, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 15 },
  sendBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: Spacing.two },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', opacity: 0.4 },
  sheetContent: { padding: Spacing.four, gap: Spacing.three },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  sheetTitle: { flex: 1 },
});

// Vers/Hadith als Bild teilen (nativ): rendert eine kleine Branding-Karte als
// echte RN-View, fotografiert sie per react-native-view-shot in ein PNG und
// öffnet danach das native Share-Sheet via expo-sharing. Web hat dafür bereits
// eine eigene Canvas-Lösung (features/quran/shareImage.ts,
// features/tracker/statsImage.ts — beide `Platform.OS === 'web'`-only, kein
// DOM-Canvas nativ verfügbar), diese Komponente schließt genau die Lücke für
// iOS/Android. Eine gemeinsame Komponente für alle Text-Content-Typen (Quran-
// Vers, Hadith, Weisheit, Dua) statt getrennter Implementierungen — der
// Aufrufer liefert arabischen Text, optionale Umschrift (nur Duas), Übersetzung
// und Quellenangabe; zusätzlich gibt es die Kurs-Abschluss-Variante.
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { forwardRef, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useQuranFont } from '@/features/quran/useQuranFont';
import { buildShareCaption, truncateForShareCard } from '@/features/share/shareCardText';
import { useTranslation } from '@/lib/i18n';

export interface VerseOrHadithShareContent {
  /** Fehlt bei bestehenden Aufrufern (Quran-Reader/Hadith-Detail) weiterhin -
   * `kind` ist nur für die course-complete-Variante unten Pflicht, damit die
   * bestehenden `shareCard.open({...})`-Aufrufe unverändert bleiben. Der
   * Karteninhalt ist für alle Texttypen identisch (arabisch + optionale
   * Umschrift + Übersetzung + Quelle), 'verse'|'wisdom'|'dua' dient nur der
   * Lesbarkeit am Aufrufer. */
  kind?: 'verse' | 'wisdom' | 'dua';
  arabic: string;
  /** Lateinische Umschrift — nur Duas liefern das; zwischen Arabisch und
   * Übersetzung dargestellt. Fehlt bei Vers/Hadith/Weisheit → Zeile entfällt. */
  transliteration?: string;
  translation: string;
  /** z. B. "Al-Baqara 2:255" oder "Sahih al-Bukhari, Hadith 1" */
  source: string;
  /** z. B. "salatibox://quran/2?ayah=255" (s. src/lib/deepLinks.ts) — springt
   * beim Empfänger direkt zur Stelle, sofern die App installiert ist. Optional,
   * damit ältere Aufrufer ohne Deep-Link weiter funktionieren. */
  deepLink?: string;
}

/** Kurs-Abschluss-Karte (Salati Studium, s. features/learn/LessonPlayer.tsx):
 * gleicher Teilen-Mechanismus (react-native-view-shot + expo-sharing) wie
 * Vers/Hadith, aber ohne arabischen Text — stattdessen Kursname + "abgeschlossen". */
export interface CourseCompleteShareContent {
  kind: 'course-complete';
  /** Übersetzter Kursname, z. B. "Aqida - Grundlagen des Glaubens". */
  courseTitle: string;
  /** Anzahl Lektionen des abgeschlossenen Kurses. */
  lessonCount: number;
  /** z. B. "salatibox://study/aqida" (s. src/lib/deepLinks.ts). */
  deepLink?: string;
}

export type ShareCardContent = VerseOrHadithShareContent | CourseCompleteShareContent;

// Lange Hadithe (mehrere Absätze) würden die Karte sonst unlesbar überladen —
// Koran-Verse bleiben durch diese Grenzen in der Praxis fast immer unangetastet.
// Die Karte wächst zusätzlich in der Höhe mit dem Text (kein festes
// aspectRatio mehr, s. `card`-Style) — die Zeichen-Obergrenze hält die Karte
// trotzdem in einem für ein Social-Media-Bild sinnvollen Rahmen, statt bei
// einem langen Hadith auf mehrere Bildschirmhöhen anzuwachsen.
const MAX_ARABIC_CHARS = 220;
const MAX_TRANSLATION_CHARS = 260;

/** Rein visuelle Karte — `collapsable={false}` ist Pflicht, sonst optimiert
 * Android die native View weg und react-native-view-shot findet nichts zum
 * Fotografieren. */
export const ShareCardVisual = forwardRef<View, { content: ShareCardContent }>(function ShareCardVisual(
  { content },
  ref,
) {
  const { t } = useTranslation();
  // Arabisch in der eingestellten Koran-Schrift (features/quran/fonts.ts).
  const quranFont = useQuranFont();
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.borderFrame}>
        <View style={styles.ornament} />
        {content.kind === 'course-complete' ? (
          <>
            <Text style={styles.trophyEmoji}>🏆</Text>
            <Text style={styles.courseCompleteTitle}>{t('share.courseComplete.cardTitle')}</Text>
            <Text style={styles.courseCompleteName}>{content.courseTitle}</Text>
            <Text style={styles.translation}>
              {t('share.courseComplete.cardSubtitle').replace('{n}', String(content.lessonCount))}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.arabic, quranFont.style]}>
              {quranFont.text(truncateForShareCard(content.arabic, MAX_ARABIC_CHARS))}
            </Text>
            {content.transliteration != null && content.transliteration.trim() !== '' && (
              <Text style={styles.transliteration}>
                {truncateForShareCard(content.transliteration, MAX_TRANSLATION_CHARS)}
              </Text>
            )}
            {content.translation.trim() !== '' && (
              <Text style={styles.translation}>
                “{truncateForShareCard(content.translation, MAX_TRANSLATION_CHARS)}”
              </Text>
            )}
            <Text style={styles.source}>{content.source}</Text>
          </>
        )}
        <View style={styles.ornament} />
      </View>
      <Text style={styles.brand}>Salati · salati.pro</Text>
    </View>
  );
});

/** Begleit-Bildunterschrift braucht eine kurze Kennung der geteilten Sache —
 * bei Vers/Hadith die Quellenangabe, beim Kurs-Abschluss den Kursnamen. */
function captionLabel(content: ShareCardContent): string {
  return content.kind === 'course-complete' ? content.courseTitle : content.source;
}

export interface ShareCardModalProps {
  /** null = Modal unsichtbar. */
  content: ShareCardContent | null;
  onClose: () => void;
}

/** Vorschau-Sheet mit Teilen-Button: der Nutzer sieht die generierte Karte,
 * bevor sie über das System-Share-Sheet geht. */
export function ShareCardModal({ content, onClose }: ShareCardModalProps) {
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  // Zeigt den "Link kopiert"-Hinweis nach dem Teilen (nur wenn ein Deep-Link
  // dabei ist, s. Kompromiss-Kommentar unten). Statt eines Reset-Effekts wird
  // die Karte, für die zuletzt kopiert wurde, gemerkt und gegen die aktuelle
  // `content`-Referenz verglichen (State-Ableitung während des Renderns,
  // gleiches Muster wie rangeInitKey/pageIndexSurah in quran/[surah].tsx) —
  // jeder neue `shareCard.open(...)`-Aufruf erzeugt ein neues Objekt, der
  // Hinweis verschwindet dadurch automatisch für eine neue Karte.
  const [linkCopiedForContent, setLinkCopiedForContent] = useState<ShareCardContent | null>(null);
  const linkCopied = content !== null && linkCopiedForContent === content;

  const handleShare = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      // Zwischenablage-Kompromiss: expo-sharing kann in Expo v57 nur EINE
      // Datei teilen, `SharingOptions` hat kein Text-/Message-Feld (geprüft
      // gegen node_modules/expo-sharing/build/Sharing.types.d.ts) — Bild UND
      // Begleittext lassen sich also nicht in einem `shareAsync`-Aufruf
      // übergeben. RN-Core-`Share.share({ message, url })` könnte Text
      // mitgeben, teilt aber keine lokale Bild-Datei zuverlässig auf Android
      // (`Share.share` dokumentiert dort nur `title`/`message`, kein `url`).
      // Statt eine der beiden Fähigkeiten zu verlieren: Bild weiter über
      // expo-sharing teilen UND den Begleittext (Quelle + Deep-Link + App-
      // Hinweis) zusätzlich in die Zwischenablage kopieren, mit sichtbarem
      // Hinweis — viele Ziel-Apps (WhatsApp/Telegram/Instagram-Story-Editor)
      // öffnen nach dem Bild-Teilen ohnehin ein Bildunterschrift-Feld, in das
      // sich der Link direkt einfügen lässt.
      if (content?.deepLink) {
        const caption = buildShareCaption(captionLabel(content), content.deepLink, t('share.linkFooter'));
        await Clipboard.setStringAsync(caption).catch(() => {});
        setLinkCopiedForContent(content);
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.dialogTitle') });
      }
    } catch {
      // Nutzer hat abgebrochen oder Sharing ist nicht verfügbar — bewusst
      // stillschweigend, gleiches Verhalten wie die Web-Canvas-Lösung
      // (shareVerseImage/shareStatsImage schlucken Abbrüche ebenfalls).
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={!!content} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}
        onPress={onClose}
      />
      {/* ScrollView statt eines fest zentrierten Views: ein sehr langer Hadith
          lässt die Karte (bewusst ohne festes aspectRatio, s. `card`-Style)
          höher werden als der Bildschirm — ohne Scroll wären Übersetzung/
          Quelle/Branding am unteren Kartenrand unerreichbar UND (schwerwiegender)
          von react-native-view-shot gar nicht erst mit fotografiert, weil sie
          außerhalb der sichtbaren Karten-Bounds lägen. */}
      <ScrollView
        accessibilityViewIsModal
        importantForAccessibility="yes"
        contentContainerStyle={styles.centerWrap}
        pointerEvents="box-none"
        keyboardShouldPersistTaps="handled">
        {content && <ShareCardVisual ref={cardRef} content={content} />}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionBtn,
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            <ThemedText type="small" themeColor="text">
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel={t('share.action')}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.shareBtn,
              Platform.OS === 'web' ? styles.pressableWeb : undefined,
              pressed && styles.pressed,
            ]}>
            {sharing ? (
              <ActivityIndicator color={Brand.ink} />
            ) : (
              <>
                <IconSymbol name="share-outline" size={16} color={Brand.ink} />
                <Text style={styles.shareBtnText}>{t('share.action')}</Text>
              </>
            )}
          </Pressable>
        </View>
        {linkCopied && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.linkHint}>
            {t('share.linkCopiedHint')}
          </ThemedText>
        )}
      </ScrollView>
    </Modal>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,13,0.6)',
  },
  centerWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_WIDTH * 1.2,
    backgroundColor: Brand.ink,
    borderRadius: Spacing.four,
    borderWidth: 2,
    borderColor: Brand.gold,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderFrame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  ornament: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: Brand.gold,
  },
  trophyEmoji: { fontSize: 40, lineHeight: 52, textAlign: 'center' },
  courseCompleteTitle: {
    color: Brand.gold,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  courseCompleteName: {
    color: Brand.paper,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  arabic: {
    color: Brand.paper,
    fontSize: 24,
    lineHeight: 40,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  transliteration: {
    color: '#a8a08c',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  translation: {
    color: '#cfc8b8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  source: {
    color: Brand.gold,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  brand: {
    color: '#8a8474',
    fontSize: 12,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.three },
  linkHint: { textAlign: 'center', maxWidth: CARD_WIDTH },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  shareBtn: { backgroundColor: Brand.gold },
  shareBtnText: { color: Brand.ink, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  pressableWeb: { cursor: 'pointer' },
});

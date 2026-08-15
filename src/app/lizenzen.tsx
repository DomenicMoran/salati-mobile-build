import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  LICENSE_TEXT_TITLES,
  LICENSE_TEXT_WORKS,
  licenseText,
  licenseTextUrl,
  type LicenseTextId,
} from '@/features/licenses';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/lib/i18n';

/**
 * Quellen- und Lizenzhinweise (Attribution) + beigelegte Lizenz-Volltexte.
 *
 * Bewusst datengetrieben statt 14x uebersetzter Fliesstext: Werk-, Anbieter-
 * und Lizenznamen sind Eigennamen und bleiben in jeder Sprache identisch
 * (Apache-2.0, ODbL, MIT ...). Uebersetzt werden nur die Kategorie-Ueberschriften
 * und die vier Lizenz-Umschreibungen ohne SPDX-Kuerzel (`@`-Praefix ->
 * `lizenzen.terms.*`).
 *
 * Pflichtnennungen, die hier eingeloest werden: ODbL (OpenStreetMap,
 * Open Food Facts), Apache-2.0 (Qwen2.5, tarteel-Whisper, transformers.js),
 * CC BY 3.0 / CC BY-SA 4.0 (zwei der drei mitgelieferten Adhan-Aufnahmen),
 * MIT/ISC (whisper.cpp, e5), KFGQPC-EULA (Hafs-Font), Anbieterbedingungen von
 * HadeethEnc.com (unveraenderte Wiedergabe + Quellennennung).
 *
 * ENTFALLEN am 2026-07-30: die Hadith-Datensaetze von fawazahmed0 und
 * AhmedBaset. Beide standen selbst unter freien Lizenzen, aber die decken die
 * SAMMLUNG, nicht zwingend die enthaltenen Uebersetzungen — deren Rechtekette
 * liess sich nicht bis zum Ursprung belegen. Der Bestand kommt jetzt aus
 * HadeethEnc (Bedingungen s. o.) und den eigenen Repo-Kursdaten.
 * Siehe docs/LIZENZ-AUDIT-2026-07-30.md.
 *
 * VOLLTEXTE (2026-07-27): Wo Salati das Werk SELBST weitergibt — Modelle ueber
 * den eigenen R2-Speicher, Schrift und Bibliotheken im Bundle — reicht die
 * blosse Nennung nicht: Apache-2.0 §4(a) verlangt eine Kopie der Lizenz fuer
 * jeden Empfaenger, MIT/BSD/ISC verlangen Vermerk UND Lizenztext. Diese
 * Eintraege tragen `text` und lassen sich hier aufklappen; die Texte liegen in
 * public/licenses/*.txt (Webseite) bzw. src/features/licenses/texts.json
 * (App-Bundle, offline). Werke, die das Geraet direkt beim Anbieter abruft,
 * geben wir nicht weiter — dort bleibt es bei der Nennung.
 */
interface Entry {
  /** Eigenname des Werks/Anbieters - bewusst nicht uebersetzt. */
  name: string;
  /** SPDX-Kurzname oder `@key` fuer `lizenzen.terms.<key>`. */
  license: string;
  /** Literal-Typ, damit expo-router die URL als ExternalPathString akzeptiert. */
  url?: `https://${string}`;
  /** Gesetzt, wenn wir das Werk selbst weitergeben -> Volltext aufklappbar. */
  text?: LicenseTextId;
}

const CATEGORIES: { key: string; entries: Entry[] }[] = [
  {
    key: 'quran',
    entries: [
      { name: 'Bubenheim & Elyas — King Fahd Complex (KFGQPC)', license: '@providerTerms', url: 'https://qurancomplex.gov.sa' },
      { name: 'alquran.cloud (Islamic Network)', license: '@providerTerms', url: 'https://alquran.cloud' },
      { name: 'Quran.com (Tarteel AI)', license: '@providerTerms', url: 'https://quran.com' },
      // Deutscher Tafsir. Der Autor hat das Werk frei von Copyright und
      // Verlagsrechten gestellt; einzige Auflage ist die Quellennennung —
      // deshalb steht sie hier UND im Tafsir-Picker. Wir liefern den Text von
      // unserem eigenen R2 aus, geben ihn also selbst weiter: der Volltext der
      // Freigabeerklaerung liegt bei (public/licenses/ib-rassoul-tafsir.txt).
      {
        name: "Tafsīr Al-Qur'ān Al-Karīm — Abu-r-Ridā Muhammad Ibn Ahmad Ibn Rassoul (IB Verlag Islamische Bibliothek)",
        license: '@rassoulRelease',
        url: 'https://islamicbulletin.org/de/ebooks/koran/tafsir_al_quran.pdf',
        text: 'ib-rassoul-tafsir',
      },
    ],
  },
  {
    // Die drei Adhan-Aufnahmen liegen IM App-Paket — sie werden also von uns
    // weitergegeben, nicht nur verlinkt. CC BY 3.0 (§4a) und CC BY-SA 4.0
    // (§3a) verlangen dafür Urheber, Lizenzangabe und den Lizenztext bzw.
    // seine URI; CC0 verlangt nichts, die Nennung steht der Vollständigkeit
    // halber trotzdem hier. Herkunftsprüfung je Aufnahme (Phrasenzahl,
    // Tathwib, Rechtekette): docs/audit-2026-07-27/ADHAN-LIZENZEN.md.
    //
    // Die vorangestellte Nummer ist der Name, unter dem die Aufnahme in den
    // Einstellungen zur Wahl steht (AZAN_CHOICES/azanNumber) — ohne sie waere
    // von dort aus nicht erkennbar, welcher Eintrag zu welchem Ruf gehoert.
    //
    // ABGELEITETE FASSUNGEN: aus jeder Aufnahme entsteht für iOS ein < 30 s
    // langer Schnitt (scripts/make-adhan-notification-sounds.mjs); alle drei
    // sind zudem auf -16 LUFS normalisiert und als Mono-MP3 neu codiert. Beim
    // CC-BY-SA-Titel („Azan") steht diese Bearbeitung damit ihrerseits unter
    // CC BY-SA 4.0 — s. lizenzen.changesText.
    key: 'adhan',
    entries: [
      {
        name: 'Adhan 1 — „Beautiful adhan" von Adam-synagda (Wikimedia Commons)',
        license: 'CC0 1.0',
        url: 'https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',
        text: 'cc0-1.0',
      },
      {
        name: 'Adhan 2 — „Azan" von Andrewler (Wikimedia Commons)',
        license: 'CC BY-SA 4.0',
        url: 'https://commons.wikimedia.org/wiki/File:Azan.ogg',
        text: 'cc-by-sa-4.0',
      },
      {
        name: 'Adhan 3 — „Eid al-Fitr Fajr azan at Malmö Mosque" vom Islamic Center Malmö (Wikimedia Commons)',
        license: 'CC BY 3.0',
        url: 'https://commons.wikimedia.org/wiki/File:Eid_al-Fitr_Fajr_azan_at_Malm%C3%B6_Mosque_-_19_August_2012.webm',
        text: 'cc-by-3.0',
      },
    ],
  },
  {
    key: 'recitation',
    entries: [
      { name: 'cdn.islamic.network', license: '@reciterRights', url: 'https://islamic.network' },
      { name: 'audio.qurancdn.com / verses.quran.com', license: '@reciterRights', url: 'https://quran.com' },
      { name: 'mp3quran.net', license: '@reciterRights', url: 'https://mp3quran.net' },
    ],
  },
  {
    key: 'hadith',
    entries: [
      // Pflichtnennung: die Bedingungen von HadeethEnc erlauben die Nutzung
      // nur unveraendert UND mit klarer Quellenangabe (siehe
      // features/hadith/hadeethenc.ts). Der Name ist bewusst der Eigenname
      // der Quelle, wie er dort genannt werden muss.
      { name: 'HadeethEnc.com — Encyclopedia of Translated Prophetic Hadiths', license: '@hadeethencTerms', url: 'https://hadeethenc.com' },
    ],
  },
  {
    key: 'font',
    entries: [
      // Im Bundle enthalten (assets/fonts/kfgqpc-hafs.ttf) -> wir geben die
      // Schrift weiter. Die EULA im Font selbst erlaubt das nur "to any person
      // obtaining a copy of this Font accompanying this license" — der Text
      // muss also mit. Volltext = die Font-interne name-ID 13.
      { name: 'KFGQPC HAFS Uthmanic Script', license: '@fontEula', url: 'https://fonts.qurancomplex.gov.sa', text: 'kfgqpc-hafs-font-eula' },
      // Die sieben waehlbaren Alternativschriften (Einstellungen -> Koran-
      // Schriftart). Alle unter SIL OFL 1.1: Buendeln und Weitergabe mit
      // Software sind ausdruecklich erlaubt, Lizenz + Urhebervermerk muessen
      // mitgeliefert werden (§2) -> Volltext liegt bei, Vermerke in NOTICE.txt.
      { name: 'Amiri Quran', license: 'SIL OFL 1.1', url: 'https://github.com/aliftype/amiri', text: 'ofl-1.1' },
      { name: 'Scheherazade New', license: 'SIL OFL 1.1', url: 'https://software.sil.org/scheherazade/', text: 'ofl-1.1' },
      { name: 'Noto Naskh Arabic', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic', text: 'ofl-1.1' },
      { name: 'Amiri', license: 'SIL OFL 1.1', url: 'https://github.com/aliftype/amiri', text: 'ofl-1.1' },
      { name: 'Lateef', license: 'SIL OFL 1.1', url: 'https://software.sil.org/lateef/', text: 'ofl-1.1' },
      { name: 'Harmattan', license: 'SIL OFL 1.1', url: 'https://software.sil.org/harmattan/', text: 'ofl-1.1' },
      { name: 'Noto Sans Arabic', license: 'SIL OFL 1.1', url: 'https://fonts.google.com/noto/specimen/Noto+Sans+Arabic', text: 'ofl-1.1' },
    ],
  },
  {
    key: 'ai',
    entries: [
      // Wir spiegeln das GGUF auf unserem eigenen R2 -> Weitergabe im Sinne
      // von Apache-2.0 §4. Lizenzkopie + Aenderungshinweis liegen bei.
      // Die App LAEDT das Modell seit dem Zitat-Modus nicht mehr; die Datei ist
      // ueber den Speicher aber weiterhin abrufbar. Solange das so ist, bleibt
      // die Nennung stehen: Attribution zu entfernen, waehrend man noch
      // ausliefert, waere der Verstoss — sie stehen zu lassen, waehrend man es
      // nicht mehr tut, ist folgenlos.
      { name: 'Qwen2.5-1.5B-Instruct (Alibaba Cloud)', license: 'Apache-2.0', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct', text: 'apache-2.0' },
      // Suchmodell der Web-Version (semantische Passagensuche in public/ki.html).
      // Das Gewicht laedt der Browser direkt bei HuggingFace — keine Weitergabe
      // durch uns.
      { name: 'multilingual-e5-small (intfloat)', license: 'MIT', url: 'https://huggingface.co/intfloat/multilingual-e5-small' },
      // Entfallen mit dem Zitat-Modus (2026-07-28, docs/audit-2026-07-27/
      // KI-ZITATMODUS.md): Phi-3.5-mini und MLC WebLLM (die Web-Version fuehrt
      // kein Sprachmodell mehr aus) sowie llama.cpp/llama.rn (die native
      // Bibliothek ist nicht mehr Teil des App-Pakets).
    ],
  },
  {
    key: 'speech',
    entries: [
      { name: 'whisper.cpp / whisper.rn (ggml)', license: 'MIT', url: 'https://github.com/ggml-org/whisper.cpp', text: 'mit' },
      // Ursprungsmodell des Rezitations-Checks. Lizenz am 2026-07-27 über die
      // HuggingFace-API geprüft: Apache-2.0. Die GGML-Datei, die die App lädt,
      // konvertieren wir seit 2026-07-27 SELBST aus genau diesem Modell (mit
      // whisper.cpp convert-h5-to-ggml.py + whisper-quantize q5_0) und liefern
      // sie von unserem eigenen R2 aus — kein fremder Modell-Spiegel mehr.
      // Die Web-Version laeuft ueber unsere eigene ONNX-Konvertierung unter
      // /models/. Beides ist Weitergabe eines abgeleiteten Werks: Lizenzkopie
      // + Aenderungshinweis (Apache-2.0 §4b) liegen bei, siehe NOTICE.
      // Details: docs/audit-2026-07-27/WHISPER-EIGENE-KONVERTIERUNG.md
      { name: 'tarteel-ai/whisper-base-ar-quran (eigene GGML-Konvertierung)', license: 'Apache-2.0', url: 'https://huggingface.co/tarteel-ai/whisper-base-ar-quran', text: 'apache-2.0' },
      { name: 'Transformers.js (Hugging Face)', license: 'Apache-2.0', url: 'https://github.com/huggingface/transformers.js' },
    ],
  },
  {
    key: 'maps',
    entries: [
      { name: '© OpenStreetMap contributors', license: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright', text: 'odbl-1.0' },
      { name: 'Overpass API', license: '@providerTerms', url: 'https://overpass-api.de' },
      { name: 'Nominatim (OSM Foundation)', license: '@providerTerms', url: 'https://nominatim.org' },
      // Leaflet laedt der Browser von unpkg.com — wir buendeln es nicht.
      { name: 'Leaflet', license: 'BSD-2-Clause', url: 'https://leafletjs.com' },
    ],
  },
  {
    key: 'prayerTimes',
    entries: [
      { name: 'AlAdhan API (Islamic Network)', license: '@providerTerms', url: 'https://aladhan.com' },
    ],
  },
  {
    key: 'data',
    entries: [
      { name: 'Open Food Facts', license: 'ODbL 1.0', url: 'https://world.openfoodfacts.org', text: 'odbl-1.0' },
      { name: 'gold-api.com', license: '@providerTerms', url: 'https://gold-api.com' },
      { name: 'Frankfurter', license: '@providerTerms', url: 'https://frankfurter.dev' },
    ],
  },
  {
    key: 'images',
    entries: [{ name: 'Unsplash', license: 'Unsplash License', url: 'https://unsplash.com/license' }],
  },
  {
    key: 'software',
    entries: [
      { name: 'React / React Native', license: 'MIT', url: 'https://react.dev', text: 'mit' },
      { name: 'Expo / Expo Router', license: 'MIT', url: 'https://github.com/expo/expo', text: 'mit' },
      { name: 'Ionicons (@expo/vector-icons)', license: 'MIT', url: 'https://github.com/ionic-team/ionicons', text: 'mit' },
      { name: 'adhan (Batoul Apps)', license: 'MIT', url: 'https://github.com/batoulapps/adhan-js', text: 'mit' },
    ],
  },
];

/**
 * Volltexte, die zu keinem einzelnen Eintrag oben gehoeren: Lizenzen kleinerer
 * Bibliotheken, die im Bundle mitlaufen, plus die Sammlung aller
 * Urheberrechtsvermerke. MIT/BSD/ISC verlangen den ORIGINAL-Vermerk des
 * Rechteinhabers — der steht je Werk im NOTICE, nicht im Lizenztext.
 */
const EXTRA_TEXTS: LicenseTextId[] = ['bsd-2-clause', 'bsd-3-clause', 'isc', '0bsd', 'notice'];

export default function LizenzenScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  // Ein Schluessel = ein aufgeklappter Volltext. Bewusst nur einer gleichzeitig:
  // die Texte sind lang, zwei offene Bloecke machen die Seite unnavigierbar.
  const [offen, setOffen] = useState<string | null>(null);

  const licenseLabel = (license: string) =>
    license.startsWith('@') ? t(`lizenzen.terms.${license.slice(1)}`) : license;

  const renderVolltext = (schluessel: string, id: LicenseTextId) => {
    const aufgeklappt = offen === schluessel;
    return (
      <View style={styles.fullText}>
        <Pressable
          onPress={() => setOffen(aufgeklappt ? null : schluessel)}
          accessibilityRole="button"
          accessibilityState={{ expanded: aufgeklappt }}
          accessibilityLabel={`${LICENSE_TEXT_TITLES[id]} — ${t(aufgeklappt ? 'lizenzen.hideFullText' : 'lizenzen.showFullText')}`}
          style={styles.fullTextToggle}
        >
          <IconSymbol name={aufgeklappt ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.accent} />
          <ThemedText type="small" themeColor="accent">
            {t(aufgeklappt ? 'lizenzen.hideFullText' : 'lizenzen.showFullText')}
          </ThemedText>
        </Pressable>
        {aufgeklappt ? (
          <ThemedView type="backgroundSelected" style={styles.fullTextBox}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              {t('lizenzen.originalOnly')}
            </ThemedText>
            <ScrollView style={styles.fullTextScroll} nestedScrollEnabled>
              {/* selectable: Nutzer sollen den Text kopieren koennen — eine
                  Lizenz, die man nicht herauskopieren kann, ist unpraktisch. */}
              <ThemedText type="code" selectable style={styles.fullTextBody}>
                {licenseText(id)}
              </ThemedText>
            </ScrollView>
            <ExternalLink href={licenseTextUrl(id)} style={styles.link}>
              <ThemedText type="small" themeColor="accent">
                {licenseTextUrl(id).replace('https://', '')}
              </ThemedText>
            </ExternalLink>
          </ThemedView>
        ) : null}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('lizenzen.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('lizenzen.subtitle')}
          </ThemedText>

          <ThemedView type="backgroundSelected" style={styles.introBox}>
            <ThemedText type="small" style={styles.paragraph}>
              {t('lizenzen.intro')}
            </ThemedText>
          </ThemedView>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('lizenzen.distributedSection').toUpperCase()}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.sectionBody}>
              <ThemedText type="small" style={styles.paragraph}>
                {t('lizenzen.distributedText')}
              </ThemedText>
            </ThemedView>
          </View>

          {CATEGORIES.map((category) => (
            <View key={category.key} style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {t(`lizenzen.categories.${category.key}`).toUpperCase()}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.sectionBody}>
                {category.entries.map((entry) => (
                  <View key={entry.name} style={styles.entry}>
                    <ThemedText type="small">{entry.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {licenseLabel(entry.license)}
                    </ThemedText>
                    {entry.url ? (
                      <ExternalLink href={entry.url} style={styles.link}>
                        <ThemedText type="small" themeColor="accent">
                          {entry.url.replace('https://', '')}
                        </ThemedText>
                      </ExternalLink>
                    ) : null}
                    {entry.text ? renderVolltext(`${category.key}:${entry.name}`, entry.text) : null}
                  </View>
                ))}
              </ThemedView>
            </View>
          ))}

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('lizenzen.moreTextsSection').toUpperCase()}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.sectionBody}>
              <ThemedText type="small" style={styles.paragraph}>
                {t('lizenzen.moreTextsIntro')}
              </ThemedText>
              {EXTRA_TEXTS.map((id) => (
                <View key={id} style={styles.entry}>
                  <ThemedText type="small">{LICENSE_TEXT_TITLES[id]}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${t('lizenzen.appliesTo')} ${LICENSE_TEXT_WORKS[id]}`}
                  </ThemedText>
                  {renderVolltext(`extra:${id}`, id)}
                </View>
              ))}
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('lizenzen.changesSection').toUpperCase()}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.sectionBody}>
              <ThemedText type="small" style={styles.paragraph}>
                {t('lizenzen.changesText')}
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('lizenzen.ownContentSection').toUpperCase()}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.sectionBody}>
              <ThemedText type="small" style={styles.paragraph}>
                {t('lizenzen.ownContentText')}
              </ThemedText>
            </ThemedView>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('lizenzen.noticeSection').toUpperCase()}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.sectionBody}>
              <ThemedText type="small" style={styles.paragraph}>
                {t('lizenzen.noticeText')}
              </ThemedText>
            </ThemedView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { marginBottom: Spacing.two },
  introBox: { padding: Spacing.four, borderRadius: Spacing.three, marginBottom: Spacing.two },
  section: { gap: Spacing.two },
  sectionLabel: { marginLeft: Spacing.one },
  sectionBody: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.three },
  entry: { gap: Spacing.half },
  link: { lineHeight: 20 },
  paragraph: { lineHeight: 20 },
  fullText: { marginTop: Spacing.one },
  // 44pt Mindest-Tapziel (Apple/Material) — der Text allein waere ~20pt hoch.
  fullTextToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
  fullTextBox: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  // Begrenzte Hoehe mit eigenem Scroll: sonst schoebe der Apache-Text (11 kB)
  // alle folgenden Abschnitte ausser Sichtweite.
  fullTextScroll: { maxHeight: 320 },
  // Die Lizenztexte sind englisch. In den RTL-Sprachen (ar/fa/ur/ps) wuerde die
  // Zeilenausrichtung sonst spiegeln und die eingerueckten Absaetze der
  // Apache-Lizenz zerreissen.
  fullTextBody: { textAlign: 'left', writingDirection: 'ltr' },
});

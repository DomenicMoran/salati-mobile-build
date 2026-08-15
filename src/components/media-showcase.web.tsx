// Web-only Abschnitt der Landingpage (salati.pro): stellt die Inhalts-Angebote
// jenseits der App-Features vor — Podcast (Spotify), Lern-Videos (YouTube),
// Reels (Instagram) und PDF-Handouts. Bewusst self-contained mit eigener
// Sprach-Map (statt src/locales/*.json), damit die Landingpage-Erweiterung
// keine geteilten Locale-Dateien anfasst und rein im Web-Bundle bleibt (der
// Native-Build zieht index.tsx, nie diese .web.tsx). Muster/Tokens gespiegelt
// aus index.web.tsx (ScrollReveal, ThemedView-Karten, IconSymbol, Spacing).
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation, type Locale } from '@/lib/i18n';

const SPOTIFY_URL = 'https://open.spotify.com/show/033U0teP7zMDXYm3zQ3fje';
const YOUTUBE_URL = 'https://www.youtube.com/channel/UCzqiyiWVFK9NY4k0OD850Lw';
const INSTAGRAM_URL = 'https://www.instagram.com/salati.pro';

type CardKey = 'podcast' | 'videos' | 'reels' | 'handouts';

const CARDS: { key: CardKey; icon: IconName; url: string | null }[] = [
  { key: 'podcast', icon: 'musical-notes', url: SPOTIFY_URL },
  { key: 'videos', icon: 'logo-youtube', url: YOUTUBE_URL },
  { key: 'reels', icon: 'logo-instagram', url: INSTAGRAM_URL },
  { key: 'handouts', icon: 'document-text-outline', url: null },
];

interface CardText {
  t: string;
  d: string;
}
interface MediaStrings {
  section: string;
  podcast: CardText;
  videos: CardText;
  reels: CardText;
  handouts: CardText;
  inApp: string;
}

// Kurz gehaltene Texte je Sprache — Terminologie gespiegelt aus den
// Store-Listings (store/listing/*.md), damit App-Store und Website dieselbe
// Sprache sprechen. Plattform-Namen (Spotify/YouTube/Instagram) bleiben roh.
const STR: Record<Locale, MediaStrings> = {
  de: {
    section: 'Podcast, Videos & Reels',
    podcast: { t: 'Podcast', d: '„Sprache des Koran" — Koran-Arabisch Folge für Folge.' },
    videos: { t: 'Lern-Videos', d: 'Grammatik- und Vokabel-Tabellen sowie Lektions-Clips.' },
    reels: { t: 'Reels', d: 'Kurze Lern-Clips für zwischendurch.' },
    handouts: { t: 'PDF-Handouts', d: 'Lernunterlagen zum Download — direkt in der App.' },
    inApp: 'In der App',
  },
  en: {
    section: 'Podcast, videos & reels',
    podcast: { t: 'Podcast', d: '"Language of the Quran" — Quranic Arabic, episode by episode.' },
    videos: { t: 'Learning videos', d: 'Grammar and vocabulary tables plus lesson clips.' },
    reels: { t: 'Reels', d: 'Short learning clips for on the go.' },
    handouts: { t: 'PDF handouts', d: 'Downloadable study material — right inside the app.' },
    inApp: 'In the app',
  },
  tr: {
    section: 'Podcast, video ve Reels',
    podcast: { t: 'Podcast', d: '„Kur’an’ın Dili" — Kur’an Arapçası, bölüm bölüm.' },
    videos: { t: 'Öğrenme videoları', d: 'Dil bilgisi ve kelime tabloları ile ders klipleri.' },
    reels: { t: 'Reels', d: 'Yol üstü için kısa öğrenme klipleri.' },
    handouts: { t: 'PDF belgeler', d: 'İndirilebilir çalışma materyalleri — doğrudan uygulamada.' },
    inApp: 'Uygulamada',
  },
  ar: {
    section: 'بودكاست وفيديوهات وريلز',
    podcast: { t: 'بودكاست', d: '«لغة القرآن» — عربية القرآن حلقة تلو الأخرى.' },
    videos: { t: 'فيديوهات تعليمية', d: 'جداول القواعد والمفردات ومقاطع الدروس.' },
    reels: { t: 'ريلز', d: 'مقاطع تعليمية قصيرة للطريق.' },
    handouts: { t: 'ملفات PDF', d: 'مواد تعليمية للتنزيل — داخل التطبيق مباشرة.' },
    inApp: 'داخل التطبيق',
  },
  es: {
    section: 'Podcast, vídeos y Reels',
    podcast: { t: 'Podcast', d: '«La lengua del Corán» — árabe coránico, episodio a episodio.' },
    videos: { t: 'Vídeos de aprendizaje', d: 'Tablas de gramática y vocabulario y clips de lecciones.' },
    reels: { t: 'Reels', d: 'Clips de aprendizaje breves para cualquier momento.' },
    handouts: { t: 'PDF descargables', d: 'Material de estudio para descargar — dentro de la app.' },
    inApp: 'En la app',
  },
  fr: {
    section: 'Podcast, vidéos et Reels',
    podcast: { t: 'Podcast', d: '« La langue du Coran » — l’arabe coranique, épisode par épisode.' },
    videos: { t: 'Vidéos d’apprentissage', d: 'Tableaux de grammaire et de vocabulaire et clips de leçons.' },
    reels: { t: 'Reels', d: 'Courts clips d’apprentissage pour tous les moments.' },
    handouts: { t: 'PDF à télécharger', d: 'Supports d’étude à télécharger — directement dans l’app.' },
    inApp: 'Dans l’app',
  },
  id: {
    section: 'Podcast, video & Reels',
    podcast: { t: 'Podcast', d: '„Bahasa Al-Qur’an" — bahasa Arab Al-Qur’an per episode.' },
    videos: { t: 'Video pembelajaran', d: 'Tabel tata bahasa dan kosakata serta klip pelajaran.' },
    reels: { t: 'Reels', d: 'Klip belajar singkat untuk di perjalanan.' },
    handouts: { t: 'PDF unduhan', d: 'Materi belajar untuk diunduh — langsung di aplikasi.' },
    inApp: 'Di aplikasi',
  },
  bn: {
    section: 'পডকাস্ট, ভিডিও ও রিলস',
    podcast: { t: 'পডকাস্ট', d: '„কুরআনের ভাষা" — কুরআনি আরবি পর্ব ধরে ধরে।' },
    videos: { t: 'শেখার ভিডিও', d: 'ব্যাকরণ ও শব্দভান্ডার টেবিল এবং পাঠ ক্লিপ।' },
    reels: { t: 'রিলস', d: 'চলার পথে ছোট শেখার ক্লিপ।' },
    handouts: { t: 'PDF হ্যান্ডআউট', d: 'ডাউনলোডযোগ্য শেখার উপকরণ — সরাসরি অ্যাপে।' },
    inApp: 'অ্যাপে',
  },
  fa: {
    section: 'پادکست، ویدیو و ریلز',
    podcast: { t: 'پادکست', d: '«زبان قرآن» — عربی قرآن قسمت‌به‌قسمت.' },
    videos: { t: 'ویدیوهای آموزشی', d: 'جدول‌های دستور و واژگان و کلیپ‌های درس.' },
    reels: { t: 'ریلز', d: 'کلیپ‌های آموزشی کوتاه برای مسیر.' },
    handouts: { t: 'جزوه‌های PDF', d: 'منابع آموزشی برای دانلود — مستقیم در برنامه.' },
    inApp: 'در برنامه',
  },
  ms: {
    section: 'Podcast, video & Reels',
    podcast: { t: 'Podcast', d: '„Bahasa Al-Quran" — bahasa Arab Al-Quran episod demi episod.' },
    videos: { t: 'Video pembelajaran', d: 'Jadual tatabahasa dan kosa kata serta klip pelajaran.' },
    reels: { t: 'Reels', d: 'Klip pembelajaran pendek untuk dalam perjalanan.' },
    handouts: { t: 'PDF muat turun', d: 'Bahan pembelajaran untuk dimuat turun — terus dalam apl.' },
    inApp: 'Dalam apl',
  },
  ur: {
    section: 'پوڈکاسٹ، ویڈیوز اور ریلز',
    podcast: { t: 'پوڈکاسٹ', d: '”قرآن کی زبان“ — قرآنی عربی قسط بہ قسط۔' },
    videos: { t: 'سیکھنے کے ویڈیوز', d: 'گرامر اور الفاظ کی جدولیں اور اسباق کی کلپس۔' },
    reels: { t: 'ریلز', d: 'راستے کے لیے مختصر سیکھنے کی کلپس۔' },
    handouts: { t: 'PDF ہینڈآؤٹس', d: 'ڈاؤن لوڈ کے قابل سیکھنے کا مواد — براہِ راست ایپ میں۔' },
    inApp: 'ایپ میں',
  },
  ru: {
    section: 'Подкаст, видео и Рилс',
    podcast: { t: 'Подкаст', d: '«Язык Корана» — коранический арабский выпуск за выпуском.' },
    videos: { t: 'Обучающие видео', d: 'Таблицы грамматики и лексики и клипы уроков.' },
    reels: { t: 'Рилс', d: 'Короткие обучающие клипы в дорогу.' },
    handouts: { t: 'PDF-материалы', d: 'Учебные материалы для скачивания — прямо в приложении.' },
    inApp: 'В приложении',
  },
  sw: {
    section: 'Podikasti, video na Reels',
    podcast: { t: 'Podikasti', d: '„Lugha ya Qurani" — Kiarabu cha Qurani kipindi baada ya kipindi.' },
    videos: { t: 'Video za kujifunza', d: 'Majedwali ya sarufi na msamiati na klipu za masomo.' },
    reels: { t: 'Reels', d: 'Klipu fupi za kujifunza za safarini.' },
    handouts: { t: 'PDF za kupakua', d: 'Nyenzo za kujifunza za kupakua — ndani ya programu.' },
    inApp: 'Ndani ya programu',
  },
  ps: {
    section: 'پوډکاسټ، ویډیو او ریلز',
    podcast: { t: 'پوډکاسټ', d: '«د قرآن ژبه» — د قرآن عربي برخه په برخه.' },
    videos: { t: 'زده‌کړیز ویډیوګانې', d: 'د ګرامر او لغتونو جدولونه او د لوست کلیپونه.' },
    reels: { t: 'ریلز', d: 'د لارې لپاره لنډ زده‌کړیز کلیپونه.' },
    handouts: { t: 'PDF لارښودونه', d: 'د ښوونې مواد د ښکته کولو لپاره — مستقیم په اپ کې.' },
    inApp: 'په اپ کې',
  },
};

export function MediaShowcase() {
  const { locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const s = STR[locale] ?? STR.en;

  return (
    <View style={styles.wrap}>
      <ScrollReveal style={styles.sectionTitle}>
        <ThemedText type="subtitle">{s.section}</ThemedText>
      </ScrollReveal>
      <View style={styles.grid}>
        {CARDS.map((card, i) => {
          const text = s[card.key];
          const footer = card.url ? platformName(card.key) : s.inApp;
          const body = (
            <ThemedView type="backgroundElement" style={[styles.card, styles.cardShadow]}>
              <ThemedView type="backgroundSelected" style={styles.iconBadge}>
                <IconSymbol name={card.icon} size={22} color={colors.accent} />
              </ThemedView>
              <ThemedText type="smallBold" style={styles.cardTitle}>
                {text.t}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {text.d}
              </ThemedText>
              <View style={styles.footerRow}>
                <ThemedText type="small" themeColor="accent">
                  {footer}
                </ThemedText>
                <IconSymbol
                  name={card.url ? 'open-outline' : 'download-outline'}
                  size={13}
                  color={colors.accent}
                />
              </View>
            </ThemedView>
          );
          return (
            <ScrollReveal key={card.key} delay={(i % 4) * 60} style={styles.cardWrap}>
              {card.url ? (
                <Pressable
                  onPress={() => Linking.openURL(card.url as string)}
                  accessibilityRole="link"
                  style={styles.pressable}>
                  {body}
                </Pressable>
              ) : (
                body
              )}
            </ScrollReveal>
          );
        })}
      </View>
    </View>
  );
}

function platformName(key: CardKey): string {
  if (key === 'podcast') return 'Spotify';
  if (key === 'videos') return 'YouTube';
  if (key === 'reels') return 'Instagram';
  return '';
}

const styles = StyleSheet.create({
  pressable: { cursor: 'pointer' },
  wrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', alignItems: 'center' },
  sectionTitle: {
    textAlign: 'center',
    marginTop: Spacing.six,
    marginBottom: Spacing.four,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    width: '100%',
  },
  // Flex-Props gehören auf den ScrollReveal-Wrapper (das Flex-Kind der Reihe),
  // nicht auf die Karte — sonst wirkt flexBasis als Höhe (RN column-Wrapper).
  cardWrap: { flexBasis: 240, flexGrow: 1, maxWidth: 280 },
  card: {
    flexGrow: 1,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  cardShadow: {
    boxShadow: '0 1px 3px rgba(11,11,13,0.06), 0 4px 12px rgba(11,11,13,0.06)',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { marginTop: Spacing.one },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});

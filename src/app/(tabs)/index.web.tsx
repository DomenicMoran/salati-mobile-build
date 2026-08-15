// Web-only Landingpage (Expo-Router-Web-Override wie app-tabs.web.tsx):
// Erstbesucher auf www.salati.pro landen hier statt direkt auf der
// Gebetszeiten-Live-Ansicht. Native Builds (iOS/Android) nutzen weiter
// index.tsx unverändert.
import { Image } from 'expo-image';
import { useState, useRef } from 'react';
import { Link } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { StarClusterDecoration } from '@/components/decorative-pattern';
import { MediaShowcase } from '@/components/media-showcase.web';
import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

const FEATURES: { icon: IconName; titleKey: string; descKey: string }[] = [
  { icon: 'time-outline', titleKey: 'landing.f1Title', descKey: 'landing.f1Desc' },
  { icon: 'book-outline', titleKey: 'landing.f2Title', descKey: 'landing.f2Desc' },
  { icon: 'school-outline', titleKey: 'landing.f3Title', descKey: 'landing.f3Desc' },
  { icon: 'library-outline', titleKey: 'landing.f4Title', descKey: 'landing.f4Desc' },
  { icon: 'chatbubbles-outline', titleKey: 'landing.f5Title', descKey: 'landing.f5Desc' },
  { icon: 'location-outline', titleKey: 'landing.f6Title', descKey: 'landing.f6Desc' },
  { icon: 'trophy-outline', titleKey: 'landing.f7Title', descKey: 'landing.f7Desc' },
  { icon: 'shield-checkmark-outline', titleKey: 'landing.f8Title', descKey: 'landing.f8Desc' },
];

// WebP statt der Store-PNGs, in zwei Breiten (scripts/optimize-web-images.mjs):
// expo-image baut aus dem Array ein srcset + sizes="auto" (responsivePolicy
// 'static' ist Default und braucht loading="lazy", s. u.) — das Handy lädt die
// 480w-Datei. Vorher: 7 PNGs à 780x1733 = 1.783.958 B, jetzt 480w = 150.680 B.
// Die PNGs bleiben im Repo, sie sind die Quelle für Play-/App-Store-Uploads.
// Quelle der PNGs seit 2026-07-29: echte Geraete-Aufnahmen der Release-APK
// 1.39.0 (store-assets/device/phone/de-DE, scripts/device-screenshots.mjs) —
// also derselbe Stand wie im Play Store, inkl. des ueberarbeiteten
// Einstellungs-Bildschirms und der Salati KI. Alle neun liegen hinter dem
// ersten Viewport und werden lazy + priority="low" geladen; das LCP-Element
// (Hero-<img>) bleibt davon unberuehrt.
const SCREENSHOTS = [
  [require('../../../assets/marketing/shot-prayer-480w.webp'), require('../../../assets/marketing/shot-prayer-780w.webp')],
  [require('../../../assets/marketing/shot-quran-480w.webp'), require('../../../assets/marketing/shot-quran-780w.webp')],
  [require('../../../assets/marketing/shot-ki-480w.webp'), require('../../../assets/marketing/shot-ki-780w.webp')],
  [require('../../../assets/marketing/shot-settings-480w.webp'), require('../../../assets/marketing/shot-settings-780w.webp')],
  [require('../../../assets/marketing/shot-qibla-480w.webp'), require('../../../assets/marketing/shot-qibla-780w.webp')],
  [require('../../../assets/marketing/shot-tracker-480w.webp'), require('../../../assets/marketing/shot-tracker-780w.webp')],
  [require('../../../assets/marketing/shot-names-480w.webp'), require('../../../assets/marketing/shot-names-780w.webp')],
  [require('../../../assets/marketing/shot-tasbih-480w.webp'), require('../../../assets/marketing/shot-tasbih-780w.webp')],
  [require('../../../assets/marketing/shot-calendar-480w.webp'), require('../../../assets/marketing/shot-calendar-780w.webp')],
];

// Tablet-Aufnahmen der Release-APK 1.41.0 (store-assets/device/ipad, 2048x2732,
// Statusleiste des Emulators oben abgeschnitten). Sie zeigen das, was an 1.41.0
// neu ist: zweispaltige Startseite, zweispaltige Einstellungen. Erzeugt von
// scripts/optimize-web-images.mjs; 600w = 2x der Anzeigebreite, 900w fuer
// Desktop.
const TABLET_SHOTS = [
  [require('../../../assets/marketing/tablet-prayer-600w.webp'), require('../../../assets/marketing/tablet-prayer-900w.webp')],
  [require('../../../assets/marketing/tablet-settings-600w.webp'), require('../../../assets/marketing/tablet-settings-900w.webp')],
  [require('../../../assets/marketing/tablet-ki-600w.webp'), require('../../../assets/marketing/tablet-ki-900w.webp')],
];

// Hero-Foto = das LCP-Element dieser Seite. Es wird bewusst NICHT über
// expo-image/ImageBackground eingebunden, sondern als rohes <img>:
//
// Beim statischen Export (`output: 'static'`) rendert expo-image serverseitig
// nur ein leeres <div data-expoimage="true"> — das <img> hängt es erst nach der
// Hydration ein. Der Browser kann das Bild also frühestens anfordern, wenn
// ~1,8 MB JavaScript geladen, geparst und ausgeführt sind. Gemessen (Playwright,
// Moto-G-Profil: 4x CPU-Drossel, Slow 4G): FCP 0,63 s, aber LCP 12,4 s — bei
// einem Bild von nur 118 KB. Ein echtes <img> steht dagegen im ausgelieferten
// HTML und wird vom Preload-Scanner gefunden, bevor überhaupt ein Skript läuft.
//
// require() liefert beim Metro-Web-Export { uri, width, height } mit gehashtem
// Pfad unter /assets/ (immutable-Header, s. vercel.json) — kein Hardcoding.
//
// Layout: das <img> liegt absolut über der vollen Fläche des Hero-Containers mit
// zIndex -1. react-native-web gibt JEDEM <View> `position: relative; z-index: 0`
// (View/index.js styles.view$raw), der Hero-Container ist damit ein eigener
// Stacking-Context: das Bild bleibt darin gefangen und malt über dessen
// Hintergrund, aber unter Überzug, Sternen und allen Textblöcken — exakt die
// Semantik, die ImageBackground vorher hatte.
//
// Nur in dieser .web.tsx-Datei; native rendert weiterhin index.tsx.
const HERO = require('../../../assets/images/landing/landing-hero-800w.webp') as {
  uri: string;
  width: number;
  height: number;
};

const heroImageStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  zIndex: -1,
} as const;

// Salati TV (de.salatibox.tv) — kostenlose Begleit-App für Android TV / Google
// TV / Fire TV. 16:9-Screenshots aus apps/tv/screenshots (Gerätetest-verifiziert).
// 640w-WebP (= 2x der 320-CSS-px-Anzeige, s. styles.tvShot) statt der
// 1920x1080-PNGs: 605.907 B -> 67.784 B.
// Neu aufgenommen am 2026-08-11 aus 1.8.1, auf Deutsch (die Seite startet
// deutsch) und im Android-TV-Emulator, gesteuert ueber Deep Links:
// apps/tv/scripts/androidtv-screenshots.mjs. Vorher stammten sie aus 1.4.0 und
// waren englisch.
// Die 640w-Fassungen erzeugt scripts/optimize-web-images.mjs; „settings" fehlte
// dort bis zum 2026-08-11 in der Liste, obwohl die Seite es anzeigt: die Datei
// wurde also bei jedem Durchlauf uebersehen und blieb stehen.
const TV_SHOTS = [
  require('../../../assets/marketing/tv/tv-clock-640w.webp'),
  require('../../../assets/marketing/tv/tv-quran-640w.webp'),
  require('../../../assets/marketing/tv/tv-home-640w.webp'),
  require('../../../assets/marketing/tv/tv-settings-640w.webp'),
  require('../../../assets/marketing/tv/tv-reciters-640w.webp'),
  require('../../../assets/marketing/tv/tv-quiz-640w.webp'),
  require('../../../assets/marketing/tv/tv-pairing-640w.webp'),
];

const TV_FEATURES: { icon: IconName; titleKey: string; descKey: string }[] = [
  { icon: 'time-outline', titleKey: 'landing.tvF1Title', descKey: 'landing.tvF1Desc' },
  { icon: 'radio-outline', titleKey: 'landing.tvF2Title', descKey: 'landing.tvF2Desc' },
  { icon: 'phone-portrait-outline', titleKey: 'landing.tvF3Title', descKey: 'landing.tvF3Desc' },
];

// Salati TV ist seit dem 2026-08-07 im Play Store öffentlich auffindbar —
// nachgemessen, nicht angenommen: play.google.com/store/apps/details?id=
// de.salatibox.tv antwortet mit 200 und dem Listing „Salati TV — Gebetszeiten".
// Damit ist der Badge klickbar und trägt landing.tvBadgeLive statt „Bald im
// Google Play Store".
const TV_PLAY_URL: string | null = 'https://play.google.com/store/apps/details?id=de.salatibox.tv';

// Direkt-Download der TV-App — dieselbe signierte Datei, die auch bei Play
// liegt (apps/tv/scripts/upload-apk-r2.mjs prueft Signatur, alle vier ABIs und
// die acht Koran-Schriften, bevor sie hochgeht). Gebraucht fuer Fire-TV-Sticks:
// dort gibt es keinen Play Store, die App laesst sich aber seitenladen.
const TV_APK_URL = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/app/salati-tv.apk';

// Vertrauens-Versprechen (User-Direktive: kostenlos/werbefrei/lokal MUSS
// prominent auf die Seite) — Reihenfolge = Wichtigkeit.
const TRUST: { icon: IconName; titleKey: string; descKey: string }[] = [
  { icon: 'gift-outline', titleKey: 'landing.trust1Title', descKey: 'landing.trust1Desc' },
  { icon: 'eye-off-outline', titleKey: 'landing.trust2Title', descKey: 'landing.trust2Desc' },
  { icon: 'hardware-chip-outline', titleKey: 'landing.trust3Title', descKey: 'landing.trust3Desc' },
  { icon: 'cloud-offline-outline', titleKey: 'landing.trust4Title', descKey: 'landing.trust4Desc' },
];

// FAQ (Audit 2026-07-19 F3): aufklappbare Einträge vor dem Footer. Bewusst
// eigener useState-Toggle statt components/ui/collapsible.tsx - dessen
// Doku-Styling (Mini-Chevron-Button, eingerückter Inhalt) passt nicht zum
// Karten-Look der Landingpage. Das statische FAQPage-JSON-LD dazu liegt in
// app/+html.tsx (englischer Default, sprachunabhängig ausgeliefert).
const FAQ_COUNT = 8;

// Audit 2026-07-21: per Apples oeffentlicher Lookup-API (itunes.apple.com/
// lookup?id=6791867298) bestaetigt live ("Ready for Sale", resultCount 1,
// trackName "Salati Islam") - Play Store (de.salatibox.de) liefert dagegen
// noch ein echtes 404 auf play.google.com, also dort bewusst weiter
// "Bald verfuegbar" stehen lassen statt eines toten Links.
const APP_STORE_URL = 'https://apps.apple.com/app/id6791867298';
// APK als EINZELDATEI auf Cloudflare R2 (direkter Download, kein langsames
// Client-seitiges Zusammensetzen mehrerer Teile mehr). Content-Type ist
// application/vnd.android.package-archive -> Browser lädt sie als salati.apk.
const APK_URL = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev/app/salati.apk';
// DIE EINE STELLE für die Play-Store-Aussage der Handy-App.
//
// Stand 2026-08-07: Die Erstprüfung ist durch, der Eintrag ist öffentlich —
// nachgemessen, nicht angenommen: play.google.com/store/apps/details?id=
// de.salatibox.de antwortet mit 200 und dem Listing „Salati — Gebetszeiten &
// Koran". Damit blendet der Hero den Play-Button ein und der Hinweis wechselt
// automatisch auf landing.heroDownloadNotePlay (ohne „in Kürze"); alle 14
// Sprachen tragen die Texte bereits.
//
// Falls der Eintrag je wieder verschwindet: hier auf null zurücksetzen. Ein
// Store-Versprechen ohne Store ist ein Versprechen ohne Lieferung.
const PLAY_URL: string | null = 'https://play.google.com/store/apps/details?id=de.salatibox.de';

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  return (
    <ThemedView type="backgroundElement" style={styles.faqCard}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.faqQuestionRow, styles.pressableWeb]}>
        <ThemedText type="smallBold" style={styles.faqQuestionText}>
          {question}
        </ThemedText>
        <IconSymbol
          name={open ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={16}
          color={colors.accent}
        />
      </Pressable>
      {open && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.faqAnswer}>
          {answer}
        </ThemedText>
      )}
    </ThemedView>
  );
}

export default function LandingScreen() {
  const shotScrollRef = useRef<ScrollView>(null);
  const shotOffsetRef = useRef(0);
  function scrollShots(direction: 1 | -1) {
    const next = Math.max(0, shotOffsetRef.current + direction * 320);
    shotScrollRef.current?.scrollTo({ x: next, animated: true });
    shotOffsetRef.current = next;
  }
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  // Kontrast-Textfarbe für die gefüllten Accent-Download-Buttons: Papier auf
  // dem dunkleren Light-Gold (#846200), Tinte auf dem hellen Dark-Gold —
  // beide Kombinationen erfüllen WCAG-AA.
  const onAccent = scheme === 'dark' ? Brand.ink : Brand.paper;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Echtes Foto (Sheikh-Zayed-Moschee, Unsplash-Lizenz — siehe
              assets/images/landing/CREDITS.md) als Hero-Hintergrund, mit
              scheme-abhängigem Überzug für Textkontrast in Light UND Dark. */}
          <View style={styles.hero}>
            {/* LCP-Bild — siehe Kopfkommentar zu HERO. alt="" + aria-hidden:
                rein dekoratives Hintergrundfoto, der Screenreader soll direkt
                zur Überschrift springen. fetchPriority="high" holt es vor die
                weiter unten liegenden, lazy geladenen Screenshots. */}
            <img
              src={HERO.uri}
              alt=""
              aria-hidden="true"
              width={HERO.width}
              height={HERO.height}
              fetchPriority="high"
              decoding="async"
              style={heroImageStyle}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    scheme === 'dark' ? 'rgba(11,11,13,0.85)' : 'rgba(247,243,234,0.86)',
                  borderRadius: Spacing.four,
                },
              ]}
            />
            <StarClusterDecoration color={colors.accent} />
            <AnimatedListItem index={0}>
              <View style={styles.heroIconGlow}>
                <Image source={require('../../../assets/images/icon.png')} style={styles.heroIcon} contentFit="contain" />
              </View>
            </AnimatedListItem>
            <AnimatedListItem index={1}>
              <ThemedText type="title" style={styles.heroTitle}>
                {t('landing.title')}
              </ThemedText>
            </AnimatedListItem>
            <AnimatedListItem index={2}>
              <ThemedText type="subtitle" themeColor="accent" style={styles.heroTagline}>
                {t('landing.tagline')}
              </ThemedText>
            </AnimatedListItem>
            <AnimatedListItem index={3}>
              <ThemedText type="default" themeColor="textSecondary" style={styles.heroSubtitle}>
                {t('landing.subtitle')}
              </ThemedText>
            </AnimatedListItem>
            {/* Erst-Besucher-Feedback: der App-Store-Link war weiter unten
                unauffindbar. Deshalb hier ganz oben im Hero die zwei echten
                Download-Wege (App Store + APK) als klarste, gefüllte CTAs —
                ohne Scrollen sichtbar. Werte aus APP_STORE_URL / APK_URL. */}
            <AnimatedListItem index={4}>
              <View style={styles.heroDownload}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.heroDownloadLabel}>
                  {t('landing.heroDownload')}
                </ThemedText>
                <View style={styles.heroDownloadRow}>
                  <Pressable
                    onPress={() => Linking.openURL(APP_STORE_URL)}
                    accessibilityRole="link"
                    accessibilityLabel={t('landing.heroAppStore')}
                    style={styles.pressableWeb}>
                    <View style={[styles.heroStoreBtn, { backgroundColor: colors.accent }]}>
                      <IconSymbol name="logo-apple" size={20} color={onAccent} />
                      <ThemedText type="smallBold" style={{ color: onAccent }}>
                        {t('landing.heroAppStore')}
                      </ThemedText>
                    </View>
                  </Pressable>
                  {PLAY_URL ? (
                    <Pressable
                      onPress={() => Linking.openURL(PLAY_URL)}
                      accessibilityRole="link"
                      accessibilityLabel={t('landing.heroPlay')}
                      style={styles.pressableWeb}>
                      <View style={[styles.heroStoreBtn, { backgroundColor: colors.accent }]}>
                        <IconSymbol name="logo-google-playstore" size={20} color={onAccent} />
                        <ThemedText type="smallBold" style={{ color: onAccent }}>
                          {t('landing.heroPlay')}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => Linking.openURL(APK_URL)}
                    accessibilityRole="link"
                    accessibilityLabel={t('landing.heroApk')}
                    style={styles.pressableWeb}>
                    <View style={[styles.heroStoreBtn, { backgroundColor: colors.accent }]}>
                      <IconSymbol name="logo-android" size={20} color={onAccent} />
                      <ThemedText type="smallBold" style={{ color: onAccent }}>
                        {t('landing.heroApk')}
                      </ThemedText>
                    </View>
                  </Pressable>
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.heroDownloadNote}>
                  {t(PLAY_URL ? 'landing.heroDownloadNotePlay' : 'landing.heroDownloadNote')}
                </ThemedText>
              </View>
            </AnimatedListItem>
            <AnimatedListItem index={5}>
              <View style={styles.heroActions}>
                <Link href="/quran" asChild>
                  <PressableCard type="backgroundSelected" style={styles.ctaPrimary} elevated>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('landing.ctaTry')}
                    </ThemedText>
                  </PressableCard>
                </Link>
                <Link href="/study" asChild>
                  <PressableCard type="backgroundElement" style={styles.ctaSecondary} elevated>
                    <ThemedText type="smallBold">{t('landing.ctaStudy')}</ThemedText>
                  </PressableCard>
                </Link>
                <Pressable
                  onPress={() => { if (typeof window !== 'undefined') window.location.href = '/ki'; }}
                  style={styles.pressableWeb}>
                  <ThemedView type="backgroundElement" style={styles.ctaSecondary}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {t('landing.ctaKi')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </View>
            </AnimatedListItem>
          </View>

          <View style={styles.trustBand}>
            {TRUST.map((item, i) => (
              <ScrollReveal key={item.titleKey} delay={i * 60} style={styles.trustItem}>
                <ThemedView type="backgroundSelected" style={styles.trustCard}>
                  <IconSymbol name={item.icon} size={24} color={colors.accent} />
                  <ThemedText type="smallBold" style={styles.trustTitle}>
                    {t(item.titleKey)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.trustDesc}>
                    {t(item.descKey)}
                  </ThemedText>
                </ThemedView>
              </ScrollReveal>
            ))}
          </View>

          <ScrollReveal style={styles.sectionTitle}>
            <ThemedText type="subtitle">{t('landing.featuresTitle')}</ThemedText>
          </ScrollReveal>
          <View style={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <ScrollReveal key={f.titleKey} delay={(i % 4) * 60}>
                <ThemedView type="backgroundElement" style={[styles.featureCard, styles.featureCardShadow]}>
                  <ThemedView type="backgroundSelected" style={styles.featureIconBadge}>
                    <IconSymbol name={f.icon} size={22} color={colors.accent} />
                  </ThemedView>
                  <ThemedText type="smallBold" style={styles.featureTitle}>
                    {t(f.titleKey)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(f.descKey)}
                  </ThemedText>
                </ThemedView>
              </ScrollReveal>
            ))}
          </View>

          {/* Foto-Band (Masjid An Nur TNB, Unsplash-Lizenz — CREDITS.md) als
              visuelle Trennung zwischen Features und Screenshots. */}
          <ScrollReveal>
            <Image
              source={[
                require('../../../assets/images/landing/landing-band-800w.webp'),
                require('../../../assets/images/landing/landing-band-1200w.webp'),
              ]}
              style={styles.bandImage}
              contentFit="cover"
              contentPosition="center"
              alt=""
              // Weit unterhalb des ersten Viewports — Browser soll das nicht
              // parallel zum LCP-Hero-Bild laden (Bandbreiten-Konkurrenz).
              loading="lazy"
              priority="low"
            />
          </ScrollReveal>

          <ScrollReveal style={styles.sectionTitle}>
            <ThemedText type="subtitle">{t('landing.screenshotsTitle')}</ThemedText>
          </ScrollReveal>
          {/* Desktop hat keinen Touch: sichtbare Scrollbar + Pfeil-Buttons,
              sonst wirkt die Galerie "nicht scrollbar" (Gerätefeedback). */}
          <View style={styles.shotWrap}>
            <ScrollView
              ref={shotScrollRef}
              horizontal
              // Nackter Browser-Scrollbalken unter den Screenshots wirkte
              // unpoliert (Audit 2026-07-19 B12) - Pfeile + Swipe reichen.
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                shotOffsetRef.current = e.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={64}
              style={styles.shotScrollView}
              contentContainerStyle={styles.shotRow}>
              {SCREENSHOTS.map((src, i) => (
                <ScrollReveal key={i} delay={(i % 6) * 60}>
                  {/* Galerie ist unterhalb des ersten Viewports und RN-Web
                      virtualisiert die ScrollView nicht - ohne loading="lazy"
                      holt der Browser alle 6 Screenshots sofort beim
                      Seitenaufruf statt erst beim Scrollen dorthin. */}
                  <Image source={src} style={styles.shot} contentFit="cover" loading="lazy" priority="low" />
                </ScrollReveal>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => scrollShots(-1)}
              accessibilityRole="button"
              accessibilityLabel="←"
              style={[styles.shotArrow, styles.shotArrowLeft, styles.pressableWeb]}>
              <ThemedText type="subtitle">‹</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => scrollShots(1)}
              accessibilityRole="button"
              accessibilityLabel="→"
              style={[styles.shotArrow, styles.shotArrowRight, styles.pressableWeb]}>
              <ThemedText type="subtitle">›</ThemedText>
            </Pressable>
          </View>

          {/* Tablet-Ansichten (neu in 1.41.0). Bewusst als eigener Abschnitt
              und nicht in der Handy-Galerie: die Kacheln haben ein anderes
              Seitenverhaeltnis, gemischt in einer Reihe wirkt es unruhig — und
              die Aussage ist ja gerade, dass die App auf dem Tablet ANDERS
              aussieht. Drei Aufnahmen genuegen: zweispaltige Startseite,
              zweispaltige Einstellungen, KI mit Quellenangabe. */}
          <ScrollReveal style={styles.sectionTitle}>
            <ThemedText type="subtitle">{t('landing.tabletTitle')}</ThemedText>
          </ScrollReveal>
          <ScrollReveal>
            <ThemedText type="small" themeColor="textSecondary" style={styles.tabletLead}>
              {t('landing.tabletLead')}
            </ThemedText>
          </ScrollReveal>
          <View style={styles.tabletShotWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabletShotRow}>
              {TABLET_SHOTS.map((src, i) => (
                <ScrollReveal key={i} delay={i * 60}>
                  {/* Wie die Handy-Galerie: weit unterhalb des ersten
                      Viewports, darf dem LCP-Hero keine Bandbreite wegnehmen. */}
                  <Image source={src} style={styles.tabletShot} contentFit="cover" loading="lazy" priority="low" />
                </ScrollReveal>
              ))}
            </ScrollView>
          </View>

          {/* Inhalts-Angebote jenseits der App-Features: Podcast (Spotify),
              Lern-Videos (YouTube), Reels (Instagram), PDF-Handouts. Eigene
              web-only Komponente mit self-contained Sprach-Map, damit die
              Landing-Erweiterung keine geteilten Locale-Dateien anfasst. */}
          <MediaShowcase />

          <View style={styles.storeSection}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('landing.storeTitle')}
            </ThemedText>
            {/* Direkter APK-Download von Cloudflare R2 (Einzeldatei, sofortiger
                Download — kein Zusammensetzen mehrerer Teile mehr). */}
            <PressableCard
              onPress={() => Linking.openURL(APK_URL)}
              accessibilityRole="link"
              type="backgroundSelected"
              style={styles.ctaPrimary}
              elevated>
              <View style={styles.apkRow}>
                <IconSymbol name="logo-android" size={18} color={colors.accent} />
                <ThemedText type="smallBold" themeColor="accent">
                  {t('landing.apkButton')}
                </ThemedText>
              </View>
            </PressableCard>
            <ThemedText type="small" themeColor="textSecondary" style={styles.apkHint}>
              {t('landing.apkHint')}
            </ThemedText>
            <View style={styles.storeBadges}>
              <Pressable
                onPress={() => Linking.openURL(APP_STORE_URL)}
                accessibilityRole="link"
                style={styles.pressableWeb}>
                <ThemedView type="backgroundElement" style={styles.storeBadge}>
                  <IconSymbol name="logo-apple" size={18} color={colors.accent} />
                  <ThemedText type="small" themeColor="accent">
                    App Store · {t('landing.storeAvailable')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              {PLAY_URL ? (
                <Pressable
                  onPress={() => Linking.openURL(PLAY_URL)}
                  accessibilityRole="link"
                  style={styles.pressableWeb}>
                  <ThemedView type="backgroundElement" style={styles.storeBadge}>
                    <IconSymbol name="logo-google-playstore" size={18} color={colors.accent} />
                    <ThemedText type="small" themeColor="accent">
                      Google Play · {t('landing.storeAvailable')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ) : (
                <ThemedView type="backgroundElement" style={styles.storeBadge}>
                  <IconSymbol name="logo-google-playstore" size={18} color={colors.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Google Play · {t('landing.storeSoon')}
                  </ThemedText>
                </ThemedView>
              )}
            </View>
          </View>

          {/* Salati TV — kostenlose Begleit-App für den Fernseher. Bewusst
              direkt unter dem App-Download platziert ("unter der eigentlichen
              App"): erst das Handy, dann der große Bildschirm. */}
          <ScrollReveal style={styles.sectionTitle}>
            <View style={styles.tvHeading}>
              <IconSymbol name="tv-outline" size={22} color={colors.accent} />
              <ThemedText type="subtitle">{t('landing.tvTitle')}</ThemedText>
            </View>
            <ThemedText type="default" themeColor="textSecondary" style={styles.tvLead}>
              {t('landing.tvDesc')}
            </ThemedText>
          </ScrollReveal>
          <View style={styles.tvShotWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tvShotRow}>
              {TV_SHOTS.map((src, i) => (
                <ScrollReveal key={i} delay={(i % 5) * 60}>
                  <Image source={src} style={styles.tvShot} contentFit="cover" loading="lazy" priority="low" />
                </ScrollReveal>
              ))}
            </ScrollView>
          </View>
          <View style={styles.tvFeatureRow}>
            {TV_FEATURES.map((f, i) => (
              <ScrollReveal key={f.titleKey} delay={i * 60} style={styles.tvFeatureItem}>
                <ThemedView type="backgroundElement" style={styles.tvFeatureCard}>
                  <ThemedView type="backgroundSelected" style={styles.featureIconBadge}>
                    <IconSymbol name={f.icon} size={22} color={colors.accent} />
                  </ThemedView>
                  <ThemedText type="smallBold" style={styles.featureTitle}>
                    {t(f.titleKey)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(f.descKey)}
                  </ThemedText>
                </ThemedView>
              </ScrollReveal>
            ))}
          </View>
          <View style={styles.tvBadgeWrap}>
            {TV_PLAY_URL ? (
              <Pressable
                onPress={() => Linking.openURL(TV_PLAY_URL)}
                accessibilityRole="link"
                style={styles.pressableWeb}>
                <ThemedView type="backgroundElement" style={styles.storeBadge}>
                  <IconSymbol name="logo-google-playstore" size={18} color={colors.accent} />
                  <ThemedText type="small" themeColor="accent">
                    {t('landing.tvBadgeLive')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ) : (
              <ThemedView type="backgroundElement" style={styles.storeBadge}>
                <IconSymbol name="logo-google-playstore" size={18} color={colors.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('landing.tvBadge')}
                </ThemedText>
              </ThemedView>
            )}
            {/* Fire-TV-Sticks haben keinen Play Store. Ohne diesen Weg gibt es
                fuer sie gar keinen — die App laeuft dort, nur installieren
                laesst sie sich nur seitlich. */}
            <Pressable
              onPress={() => Linking.openURL(TV_APK_URL)}
              accessibilityRole="link"
              style={[styles.pressableWeb, styles.tvApkBadge]}>
              <ThemedView type="backgroundElement" style={styles.storeBadge}>
                <IconSymbol name="download-outline" size={18} color={colors.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('landing.tvApkButton')}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          <ScrollReveal style={styles.sectionTitle}>
            <ThemedText type="subtitle">{t('landing.faqTitle')}</ThemedText>
          </ScrollReveal>
          <View style={styles.faqList}>
            {Array.from({ length: FAQ_COUNT }, (_, i) => i + 1).map((n) => (
              <FaqItem key={n} question={t(`landing.faq${n}Q`)} answer={t(`landing.faq${n}A`)} />
            ))}
          </View>

          <View style={styles.socialRow}>
            <Pressable
              onPress={() => Linking.openURL(APP_STORE_URL)}
              accessibilityRole="link"
              accessibilityLabel="App Store">
              <IconSymbol name="logo-apple" size={28} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(APK_URL)}
              accessibilityRole="link"
              accessibilityLabel="Android APK">
              <IconSymbol name="logo-android" size={28} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://www.youtube.com/channel/UCzqiyiWVFK9NY4k0OD850Lw')}
              accessibilityRole="link"
              accessibilityLabel="YouTube">
              <IconSymbol name="logo-youtube" size={28} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://www.instagram.com/salati.pro')}
              accessibilityRole="link"
              accessibilityLabel="Instagram">
              <IconSymbol name="logo-instagram" size={28} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL('https://open.spotify.com/show/033U0teP7zMDXYm3zQ3fje')}
              accessibilityRole="link"
              accessibilityLabel="Spotify">
              <IconSymbol name="musical-notes" size={26} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            {t('landing.footer')} · {t('common.credit')}
          </ThemedText>
          <View style={styles.legalLinks}>
            <Link href="/impressum" asChild>
              <Pressable style={Platform_pressable}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.legalLink}>
                  {t('nav.impressum')}
                </ThemedText>
              </Pressable>
            </Link>
            <ThemedText type="small" themeColor="textSecondary">
              ·
            </ThemedText>
            <Link href="/datenschutz" asChild>
              <Pressable style={Platform_pressable}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.legalLink}>
                  {t('nav.datenschutz')}
                </ThemedText>
              </Pressable>
            </Link>
            <ThemedText type="small" themeColor="textSecondary">
              ·
            </ThemedText>
            <Link href="/changelog" asChild>
              <Pressable style={Platform_pressable}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.legalLink}>
                  {t('nav.changelog')}
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const Platform_pressable = { cursor: 'pointer' } as const;

const styles = StyleSheet.create({
  pressableWeb: { cursor: 'pointer' },
  // ohne explizite width kannte RN-Web dem ScrollView keine Bounding-Box -
  // der Inhalt lief einfach ueber den Rand statt zu scrollen (Nutzerfund:
  // "Screenshot-Galerie scrollt nicht").
  shotWrap: { position: 'relative', width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  shotScrollView: { width: '100%' },
  shotArrow: {
    position: 'absolute',
    top: '42%',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,11,13,0.55)',
  },
  shotArrowLeft: { left: 6 },
  shotArrowRight: { right: 6 },
  trustBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  // Flex-Item-Props gehören auf den ScrollReveal-Wrapper (das eigentliche
  // Flex-Kind der Reihe): flexBasis auf der Karte selbst wirkte im column-
  // Wrapper als HÖHEN-Basis von 220px und erzeugte die großen Leerflächen
  // unter dem Text (Audit 2026-07-19 B5).
  trustItem: {
    flexBasis: 220,
    flexGrow: 1,
    maxWidth: 280,
  },
  trustCard: {
    flexGrow: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  trustTitle: { textAlign: 'center' },
  trustDesc: { textAlign: 'center' },
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  scroll: { alignItems: 'center', paddingBottom: Spacing.six, paddingHorizontal: Spacing.four },
  hero: {
    alignItems: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
    marginTop: Spacing.four,
    gap: Spacing.two,
    position: 'relative',
    overflow: 'hidden',
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  bandImage: {
    width: '100%',
    maxWidth: MaxContentWidth,
    height: 240,
    borderRadius: Spacing.four,
    marginTop: Spacing.six,
  },
  heroIconGlow: {
    marginBottom: Spacing.two,
    borderRadius: Spacing.four + Spacing.one,
    // Web-only-Datei: boxShadow statt der deprecated shadow*-Props
    // (die warfen auf jeder Seite eine Konsolen-Warnung).
    boxShadow: '0 8px 24px rgba(212,175,55,0.35)',
  },
  heroIcon: { width: 96, height: 96, borderRadius: Spacing.four },
  heroTitle: { textAlign: 'center' },
  heroTagline: { textAlign: 'center' },
  heroSubtitle: { textAlign: 'center', maxWidth: 560, marginTop: Spacing.two },
  heroDownload: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four },
  heroDownloadLabel: { textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  heroDownloadNote: { textAlign: 'center', maxWidth: 460 },
  heroDownloadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  heroStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    // Prominente CTAs: gleiche warme Gold-Aura wie das Hero-Icon, damit sie als
    // die klarsten Schaltflächen der Seite gelesen werden.
    boxShadow: '0 6px 18px rgba(212,175,55,0.28)',
  },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center', marginTop: Spacing.four },
  ctaPrimary: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  ctaSecondary: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.four },
  sectionTitle: { textAlign: 'center', marginTop: Spacing.six, marginBottom: Spacing.four, maxWidth: MaxContentWidth, width: '100%' },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  featureCard: {
    width: 250,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  featureCardShadow: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(11,11,13,0.06), 0 4px 12px rgba(11,11,13,0.06)' },
    default: {
      shadowColor: '#0b0b0d',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
  }),
  featureIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { marginTop: Spacing.one },
  shotRow: { gap: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  shot: {
    width: 220,
    height: 480,
    borderRadius: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  tabletLead: { textAlign: 'center', maxWidth: 620, alignSelf: 'center' },
  tabletShotWrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', marginTop: Spacing.three },
  tabletShotRow: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  // 2048x2676 der Aufnahme -> 300 x 392. Bewusst breiter und niedriger als die
  // Handy-Kacheln (220x480), damit der Unterschied sofort ins Auge faellt.
  tabletShot: {
    width: 300,
    height: 392,
    borderRadius: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  storeSection: { alignItems: 'center', marginTop: Spacing.six, gap: Spacing.three },
  tvHeading: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  tvLead: { textAlign: 'center', maxWidth: 620, marginTop: Spacing.two, alignSelf: 'center' },
  tvShotWrap: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', marginTop: Spacing.four },
  tvShotRow: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  // 16:9-Kacheln (TV-Format) — bewusst breiter als die Handy-Screenshots, damit
  // sofort klar ist: das ist der Fernseher, nicht das Handy.
  tvShot: {
    width: 320,
    height: 180,
    borderRadius: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  tvFeatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    marginTop: Spacing.four,
  },
  tvFeatureItem: { flexBasis: 240, flexGrow: 1, maxWidth: 320 },
  tvFeatureCard: { flexGrow: 1, borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.one },
  tvBadgeWrap: { alignItems: 'center', marginTop: Spacing.four },
  tvApkBadge: { marginTop: Spacing.two },
  apkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  apkHint: { textAlign: 'center', maxWidth: 420 },
  storeBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  faqList: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.two },
  faqCard: { borderRadius: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  faqQuestionText: { flexShrink: 1 },
  faqAnswer: { marginTop: Spacing.two },
  footer: { textAlign: 'center', marginTop: Spacing.six },
  socialRow: { flexDirection: 'row', gap: Spacing.four, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.six },
  legalLinks: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', marginTop: Spacing.two },
  legalLink: { textDecorationLine: 'underline' },
});

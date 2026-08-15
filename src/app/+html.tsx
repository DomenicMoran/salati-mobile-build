import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { Brand } from '@/constants/theme';
import de from '@/locales/de.json';

// Eigenes Root-HTML-Template (Expo-Router-Static-Rendering-Escape-Hatch) —
// ohne das übernimmt Expo Router ein Default-Template ohne Dark-Mode-
// Vorwissen: der statische Export rendert jede Seite mit einer festen
// Hell-Modus-Hintergrundfarbe vor (siehe extrahiertes CSS in dist/index.html,
// z. B. "background-color:rgba(255,255,255,1.00)"), unabhängig vom System-
// Farbschema des Besuchers. Erst nach dem React-Hydrate (JS geladen +
// ausgeführt) übernimmt ThemedView die echte Farbe — bis dahin blitzt bei
// Dark-Mode-Systemen kurz der helle Hintergrund auf ("flash of light mode").
// Dieses reine CSS-`prefers-color-scheme`-Escape-Hatch (offizielles Expo-
// Router-Beispiel für genau dieses Problem) setzt die richtige Hintergrund-
// farbe schon beim allerersten Paint, ganz ohne JS-Abhängigkeit.
// Marketing-Metadaten fest auf Deutsch (die App-UI selbst ist 6-sprachig,
// aber dieses Root-Template wird einmalig statisch gerendert und umschließt
// alle Sprachvarianten gleich — Berlin/deutschsprachiger Nutzerkreis als
// sinnvoller Default für Social-Share-Vorschauen, analog zum App-Sprach-Default 'de').
const SITE_TITLE = 'Salati - Dein Begleiter für Gebet, Koran und Wissen';
const SITE_DESCRIPTION =
  'Gebetszeiten, Qibla, Koran mit Rezitation, Duas, Hadithe, Moschee-Finder und ein vollständiger Lernpfad - offline nutzbar, ohne Werbung, ohne Tracking.';
const SITE_URL = 'https://www.salati.pro';

// Strukturierte Daten (Audit 2026-07-19 F3): einmal statisch ins Root-HTML.
// FAQ-Inhalte kommen direkt aus den de-Locale-Keys der Landing-FAQ, damit
// JSON-LD und sichtbare Seite nicht auseinanderlaufen (Sprache = Template-
// Default de, wie alle Metadaten hier).
const landingFaq = de.landing as Record<string, string>;
const STRUCTURED_DATA = JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Salati',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Android, iOS, Web',
    inLanguage: ['de', 'en', 'tr', 'ar', 'es', 'fr', 'id', 'ms', 'ru', 'ur', 'fa', 'bn', 'sw', 'ps'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: Array.from({ length: 8 }, (_, i) => i + 1)
      .filter((n) => landingFaq[`faq${n}Q`] && landingFaq[`faq${n}A`])
      .map((n) => ({
        '@type': 'Question',
        name: landingFaq[`faq${n}Q`],
        acceptedAnswer: { '@type': 'Answer', text: landingFaq[`faq${n}A`] },
      })),
  },
  // "<" als <: verhindert </script>-Breakout, bleibt gültiges JSON-LD
  // (Standard-Härtung für Inline-JSON, Inhalte sind eigene Build-Strings).
]).replace(/</g, '\\u003c');

// Service-Worker-Registrierung (Audit 2026-07-27, WEBSITE-MEDIEN.md: die
// Startseite wirbt mit "offline nutzbar", die Web-Fassung hatte aber keinen SW).
// Konstante Build-Zeit-Zeichenkette ohne Eingabedaten — nichts zu escapen.
// Im Entwicklungsmodus (`expo start --web`) wird gar nichts eingebunden: der
// Worker würde die Metro-Dev-Bundles zwischenspeichern. Zur Laufzeit greift
// zusätzlich die Secure-Context-Bedingung (https oder localhost) — nur dort
// erlaubt der Browser `serviceWorker.register` überhaupt.
// `updatefound` meldet eine neue Version per DOM-Event; übernommen wird sie
// beim nächsten vollständigen Laden (sw.js ruft bewusst kein skipWaiting auf),
// damit sich eine laufende Sitzung nicht unter dem Nutzer weg austauscht.
const SERVICE_WORKER_REGISTRATION = __DEV__
  ? ''
  : `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('salati:sw-update'));
          }
        });
      });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) reg.update();
      });
    }).catch(function () {});
  });
}`;

/**
 * Verhindert den Sprung, den wiederkehrende Besucher mit gespeicherter,
 * nicht-deutscher Sprache sahen (CLS 0,198 gegenüber 0,002 bei frischem
 * Besuch, gemessen am 29.07.2026).
 *
 * Ursache: `output: 'static'` rendert die Seite auf Deutsch und LTR vor. Nur
 * `de`/`en` sind statisch gebündelt — jede andere Sprache wird nachgeladen
 * (src/lib/i18n.ts) und ersetzt danach sämtliche Texte auf einmal. Bei
 * Arabisch, Persisch, Urdu und Paschtu kippt zusätzlich die Leserichtung. Das
 * ergibt eine einzige, große Verschiebung rund 300 ms nach dem ersten Bild.
 *
 * Dieses Skript läuft vor dem ersten Bild, liest dieselbe gespeicherte
 * Einstellung wie die App und blendet den Inhalt NUR DANN kurz aus, wenn
 * tatsächlich eine andere Sprache kommt. Der Normalfall — frischer Besuch oder
 * gespeichertes Deutsch — wird nicht angefasst und behält seinen LCP.
 *
 * `visibility` statt `display`: das Layout bleibt bestehen, es wird nur nicht
 * gezeigt. Unsichtbare Elemente zählen nicht in die Layout-Shift-Messung, und
 * es entsteht kein zweiter Umbruch beim Wiedereinblenden.
 *
 * Sicherheitsnetz: Bleibt das Nachladen aus (JS-Fehler, Netz weg), macht ein
 * Zeitgeber nach 1,5 s wieder sichtbar. Die Seite kann also nicht dauerhaft
 * leer bleiben — im schlimmsten Fall steht der deutsche Text da, wie vorher.
 */
const SPRACH_VORBLENDE = `(function () {
  var w = document.documentElement;
  var offen = {};
  try {
    var roh = window.localStorage.getItem('salatibox:settings');
    var sprache = roh ? JSON.parse(roh).language : null;
    if (sprache && sprache !== 'de') {
      // Leserichtung und Sprachcode sofort setzen: beides ist ohne die
      // Sprachdatei bekannt und spart dem Browser einen zweiten Umbruch.
      w.lang = sprache;
      if (['ar', 'ur', 'fa', 'ps'].indexOf(sprache) !== -1) w.dir = 'rtl';
      offen.sprache = 1;
    }
  } catch (e) {}
  // 600 = LayoutBreakpoints.medium: ab hier liefert useLayout() nach der
  // Hydration ein anderes Layout als das vorgerenderte.
  //
  // Die Startseite ist ausgenommen: sie ist eine eigene Marketing-Seite
  // (app/(tabs)/index.web.tsx) und benutzt useLayout gar nicht — dort springt
  // also nichts. Sie zu verdecken kostete nur: live gemessen stieg ihr LCP von
  // 124 ms auf 1568 ms, weil das Verdecken den ersten sichtbaren Inhalt an die
  // JS-Hydration koppelt statt ans vorgerenderte HTML.
  var start = location.pathname === '/' || location.pathname === '/index';
  if (window.innerWidth >= 600 && !start) offen.layout = 1;
  var gruende = Object.keys(offen);
  if (!gruende.length) return;
  w.setAttribute('data-vorblende', gruende.join(' '));
  // Je Grund einzeln freigeben. Sonst wartet ein deutschsprachiger Besuch,
  // bei dem nur das Layout umspringt, unnoetig auf die Sprachdatei — im
  // Livetest hing der LCP dadurch am Sicherheitsnetz statt an der App.
  window.__salatiVorblendeFrei = function (grund) {
    if (grund) delete offen[grund];
    else offen = {};
    var rest = Object.keys(offen);
    if (rest.length) w.setAttribute('data-vorblende', rest.join(' '));
    else w.removeAttribute('data-vorblende');
  };
  // Sicherheitsnetz: bleibt die App aus (JS-Fehler, Netz weg), wird die Seite
  // trotzdem sichtbar — im schlimmsten Fall im vorgerenderten Zustand.
  setTimeout(function () { w.removeAttribute('data-vorblende'); }, 1500);
})();`;

const SPRACH_VORBLENDE_CSS = `html[data-vorblende] body { visibility: hidden; }`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        <title>{SITE_TITLE}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={SITE_TITLE} />
        <meta property="og:url" content={SITE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SITE_TITLE} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
        {/* Früher TLS-Handshake zu den ständig genutzten Daten-/Audio-Origins —
            spart je ~100-300ms beim ersten API-Call jeder Session. */}
        <link rel="preconnect" href="https://api.alquran.cloud" />
        <link rel="preconnect" href="https://api.aladhan.com" />
        <link rel="preconnect" href="https://api.quran.com" />
        <link rel="preconnect" href="https://cdn.islamic.network" />
        {/* PWA: macht die Web-App am Handy/Desktop installierbar. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b0b0d" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <ScrollViewStyleReset />
        {/* Muss VOR dem Inhalt stehen und ohne `defer` laufen: es entscheidet,
            ob überhaupt etwas gezeigt wird, bevor das erste Bild gemalt ist. */}
        <style dangerouslySetInnerHTML={{ __html: SPRACH_VORBLENDE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: SPRACH_VORBLENDE }} />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />
        <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTRATION }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: ${Brand.paper};
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: ${Brand.ink};
  }
}`;

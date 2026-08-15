#!/usr/bin/env node
// Store-Screenshots aus der ECHTEN Android-App (app-release.apk) auf einem
// Emulator — nicht aus dem Web-Export. Grund: der Web-Export rendert die
// Web-Navigation (Kopfleiste statt Tab-Leiste); ein Play-Screenshot muss die
// App zeigen, die der Nutzer nach der Installation sieht.
//
// Pro Sprache wird die App zurueckgesetzt, die App-Sprache ueber
// `cmd locale set-app-locales` (Android 13+) gesetzt und der Erststart-Flow
// einmal durchlaufen; danach wird jeder Screen per Deep Link (`salatibox://…`)
// angesprungen und mit `screencap` aufgenommen. Keine Montage, keine
// Bildgenerierung.
//
// Statusleiste: SystemUI-Demo-Modus (fester 09:41-Zeitstempel, volle Anzeige,
// keine Benachrichtigungs-Icons) — dieselbe Konvention wie bei Apple.
//
// Usage:
//   node scripts/device-screenshots.mjs --device emulator-5556 --klasse phone
//   node scripts/device-screenshots.mjs --device emulator-5558 --klasse sevenInch de-DE en-US
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ADB = process.env.ADB ?? 'C:/Android/platform-tools/adb.exe';
const PKG = 'de.salatibox.de';
const APK = 'android/app/build/outputs/apk/release/app-release.apk';

const LOCALES = {
  'de-DE': { tag: 'de-DE', lang: 'de' }, 'en-US': { tag: 'en-US', lang: 'en' },
  'tr-TR': { tag: 'tr-TR', lang: 'tr' }, ar: { tag: 'ar', lang: 'ar' },
  'es-ES': { tag: 'es-ES', lang: 'es' }, 'fr-FR': { tag: 'fr-FR', lang: 'fr' },
  'bn-BD': { tag: 'bn-BD', lang: 'bn' }, fa: { tag: 'fa', lang: 'fa' },
  id: { tag: 'id', lang: 'id' }, ms: { tag: 'ms', lang: 'ms' },
  'ru-RU': { tag: 'ru-RU', lang: 'ru' }, sw: { tag: 'sw', lang: 'sw' },
  ur: { tag: 'ur', lang: 'ur' },
};

// Reihenfolge = Erzaehlung im Store. Play erlaubt hoechstens 8 Bilder je
// Geraeteklasse, deshalb genau 8.
// `marker` ist ein i18n-Schluessel, dessen Text auf dem Ziel-Screen sichtbar
// sein MUSS. Er ist die Antwort auf die Falle vom 2026-08-07: ein Deep Link an
// die schon laufende App wird zwar zugestellt ("intent has been delivered to
// currently running top-most instance"), navigiert aber nicht — aufgenommen
// wurde dann der Screen davor. Eine Vordergrund-Pruefung faengt das NICHT, die
// App ist ja vorn, nur auf der falschen Seite.
const SHOTS = [
  // Bild 1 wird ueber die TAB-LEISTE angesteuert, nicht per Deep Link.
  //
  // Beim Start gewinnt Expo Routers Zustandswiederherstellung gegen den Link:
  // nach `am start -d salatibox://prayer` stand die App auf dem Screen, den sie
  // zuletzt zeigte (2026-08-07 nachgemessen: Qibla). Fuer die uebrigen Motive
  // ist das egal — dort laeuft die App bereits und der Link greift. Nur das
  // erste Bild nach dem Neustart braucht einen Tipp auf den Tab.
  { name: '01-gebetszeiten', link: 'salatibox://', wait: 9000, marker: 'prayer.sunrise', tab: 'nav.prayerTimes' },
  { name: '02-koran', link: 'salatibox://quran/1', wait: 9000 },
  { name: '03-ki', link: 'salatibox://ki-native', wait: 5000, action: 'ki', marker: 'ki.title' },
  // Bis 1.46.0 stand hier der Einstellungs-Screen. Seit 1.47.0 zeigt diese
  // Stelle, WOHER die Zeiten kommen: welche Behoerde gerade gilt, mit welchen
  // Winkeln, was Asr-Schule und Hochbreiten-Regel bedeuten.
  //
  // Ursprünglich sollte hier der Moschee-Abgleich stehen — mit ausgefuelltem
  // Formular und Ergebnis. Das braucht aber vier Eingabefelder, einen Knopf und
  // eine Netzabfrage, alles ueber `uiautomator dump` gesucht: auf dem
  // software-gerenderten Emulator schlug es in der Mehrzahl der Sprachen fehl
  // und lieferte ein leeres Formular (2026-08-07). Dieser Screen erzaehlt
  // dieselbe Neuerung und braucht keine einzige Eingabe.
  { name: '04-quelle', link: 'salatibox://prayer-times-source', wait: 6000, marker: 'prayerSource.title' },
  { name: '05-qibla', link: 'salatibox://qibla', wait: 7000, marker: 'qibla.bearingInfo' },
  { name: '06-tracker', link: 'salatibox://tracker', wait: 5000, action: 'tracker', marker: 'tracker.title' },
  { name: '07-tasbih', link: 'salatibox://tasbih', wait: 4000, action: 'tasbih', marker: 'tasbih.title' },
  { name: '08-kalender', link: 'salatibox://calendar', wait: 6000, marker: 'nav.calendar' },
];

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const DEVICE = arg('--device');
const KLASSE = arg('--klasse') ?? 'phone';
const INSTALL = argv.includes('--install');
// Nur einzelne Motive neu aufnehmen (z. B. `--nur 03-ki`); der Rest des
// Satzes bleibt liegen.
const NUR = arg('--nur');
const only = argv.filter((a, i) => !a.startsWith('--') && !['--device', '--klasse', '--nur'].includes(argv[i - 1]));
if (!DEVICE) throw new Error('--device fehlt');

const OUT = `store-assets/device/${KLASSE}`;
// adb faellt auf ausgelasteten Emulatoren gelegentlich mit leerem stderr aus
// (beobachtet bei `pull` waehrend drei parallel laufenden Emulatoren). Ein
// einzelner Fehlschlag darf den Lauf nicht abbrechen — sonst ist der halbe
// Sprachsatz weg.
function adb(...a) {
  let letzter;
  for (let versuch = 0; versuch < 3; versuch++) {
    try {
      return execFileSync(ADB, ['-s', DEVICE, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      letzter = e;
      execFileSync(ADB, ['-s', DEVICE, 'wait-for-device'], { encoding: 'utf8' });
    }
  }
  throw letzter;
}
const sh = (cmd) => adb('shell', cmd);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const size = sh('wm size').trim();
const [W, H] = /(\d+)x(\d+)/.exec(size).slice(1).map(Number);
console.log(`Geraet ${DEVICE} — ${KLASSE} — ${W}x${H}`);

/** Aktuelle Uhrzeit in Europe/Berlin als "HHMM" — die App rechnet mit dieser
 *  Zeitzone (Standort Berlin), das Emulator-SystemUI haengt ohne Neustart auf
 *  UTC. Ohne Angleich zeigt die Statusleiste eine andere Uhrzeit als der
 *  Countdown im selben Bild. */
const berlinHHMM = () =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date())
    .replace(':', '');

function demoStatusBar() {
  sh('settings put global sysui_demo_allowed 1');
  const d = (extras) => sh(`am broadcast -a com.android.systemui.demo ${extras}`);
  d('-e command exit');
  d('-e command enter');
  d(`-e command clock -e hhmm ${berlinHHMM()}`);
  d('-e command battery -e level 100 -e plugged false');
  d('-e command network -e wifi show -e level 4');
  d('-e command network -e mobile show -e datatype none -e level 4');
  d('-e command notifications -e visible false');
}

/**
 * Frischer uiautomator-Abzug — oder null, wenn keiner zu bekommen war.
 *
 * `uiautomator dump` wartet auf einen Ruhezustand der Oberflaeche. Den gibt es
 * auf dem Gebetszeiten-Screen nie: der Countdown bis zum naechsten Gebet zaehlt
 * im Sekundentakt weiter. Gemessen am 2026-08-08: vier von fuenf Aufrufen
 * enden mit "ERROR: could not get idle state".
 *
 * Der Fehler ging bisher unter (`>/dev/null 2>&1`), und das anschliessende
 * `cat` las den Abzug des VORHERIGEN Screens weiter. Beide Richtungen sind
 * falsch: der gesuchte Text fehlt, obwohl er auf dem Bildschirm steht — oder er
 * steht im alten Abzug, obwohl der Screen laengst ein anderer ist. Genau daran
 * scheiterten es-ES, fr-FR und bn-BD, deren Screens nachweislich korrekt waren.
 *
 * Deshalb: Datei vorher loeschen und den Erfolg an der Ausgabe pruefen. GENAU
 * EIN Versuch je Aufruf — ein Fehlversuch kostet elf Sekunden, eine Schleife
 * darin multipliziert sich mit der Warteschleife des Aufrufers zu Stunden.
 * `abzugGelang` haelt fest, ob ueberhaupt je ein Abzug zustande kam; nur so
 * laesst sich "Text steht nicht da" von "Ich konnte nicht nachsehen"
 * unterscheiden.
 */
let abzugGelang = false;

function uiAbzug() {
  const out = sh('rm -f /sdcard/ui.xml; uiautomator dump /sdcard/ui.xml 2>&1');
  if (!/dumped to/.test(out)) return null;
  abzugGelang = true;
  return sh('cat /sdcard/ui.xml');
}

/** Mittelpunkt des ersten UI-Knotens, dessen Text mit `label` beginnt. */
function findeKnoten(label) {
  const xml = uiAbzug();
  if (xml === null) return null;
  // ANFANG des Labels vergleichen, nicht die ganze Zeichenkette.
  //
  // Android kuerzt zu lange Beschriftungen mit Auslassungspunkten, und was die
  // Oberflaeche kuerzt, kuerzt auch der uiautomator-Abzug. Ein exakter
  // Vergleich scheiterte deshalb an den langen Uebersetzungen — "Chourouq
  // (lever du soleil)" (fr) hat 27 Zeichen, "Shuruq (amanecer)" (es) 17; der
  // Lauf brach ab, obwohl der richtige Screen zu sehen war. Acht Zeichen sind
  // kurz genug, um die Kuerzung zu ueberleben, und lang genug, um in keiner
  // Sprache versehentlich auf eine andere Zeile zu passen.
  const anfang = [...label].slice(0, 8).join('');
  const esc = anfang.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const re = new RegExp(`text="${esc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
  const m = re.exec(xml);
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)];
}

function locale(lang) {
  const p = `src/locales/${lang}.json`;
  return JSON.parse(fs.readFileSync(fs.existsSync(p) ? p : 'src/locales/de.json', 'utf8'));
}

/** Text zu einem Schluessel wie "prayerSource.title" aus der Sprachdatei. */
function markerText(lang, schluessel) {
  return schluessel.split('.').reduce((o, teil) => (o ?? {})[teil], locale(lang)) ?? null;
}

function beispielLabel(lang) {
  const p = `src/locales/${lang}.json`;
  const j = JSON.parse(fs.readFileSync(fs.existsSync(p) ? p : 'src/locales/de.json', 'utf8'));
  return j.ki?.example1 ?? null;
}

// DIE AUSGELIEFERTE APK TAUGT HIER NICHT. Sie enthaelt seit 1.43.0 nur noch
// arm64-v8a und armeabi-v7a; alle Emulatoren hier sind x86_64. Die App stirbt
// dann beim Start mit "couldn't find DSO to load: libreactnative.so" — und
// `--abi arm64-v8a` beim Installieren hilft nur bis zum naechsten `pm clear`,
// danach laeuft der Prozess wieder als x86_64 (2026-08-07 durchgemessen).
//
// Richtig ist eine APK MIT x86_64. Der Workflow baut sie auf Zuruf und legt sie
// unter app/_screenshot-build.apk auf R2 ab:
//   gh workflow run android.yml --repo MenuCloud-Berlin/salati-mobile-build \
//      -f abis=arm64-v8a,armeabi-v7a,x86_64
//
// Die Pruefung unten ist die Lehre daraus: lieber hier abbrechen als 13
// Sprachsaetze lang Bilder einer abgestuerzten App aufnehmen.
function apkArchitekturen(datei) {
  const zip = fs.readFileSync(datei);
  const namen = new Set();
  for (const treffer of zip.toString('latin1').matchAll(/lib\/([a-z0-9_-]+)\//g)) namen.add(treffer[1]);
  return [...namen];
}

if (INSTALL) {
  const geraeteAbis = sh('getprop ro.product.cpu.abilist').trim();
  const inApk = apkArchitekturen(APK);
  const passt = inApk.some((a) => geraeteAbis.split(',').includes(a));
  if (!passt) {
    throw new Error(
      `Der Emulator kann ${geraeteAbis}, die APK bringt nur ${inApk.join(', ')} mit. ` +
        'Screenshot-Build mit x86_64 verwenden (siehe Kommentar oben).',
    );
  }
  console.log(adb('install', '-r', '-t', APK).trim());
}
try { adb('root'); } catch { /* schon root */ }
sh('setprop persist.sys.timezone Europe/Berlin');
sh('settings put system time_12_24 24');
sh('settings put global window_animation_scale 0');
sh('settings put global transition_animation_scale 0');
sh('settings put global animator_duration_scale 0');
demoStatusBar();

// Ein zaeher Sprachsatz darf nicht den ganzen Lauf killen: der Emulator ist
// langsam und schwankt, und wer 13 Sprachen aufnimmt, will nicht bei der
// fuenften von vorn anfangen. Fehlgeschlagene Sprachen stehen am Ende in der
// Zusammenfassung und werden einzeln nachgeholt — unvollstaendige Saetze
// ueberspringt play-upload-screenshots.mjs ohnehin.
const fehlgeschlagen = [];
const ungeprueft = [];

for (const play of only.length ? only : Object.keys(LOCALES)) {
 try {
  const { tag, lang } = LOCALES[play];
  const dir = path.join(OUT, play);
  fs.mkdirSync(dir, { recursive: true });

  sh(`pm clear ${PKG}`);
  sh(`cmd locale set-app-locales ${PKG} --locales ${tag}`);
  for (const perm of ['POST_NOTIFICATIONS', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
    try { sh(`pm grant ${PKG} android.permission.${perm}`); } catch { /* nicht auf jedem Image noetig */ }
  }
  try { adb('emu', 'geo', 'fix', '13.405', '52.52'); } catch { /* Konsole nicht verfuegbar */ }
  // Erststart: die App leitet die Sprach-abhaengigen Voreinstellungen selbst
  // ab (Uebersetzung, Tafsir, Hadith-Sprache) und schreibt sie weg.
  sh(`am start -n ${PKG}/.MainActivity`);
  // Auf die Speicher-Tabelle WARTEN statt auf die Uhr zu vertrauen.
  //
  // Vorher standen hier feste 14 Sekunden. Auf einem kalten Emulator (frisch
  // gebootet, Software-Rendering) reicht das nicht: der erste Start dauert
  // laenger, AsyncStorage hat seine Tabelle dann noch nicht angelegt, und der
  // sqlite3-Aufruf unten bricht mit "no such table: catalystLocalStorage" ab —
  // mitten im ersten Sprachsatz (2026-08-07). Die Tabelle ist das Signal, auf
  // das es ankommt; hoechstens 3 Minuten, dann ist wirklich etwas kaputt. Auf einem
  // software-gerenderten Emulator dauert der Kaltstart nach `pm clear` allein
  // schon rund 50 Sekunden, bevor das JS-Bundle ueberhaupt laedt.
  let bereit = false;
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    try {
      const t = sh(`sqlite3 /data/data/${PKG}/databases/RKStorage "select name from sqlite_master where name='catalystLocalStorage'"`);
      if (t.includes('catalystLocalStorage')) { bereit = true; break; }
    } catch { /* DB noch nicht angelegt */ }
  }
  if (!bereit) {
    const pid = sh(`pidof ${PKG}`).trim();
    throw new Error(`AsyncStorage-Tabelle nach 3 min nicht da (Prozess ${pid || 'TOT'}) — App startet nicht durch?`);
  }
  await sleep(3000); // die abgeleiteten Voreinstellungen zu Ende schreiben lassen
  sh(`am force-stop ${PKG}`);
  await sleep(1500);
  // Onboarding als erledigt markieren — es ist ein Einrichtungs-Flow, kein
  // Screenshot-Motiv, und es wuerde jeden Deep Link abfangen.
  // Schreiben, BIS es sitzt — und nachlesen.
  //
  // `force-stop` gibt die Datenbank nicht sofort frei; der Einschub scheiterte
  // still mit "database is locked (5)". Folge: die Marke stand nicht, die App
  // startete ins Onboarding, und das erste Bild zeigte nie die Gebetszeiten
  // (2026-08-08). Ein einzelner Versuch reicht hier nicht.
  let markeGesetzt = false;
  for (let versuch = 0; versuch < 15 && !markeGesetzt; versuch++) {
    try {
      sh(`sqlite3 /data/data/${PKG}/databases/RKStorage "insert or replace into catalystLocalStorage(key,value) values('salatibox:onboarding-done','1')"`);
      const gelesen = sh(`sqlite3 /data/data/${PKG}/databases/RKStorage "select value from catalystLocalStorage where key='salatibox:onboarding-done'"`);
      markeGesetzt = gelesen.trim() === '1';
    } catch { /* Datenbank noch gesperrt */ }
    if (!markeGesetzt) await sleep(2000);
  }
  if (!markeGesetzt) throw new Error(`${play}: Onboarding-Marke laesst sich nicht setzen — die App startet in den Einrichtungs-Flow.`);
  demoStatusBar();
  sh(`am start -n ${PKG}/.MainActivity`);
  await sleep(10000);

  for (const s of SHOTS) {
    if (NUR && s.name !== NUR) continue;
    sh(`am start -a android.intent.action.VIEW -d "${s.link}"`);
    await sleep(s.wait);

    // Tab-Leiste antippen, wo der Deep Link nicht traegt (s. Kommentar bei SHOTS).
    if (s.tab) {
      // Erst ueber die Beschriftung; die Tab-Leiste gibt ihren Text aber nicht
      // in jeder Sprache an uiautomator weiter. Dann ueber die Position: die
      // Leiste sitzt unten, der Gebets-Tab ist der erste von fuenf.
      const label = markerText(lang, s.tab);
      const pos = label ? findeKnoten(label) : null;
      if (pos) sh(`input tap ${pos[0]} ${pos[1]}`);
      else sh(`input tap ${Math.round(W * 0.1)} ${Math.round(H * 0.955)}`);
      await sleep(3500);
    }

    // AUF DEN SCREEN WARTEN statt auf die Uhr.
    //
    // Feste Wartezeiten waren die Ursache der falschen Bilder vom 2026-08-07:
    // der Deep Link wird der laufenden App zugestellt ("intent has been
    // delivered to currently running top-most instance"), die Navigation
    // braucht auf einem software-gerenderten Emulator aber laenger als die
    // veranschlagten Sekunden — aufgenommen wurde der Screen davor. Eine
    // Vordergrund-Pruefung faengt das nicht: die App IST vorn, nur woanders.
    //
    // Deshalb: solange abfragen, bis der erwartete Text steht. Ein zweiter
    // Versuch mit Kaltstart, falls der Link ganz verpufft ist.
    //
    // Der Sonderfall ist der Gebetszeiten-Screen: dort laeuft der Countdown bis
    // zum naechsten Gebet im Sekundentakt, die Oberflaeche kommt nie zur Ruhe,
    // und `uiautomator dump` verweigert dauerhaft den Dienst (s. uiAbzug).
    // Wenn KEIN EINZIGER Abzug gelang, ist das kein Befund ueber den Screen,
    // sondern das Eingestaendnis, nicht nachgesehen haben zu koennen — dann
    // wird das Bild aufgenommen und die Zeile laut protokolliert, statt eine
    // Sprache wegen eines blinden Messgeraets ausfallen zu lassen. Sobald auch
    // nur ein Abzug gelang, gilt der Befund und der Screen wird verworfen.
    if (s.marker) {
      const text = markerText(lang, s.marker);
      if (text) {
        // Erst den Link WIEDERHOLEN, den Kaltstart zuletzt.
        //
        // Auf dem 7-Zoll-Tablet blieb die App nach `force-stop` +
        // Deep Link dauerhaft im Startbild stehen (2026-08-08, ueber eine
        // Minute lang, Prozess lebt, kein Fehler im logcat) — ein normaler
        // Start kommt dagegen hoch. Auf dem schnelleren Telefon faellt das
        // nicht auf. Der Kaltstart ist also das schaerfere Mittel und gehoert
        // ans Ende, nicht an den Anfang.
        let da = false;
        abzugGelang = false;
        for (let versuch = 0; versuch < 3 && !da; versuch++) {
          if (versuch > 0) {
            const kalt = versuch === 2;
            console.warn(`  ! ${play}/${s.name}: "${text}" blieb aus — ${kalt ? 'Kaltstart' : 'Link erneut'}`);
            if (kalt) {
              sh(`am force-stop ${PKG}`);
              await sleep(2000);
            }
            sh(`am start -a android.intent.action.VIEW -d "${s.link}"`);
            await sleep(s.wait);
          }
          for (let i = 0; i < 10 && !da; i++) {
            if (findeKnoten(text)) da = true;
            else await sleep(1500);
          }
        }
        if (!da && abzugGelang) {
          throw new Error(`${play}/${s.name}: Screen zeigt "${text}" nicht — die Aufnahme waere das falsche Bild.`);
        }
        if (!da) {
          console.warn(`  ? ${play}/${s.name}: kein UI-Abzug moeglich (Countdown laeuft) — Bild UNGEPRUEFT, bitte ansehen`);
          ungeprueft.push(`${play}/${s.name}`);
        }
      }
    }
    if (s.scroll) {
      for (let i = 0; i < s.scroll; i++) {
        sh(`input swipe ${Math.round(W / 2)} ${Math.round(H * 0.75)} ${Math.round(W / 2)} ${Math.round(H * 0.29)} 500`);
        await sleep(1200);
      }
      await sleep(1200);
    }
    if (s.action === 'tracker') {
      // Drei Gebete abhaken — ein leerer Tracker (0/5) zeigt die Funktion
      // nicht. Die Schalter tragen keinen Text, deshalb wird die Zeile ueber
      // den lokalisierten Gebetsnamen gefunden und rechts davon getippt.
      const L = locale(lang);
      for (const key of ['fajr', 'dhuhr', 'asr']) {
        const pos = findeKnoten(L.prayers?.[key] ?? key);
        if (pos) { sh(`input tap ${Math.round(W * 0.884)} ${pos[1]}`); await sleep(700); }
      }
      await sleep(1200);
    }
    if (s.action === 'tasbih') {
      for (let i = 0; i < 11; i++) { sh(`input tap ${Math.round(W / 2)} ${Math.round(H * 0.6)}`); await sleep(220); }
      await sleep(1200);
    }
    // Beispielfrage in JEDER Sprache antippen. Bis 1.39.0 ging dabei immer der
    // deutsche Wortlaut raus, waehrend der Korpus je Sprache uebersetzt geladen
    // wird — in allen anderen Sprachen kam ki.noAnswer („nichts gefunden")
    // heraus, weshalb hier nur Deutsch angetippt wurde. Seit 1.40.0 passt die
    // Frage zur Sprache der Quellen (features/ki/beispielfragen.ts), also zeigt
    // jedes Sprachbild eine echte Antwort statt eines Leerzustands.
    if (s.action === 'ki') {
      const label = beispielLabel(lang);
      const pos = label ? findeKnoten(label) : null;
      if (pos) {
        sh(`input tap ${pos[0]} ${pos[1]}`);
        await sleep(4500);
      } else {
        console.warn(`  ! ${play}: Beispielfrage "${label}" nicht gefunden — leerer KI-Screen`);
      }
    }
    // WACHE: nur aufnehmen, wenn die App wirklich vorn ist. Ohne diese Pruefung
    // landete ein Bild der Android-Systemeinstellungen im Store-Satz, weil eine
    // Aktion die Activity verlassen hatte (2026-08-07). Ein falsches Bild faellt
    // hinterher niemandem auf - es sieht ja nach einem Screenshot aus.
    let vorn = sh('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"');
    if (!vorn.includes(PKG)) {
      console.warn(`  ! ${play}/${s.name}: App war nicht im Vordergrund - erneut geoeffnet`);
      sh(`am start -a android.intent.action.VIEW -d "${s.link}"`);
      await sleep(Math.max(s.wait, 6000));
      vorn = sh('dumpsys window | grep -E "mCurrentFocus|mFocusedApp"');
      if (!vorn.includes(PKG)) throw new Error(`${play}/${s.name}: App laesst sich nicht in den Vordergrund holen`);
    }
    sh(`am broadcast -a com.android.systemui.demo -e command clock -e hhmm ${berlinHHMM()}`);
    await sleep(600);
    sh('screencap -p /sdcard/shot.png');
    adb('pull', '/sdcard/shot.png', path.join(dir, `${s.name}.png`));
  }
  console.log(`OK ${play}`);
 } catch (e) {
  console.warn(`FEHLGESCHLAGEN ${play}: ${String(e.message).split(/\r?\n/)[0]}`);
  fehlgeschlagen.push(play);
 }
}
if (ungeprueft.length) {
  console.log(`ungeprueft (bitte ansehen): ${ungeprueft.join(' ')}`);
}
if (fehlgeschlagen.length) {
  console.log(`fertig — ${fehlgeschlagen.length} Sprache(n) offen: ${fehlgeschlagen.join(' ')}`);
  process.exitCode = 1;
} else {
  console.log('fertig — alle Sprachen vollstaendig');
}

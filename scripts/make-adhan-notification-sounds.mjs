#!/usr/bin/env node
// Erzeugt die iOS-Benachrichtigungstöne aus den vollen Adhan-Aufnahmen.
//
// WARUM ÜBERHAUPT EIN ZWEITER SATZ DATEIEN:
// Apple begrenzt Benachrichtigungstöne auf UNTER 30 Sekunden und akzeptiert
// nur Linear-PCM/MA4(IMA-ADPCM)/µLaw/aLaw in .aiff/.wav/.caf — ein längerer
// oder anders codierter Ton wird kommentarlos durch den Standardton ersetzt.
// Alle fünf mitgelieferten Aufnahmen sind 2:00–3:47 min lang (ffprobe, siehe
// CUTS unten), also ausnahmslos zu lang. Android braucht diesen Schnitt NICHT:
// dort referenziert der Notification-Channel die volle MP3, die Metro ohnehin
// als `res/raw/assets_audio_azan_*.mp3` in den Release-Build packt
// (s. features/prayer-times/azan.ts).
//
// SCHNITTPUNKTE: nicht stumpf bei 28 s abgeschnitten, sondern am Ende einer
// Gesangsphrase, damit der Ton nicht mitten im Wort endet. Die Werte stammen
// aus einer RMS-Hüllkurven-Analyse (50-ms-Fenster, Schwelle 10 % des
// 90.-Perzentils, Phrasengrenze = >=0,5 s unter der Schwelle, Ausschläge unter
// 1 s sind Atmer und zählen nicht). Belegte Phrasengrenzen je Aufnahme stehen
// in docs/audit-2026-07-27/ADHAN-LIZENZEN.md.
//
// Aufruf: node scripts/make-adhan-notification-sounds.mjs   (braucht ffmpeg)
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'assets', 'audio', 'azan');
const OUT_DIR = join(SRC_DIR, 'notification');

/**
 * Sekunden bis zum Ende der letzten Phrase, die noch komplett unter 30 s passt.
 *
 * adhan1/adhan2 sind langsam vorgetragen: dort endet schon die ERSTE Phrase
 * (die beiden einleitenden „Allāhu akbar") erst bei 15,4 s bzw. 16,5 s, die
 * zweite bei 29,8 s bzw. 30,6 s — zu knapp bzw. zu spät für Apples Grenze.
 * Deshalb hier Schnitt nach Phrase 1. Beim Fadschr-Ruf endet Phrase 2 bei
 * 22,2 s, dort wird wie gehabt nach den vier Takbīr geschnitten.
 */
const CUTS = {
  adhan1: 16.2, // Original 153,6 s; Phrase 1 endet 15,4 s
  adhan2: 17.3, // Original 183,1 s; Phrase 1 endet 16,5 s
  fajr: 23.0, // Original 243,9 s; Phrase 2 endet 22,2 s
};

const FADE_OUT_S = 0.8;

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, seconds] of Object.entries(CUTS)) {
  if (seconds >= 30) throw new Error(`${name}: ${seconds}s — iOS erlaubt nur < 30 s`);
  const out = join(OUT_DIR, `adhan_${name}.caf`);
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-v', 'error',
      '-y',
      '-i', join(SRC_DIR, `${name}.mp3`),
      '-t', String(seconds),
      '-af', `afade=t=out:st=${(seconds - FADE_OUT_S).toFixed(2)}:d=${FADE_OUT_S}`,
      '-ac', '1',
      '-ar', '22050',
      // MA4/IMA-ADPCM: das einzige von Apple für Benachrichtigungstöne
      // erlaubte komprimierte Format (4:1 gegenüber Linear-PCM).
      '-c:a', 'adpcm_ima_qt',
      out,
    ],
    { stdio: 'inherit' },
  );
  console.log(`${out} (${seconds}s)`);
}

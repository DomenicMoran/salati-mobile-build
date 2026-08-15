import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale-detect';

import {
  LEARN_CORE_TEXTS,
  PRAYERS,
  PRAY_ALONG_ENTRY,
  PRAY_ALONG_UI,
  buildSteps,
  prayerById,
  type PrayStep,
} from './prayers';

// Inhalts-Audit 2026-07-27: "Gebet mitbeten" ist der einzige Bildschirm, auf
// dem der Nutzer WÄHREND des Gebets mitliest — eine unverstandene Anweisung
// macht die Handlung ungültig. Genau hier lagen die Texte bis zum Audit nur in
// de/en/tr/ar/es/fr vor, und `resolveText()` fiel für die 8 Phase-1-Sprachen
// (id/bn/fa/ms/ur/sw/ru/ps) STILL auf Englisch zurück — ohne Hinweis an den
// Nutzer und ohne dass ein Test das bemerkt hätte (die Datei hatte gar keinen).
// Diese Suite prüft daher jedes lokalisierte Feld gegen ALLE 14 App-Sprachen,
// nicht gegen eine Stichprobe.

/** Alle lokalisierten Objekte eines Schritts, mit sprechendem Pfad zum Debuggen. */
function stepFields(step: PrayStep, path: string): [string, Partial<Record<Locale, string>>][] {
  const fields: [string, Partial<Record<Locale, string>>][] = [
    [`${path}.label`, step.label],
    [`${path}.translation`, step.translation],
  ];
  if (step.note) fields.push([`${path}.note`, step.note]);
  return fields;
}

/** Jedes lokalisierte Objekt der gesamten Pray-Along-Oberfläche + Inhalte. */
function allLocalizedFields(): [string, Partial<Record<Locale, string>>][] {
  const fields: [string, Partial<Record<Locale, string>>][] = [];

  for (const prayer of PRAYERS) {
    fields.push([`PRAYERS.${prayer.id}.name`, prayer.name]);
    fields.push([`PRAYERS.${prayer.id}.timeName`, prayer.timeName]);
  }

  // buildSteps erzeugt die Schritte je nach Rak'ah-Zahl unterschiedlich (erstes
  // vs. letztes Tashahhud, Sure nur in Rak'ah 1+2, Qunut nur im Witr). Beide
  // Witr-Varianten werden abgedeckt, damit kein Zweig ungeprüft bleibt.
  for (const prayer of PRAYERS) {
    for (const witrSurahInThird of [false, true]) {
      const steps = buildSteps(prayer.id, { witrSurahInThird });
      steps.forEach((step, i) => {
        fields.push(...stepFields(step, `${prayer.id}[surah3=${witrSurahInThird}].step${i}`));
      });
    }
  }

  LEARN_CORE_TEXTS.forEach((step, i) => {
    fields.push(...stepFields(step, `LEARN_CORE_TEXTS.${i}`));
  });

  for (const [key, value] of Object.entries(PRAY_ALONG_ENTRY)) {
    fields.push([`PRAY_ALONG_ENTRY.${key}`, value]);
  }
  for (const [key, value] of Object.entries(PRAY_ALONG_UI)) {
    fields.push([`PRAY_ALONG_UI.${key}`, value]);
  }

  return fields;
}

describe('Pray-Along: Sprachabdeckung', () => {
  it('hat für jeden lokalisierten Text alle 14 App-Sprachen (kein stiller Englisch-Fallback)', () => {
    const missing: string[] = [];
    for (const [path, text] of allLocalizedFields()) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!text[locale]?.trim()) missing.push(`${path} → ${locale}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('übernimmt keine fremde Sprache 1:1 als Platzhalter (Nicht-Latein-Schriften geprüft)', () => {
    // Ein häufiger Pflegefehler ist, den englischen Wert in das neue
    // Sprachfeld zu kopieren, damit "etwas dasteht". Für Sprachen mit eigener
    // Schrift lässt sich das objektiv nachweisen: der Wert MUSS Zeichen der
    // Zielschrift enthalten. (ar bleibt außen vor — arabische Werte sind hier
    // teils identisch mit dem zitierten Originaltext.)
    const SCRIPTS: Partial<Record<Locale, RegExp>> = {
      bn: /[ঀ-৿]/,
      ru: /[Ѐ-ӿ]/,
      fa: /[؀-ۿ]/,
      ur: /[؀-ۿ]/,
      ps: /[؀-ۿ]/,
    };
    const suspicious: string[] = [];
    for (const [path, text] of allLocalizedFields()) {
      for (const [locale, script] of Object.entries(SCRIPTS) as [Locale, RegExp][]) {
        const value = text[locale] ?? '';
        // Reine Zahlen-/Symbolwerte gibt es hier nicht; jeder Wert ist ein Satz.
        if (!script.test(value)) suspicious.push(`${path} → ${locale}: ${value}`);
      }
    }
    expect(suspicious).toEqual([]);
  });
});

describe('Pray-Along: Ablauf-Struktur', () => {
  it('deckt die 5 Pflichtgebete + Witr ab', () => {
    expect(PRAYERS.map((p) => p.id)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr']);
  });

  it('erzeugt je Gebet genau so viele Rak’ah wie deklariert', () => {
    for (const prayer of PRAYERS) {
      const rakahs = buildSteps(prayer.id)
        .map((s) => s.rakah)
        .filter((r): r is number => typeof r === 'number');
      expect(Math.max(...rakahs)).toBe(prayer.rakahs);
    }
  });

  it('liest die zusätzliche Sure standardmäßig nur in Rak’ah 1 und 2', () => {
    for (const prayer of PRAYERS) {
      const surahRakahs = buildSteps(prayer.id)
        .filter((s) => s.isSurah)
        .map((s) => s.rakah);
      expect(surahRakahs.every((r) => r === 1 || r === 2)).toBe(true);
    }
  });

  it('setzt Dua al-Qunut ausschließlich im Witr, und dort in der 3. Rak’ah', () => {
    for (const prayer of PRAYERS) {
      // Über die Umschrift identifiziert, nicht über einen Anzeigetext: die
      // Umschrift ist sprachunabhängig und ändert sich nicht mit dem Wording.
      const qunut = buildSteps(prayer.id).filter((s) =>
        s.transliteration?.startsWith('allāhumma innā nastaʿīnuka'),
      );
      if (prayer.witr) {
        expect(qunut).toHaveLength(1);
        expect(qunut[0].rakah).toBe(3);
      } else {
        expect(qunut).toHaveLength(0);
      }
    }
  });

  it('schließt jedes Gebet mit dem Salam ab', () => {
    for (const prayer of PRAYERS) {
      const steps = buildSteps(prayer.id);
      expect(steps[steps.length - 1].posture).toBe('salam');
    }
  });

  it('erlaubt im Witr optional die Sure in der 3. Rak’ah (Rechtsschul-Option)', () => {
    const withOption = buildSteps('witr', { witrSurahInThird: true }).filter((s) => s.isSurah);
    expect(withOption.map((s) => s.rakah)).toContain(3);
  });

  it('findet jedes Gebet über prayerById', () => {
    for (const prayer of PRAYERS) {
      expect(prayerById(prayer.id)?.id).toBe(prayer.id);
    }
    expect(prayerById('nope')).toBeUndefined();
  });
});

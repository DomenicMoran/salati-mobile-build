// "Gemeinsam beten" (Dschamāʿa) — Aufstellung + Verhaltensregeln im
// Gemeinschaftsgebet. Rein deklaratives Datenmodell, KEINE eigene Text-
// Lokalisierung hier: alle sichtbaren Strings (Titel, Fließtext, Labels)
// liegen als i18n-Schlüssel im Teilbaum `gebetGemeinsam` von
// src/locales/*.json (14 Sprachen) — anders als src/features/pray-along/
// prayers.ts oder guides.json, die Übersetzungen INLINE als
// LocalizedText-Objekt im Datenfile tragen. Grund für die Abweichung: der
// Locale-Teilbaum ist während dieser Änderung exklusiv für dieses Feature
// reserviert (andere Agenten arbeiten parallel an anderen Teilbäumen der
// gleichen 14 Dateien) — ein neues, in sich geschlossenes Datenfile hätte
// dieselbe Kollisionsgefahr gehabt wie ein direkter Edit an den
// Locale-Dateien selbst.
//
// SORGFALTSPFLICHT (religiöse Rechtsaussagen — s. auch Kopfkommentar in
// pray-along/prayers.ts und der Hinweis in fiqh-ibadat.json):
// Jede `GebetGemeinsamRegel` trägt DREI getrennte Metadaten, die die Anzeige
// im Screen sichtbar auseinanderhält (s. src/app/gebet-gemeinsam/index.tsx):
//   - `grad` (Sicherheitsgrad): "anerkannt" = von allen großen Rechtsschulen
//     inhaltlich getragen; "strittig" = Rechtsschulen kommen zu
//     unterschiedlichen Schlüssen (hanafitische Position wird im Text ZUERST
//     genannt, Abweichungen ausdrücklich daneben — Repo-Muster, s.
//     pray-along/prayers.ts:702 zum Witr-Qunut); "empfehlung" = praktischer
//     Hinweis ohne Rechtsnormcharakter (darf NIE wie eine Regel aussehen).
//   - `madhhab`: grobe Einordnung für ein optionales Chip/Label in der UI
//     (rein informativ, ersetzt NICHT die ausführliche Erklärung im Text).
//   - `source`: Primärbeleg im Repo-Format ("Quran 62:9", "Sahih al-Bukhari
//     699" …), `null` NUR bei grad "empfehlung" (ein reiner Praxistipp
//     braucht keinen Rechtsbeleg). Jede Hadith-Nummer wurde vor dem Schreiben
//     recherchiert (sunnah.com-Titel-Treffer bzw. mehrfach übereinstimmende
//     Sekundärquellen — sunnah.com selbst blockt direkten Abruf mit HTTP
//     403). Zwei Nummern mit nur mittlerer statt hoher Zuversicht sind in
//     OFFEN.md als "vor Store-Launch gegenprüfen" markiert, NICHT verschwiegen.
//     Alles, was sich nicht sauber belegen ließ, wurde weggelassen und steht
//     ebenfalls in OFFEN.md — nie eine erfundene Nummer.
//
// Ein reines Freitext-Feld (wie `note` in prayers.ts) hätte die drei Grade
// nicht UI-seitig auseinanderhalten können — deshalb hier ein eigener Typ
// statt des bestehenden Freitext-Musters.
//
// WICHTIG: Vor Store-Launch religiös gegenprüfen (gleiches Verfahren wie
// guides.json/duas.json/prayers.ts).

export type Sicherheitsgrad = 'anerkannt' | 'strittig' | 'empfehlung';

/** Grobe Einordnung für ein Chip in der UI — s. Kopfkommentar. */
export type MadhhabHinweis = 'alle' | 'hanafi' | 'verschieden';

export interface GebetGemeinsamRegel {
  id: string;
  /** i18n-Key, Teilbaum `gebetGemeinsam.regeln.<id>.titel`. */
  titelKey: string;
  /** i18n-Key, Teilbaum `gebetGemeinsam.regeln.<id>.text`. */
  textKey: string;
  grad: Sicherheitsgrad;
  madhhab: MadhhabHinweis;
  /** Primärbeleg(e), Repo-Format ("Quran 2:144", "Sahih al-Bukhari 699").
   *  `null` nur bei grad === 'empfehlung'. */
  source: string | null;
}

export const GEBET_GEMEINSAM_SECTIONS = ['aufstellung', 'rezitation', 'mahram'] as const;
export type GebetGemeinsamSection = (typeof GEBET_GEMEINSAM_SECTIONS)[number];

export const GEBET_GEMEINSAM_REGELN: Record<GebetGemeinsamSection, GebetGemeinsamRegel[]> = {
  aufstellung: [
    {
      id: 'imamMitEinemMitbeter',
      titelKey: 'gebetGemeinsam.regeln.imamMitEinemMitbeter.titel',
      textKey: 'gebetGemeinsam.regeln.imamMitEinemMitbeter.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 699',
    },
    {
      id: 'abDreiPersonen',
      titelKey: 'gebetGemeinsam.regeln.abDreiPersonen.titel',
      textKey: 'gebetGemeinsam.regeln.abDreiPersonen.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih Muslim 3006',
    },
    {
      id: 'frauZuHause',
      titelKey: 'gebetGemeinsam.regeln.frauZuHause.titel',
      textKey: 'gebetGemeinsam.regeln.frauZuHause.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 727',
    },
    {
      id: 'familienrunde',
      titelKey: 'gebetGemeinsam.regeln.familienrunde.titel',
      textKey: 'gebetGemeinsam.regeln.familienrunde.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 727',
    },
    {
      id: 'reihenSchliessen',
      titelKey: 'gebetGemeinsam.regeln.reihenSchliessen.titel',
      textKey: 'gebetGemeinsam.regeln.reihenSchliessen.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 723',
    },
    {
      id: 'besteReihen',
      titelKey: 'gebetGemeinsam.regeln.besteReihen.titel',
      textKey: 'gebetGemeinsam.regeln.besteReihen.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih Muslim 440',
    },
    {
      id: 'qiblaAusrichtung',
      titelKey: 'gebetGemeinsam.regeln.qiblaAusrichtung.titel',
      textKey: 'gebetGemeinsam.regeln.qiblaAusrichtung.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Quran 2:144',
    },
  ],
  rezitation: [
    {
      id: 'lauteUndLeiseGebete',
      titelKey: 'gebetGemeinsam.regeln.lauteUndLeiseGebete.titel',
      textKey: 'gebetGemeinsam.regeln.lauteUndLeiseGebete.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Quran 17:110',
    },
    {
      id: 'verhaltenBeiLauterRezitation',
      titelKey: 'gebetGemeinsam.regeln.verhaltenBeiLauterRezitation.titel',
      textKey: 'gebetGemeinsam.regeln.verhaltenBeiLauterRezitation.text',
      grad: 'strittig',
      madhhab: 'verschieden',
      source: 'Quran 7:204; Sahih al-Bukhari 756; Sahih Muslim 394',
    },
    {
      id: 'amin',
      titelKey: 'gebetGemeinsam.regeln.amin.titel',
      textKey: 'gebetGemeinsam.regeln.amin.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 780',
    },
    {
      id: 'rabbanaUndTakbir',
      titelKey: 'gebetGemeinsam.regeln.rabbanaUndTakbir.titel',
      textKey: 'gebetGemeinsam.regeln.rabbanaUndTakbir.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 789',
    },
    {
      id: 'rhythmusEmpfehlung',
      titelKey: 'gebetGemeinsam.regeln.rhythmusEmpfehlung.titel',
      textKey: 'gebetGemeinsam.regeln.rhythmusEmpfehlung.text',
      grad: 'empfehlung',
      madhhab: 'alle',
      source: null,
    },
  ],
  mahram: [
    {
      id: 'mahramUndKhilwa',
      titelKey: 'gebetGemeinsam.regeln.mahramUndKhilwa.titel',
      textKey: 'gebetGemeinsam.regeln.mahramUndKhilwa.text',
      grad: 'anerkannt',
      madhhab: 'alle',
      source: 'Sahih al-Bukhari 5233',
    },
  ],
};

export const ALL_GEBET_GEMEINSAM_REGELN: GebetGemeinsamRegel[] = GEBET_GEMEINSAM_SECTIONS.flatMap(
  (section) => GEBET_GEMEINSAM_REGELN[section],
);

// ─────────────────────────────────────────────────────────────────────────
// Aufstellungs-Diagramme
//
// Rein strukturelle Beschreibung (KEIN Text): jede Konstellation ist eine
// Liste von Reihen von vorn (Imam) nach hinten, jede Reihe eine Liste von
// Rollen in Anzeige-Reihenfolge. Alle Betenden blicken zur Qibla (oben im
// Diagramm) — "rechts" ist für Imam UND Diagramm dieselbe Seite, weil beide
// in dieselbe Richtung blicken (kein Spiegeln nötig).
//
// Sonderfall `imamMitEinemMitbeter`: der einzige Mitbeter steht NICHT in
// einer eigenen Reihe, sondern in DERSELBEN Reihe wie der Imam, rechts neben
// ihm — genau der Fall aus Regel `imamMitEinemMitbeter`. Ab drei Personen
// bilden alle Mitbetenden eine eigene Reihe dahinter (Regel `abDreiPersonen`).
// ─────────────────────────────────────────────────────────────────────────

export type AufstellungsRolle = 'imam' | 'mann' | 'frau';

export interface AufstellungsKonstellation {
  id: string;
  titelKey: string;
  beschreibungKey: string;
  reihen: AufstellungsRolle[][];
}

export const AUFSTELLUNGEN: AufstellungsKonstellation[] = [
  {
    id: 'zweiPersonen',
    titelKey: 'gebetGemeinsam.konstellationen.zweiPersonen.titel',
    beschreibungKey: 'gebetGemeinsam.konstellationen.zweiPersonen.beschreibung',
    reihen: [['imam', 'mann']],
  },
  {
    id: 'imamEhefrau',
    titelKey: 'gebetGemeinsam.konstellationen.imamEhefrau.titel',
    beschreibungKey: 'gebetGemeinsam.konstellationen.imamEhefrau.beschreibung',
    reihen: [['imam'], ['frau']],
  },
  {
    id: 'dreiPersonen',
    titelKey: 'gebetGemeinsam.konstellationen.dreiPersonen.titel',
    beschreibungKey: 'gebetGemeinsam.konstellationen.dreiPersonen.beschreibung',
    reihen: [['imam'], ['mann', 'mann']],
  },
  {
    id: 'familienrunde',
    titelKey: 'gebetGemeinsam.konstellationen.familienrunde.titel',
    beschreibungKey: 'gebetGemeinsam.konstellationen.familienrunde.beschreibung',
    reihen: [['imam'], ['mann', 'mann'], ['frau', 'frau']],
  },
  {
    id: 'groessereGruppe',
    titelKey: 'gebetGemeinsam.konstellationen.groessereGruppe.titel',
    beschreibungKey: 'gebetGemeinsam.konstellationen.groessereGruppe.beschreibung',
    reihen: [
      ['imam'],
      ['mann', 'mann', 'mann', 'mann'],
      ['mann', 'mann', 'mann', 'mann'],
      ['frau', 'frau', 'frau', 'frau'],
    ],
  },
];

/** Querverweise auf bereits vorhandene, geprüfte Inhalte — hier NICHT
 *  dupliziert, sondern im Screen als Links dargestellt. */
export const GEBET_GEMEINSAM_QUERVERWEISE = {
  studyFreitagsUndMoscheeEtikette: { course: 'fiqh-ibadat', lesson: 'fiqh-13' } as const,
  studySutraDesImams: { course: 'fiqh-ibadat', lesson: 'fiqh-11' } as const,
};

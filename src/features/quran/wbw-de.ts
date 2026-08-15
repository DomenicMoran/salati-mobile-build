// Deutsche Wort-für-Wort-Glossen für die kurzen Kernsuren.
//
// Hintergrund: quran.coms Wort-für-Wort-Daten (fetchSurahWordByWord) liefern die
// Einzelwort-Bedeutung AUSSCHLIESSLICH auf Englisch — weder der `language`- noch
// der `word_translation_language`-Parameter ändert das (live geprüft). Für die
// wichtigsten, im Gebet täglich rezitierten Suren wäre ein englisches Gloss für
// deutschsprachige Lernende ein Bruch. Diese Datei schließt die Lücke mit
// handgepflegten deutschen Glossen — theologisch an der etablierten deutschen
// Koran-Terminologie orientiert (Allerbarmer/Barmherzig, Herr der Welten …).
//
// WICHTIG — positionsgebunden: Die Arrays sind exakt an der Wort-Segmentierung
// von quran.com ausgerichtet (char_type_name === 'word', „end"-Pseudowörter
// ausgenommen), Reihenfolge = Lesereihenfolge. Die Wort-Zahl je Vers wurde am
// 2026-07-22 gegen verses/by_chapter (words=true) verifiziert. Der Reader gleicht
// zusätzlich die Array-Länge gegen die tatsächlich geladene Wortliste ab und
// fällt bei Abweichung sauber auf das englische Gloss zurück (kein Fehlversatz).

/** Sure → Vers (1-basiert) → deutsches Gloss je Wort (in Lesereihenfolge). */
type SurahGlosses = Record<number, readonly string[]>;

const WBW_DE: Record<number, SurahGlosses> = {
  // Al-Fatiha (1) — Die Eröffnende
  1: {
    1: ['Im Namen', 'Allahs', 'des Allerbarmers', 'des Barmherzigen'],
    2: ['Alles Lob', 'gebührt Allah', 'dem Herrn', 'der Welten'],
    3: ['des Allerbarmers', 'des Barmherzigen'],
    4: ['dem Herrscher', 'des Tages', 'des Gerichts'],
    5: ['Dir allein', 'dienen wir', 'und Dich allein', 'bitten wir um Hilfe'],
    6: ['Leite uns', 'den Weg', 'den geraden'],
    7: [
      'den Weg',
      'derjenigen',
      'denen Du Gnade erwiesen hast',
      'über sie',
      'nicht (derer)',
      'die (Deinen) Zorn erregt haben',
      'über sich',
      'und nicht',
      'der Irregehenden',
    ],
  },
  // Al-Ikhlas (112) — Die Aufrichtigkeit
  112: {
    1: ['Sprich', 'Er', 'ist Allah', 'der Einzige'],
    2: ['Allah', 'der Ewige, Absolute'],
    3: ['Nicht', 'zeugt Er', 'und nicht', 'wurde Er gezeugt'],
    4: ['Und nicht', 'ist', 'Ihm', 'ebenbürtig', 'irgendjemand'],
  },
  // Al-Falaq (113) — Das Frühlicht
  113: {
    1: ['Sprich', 'Ich suche Zuflucht', 'beim Herrn', 'des Tagesanbruchs'],
    2: ['vor', 'dem Übel', 'dessen, was', 'Er erschaffen hat'],
    3: ['und vor', 'dem Übel', 'der Dunkelheit', 'wenn', 'sie hereinbricht'],
    4: ['und vor', 'dem Übel', 'der (in Knoten) Blasenden', 'auf', 'die Knoten'],
    5: ['und vor', 'dem Übel', 'eines Neiders', 'wenn', 'er neidet'],
  },
  // An-Nas (114) — Die Menschen
  114: {
    1: ['Sprich', 'Ich suche Zuflucht', 'beim Herrn', 'der Menschen'],
    2: ['dem König', 'der Menschen'],
    3: ['dem Gott', 'der Menschen'],
    4: ['vor', 'dem Übel', 'des Einflüsterers', 'des Zurückweichenden'],
    5: ['der', 'einflüstert', 'in', 'die Brüste', 'der Menschen'],
    6: ['von', 'den Dschinn', 'und den Menschen'],
  },
};

/** true, wenn für diese Sure deutsche Wort-Glossen hinterlegt sind. */
export function hasGermanWordByWord(surah: number): boolean {
  return surah in WBW_DE;
}

/**
 * Deutsche Wort-Glossen für einen Vers, oder undefined wenn keine hinterlegt
 * sind. Die Länge des Arrays MUSS gegen die tatsächliche Wortliste geprüft
 * werden (der Aufrufer fällt bei Abweichung auf Englisch zurück).
 */
export function getGermanWordGlosses(surah: number, ayah: number): readonly string[] | undefined {
  return WBW_DE[surah]?.[ayah];
}

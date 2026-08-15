import { isPassed, isUnlockedIn, recordResult, type LearnProgress } from '@/features/learn/progress';
import de from '@/locales/de.json';
import { COURSE_META, loadCourse, loadCourseLessons } from './courses';

// Regressionstest für den User-Fund "Tajwid ist noch gesperrt, ich kann es
// erst starten, wenn ich Wortschatz etc. abgeschlossen habe, obwohl die
// Reihenfolge für mich evtl. keinen Sinn ergibt": app/learn/index.tsx
// verkettete früher Tajwid -> Grammatik -> Madinah-Arabisch (und alle drei
// hinter dem vollständigen Kern-Lesen-Pfad inkl. Koran-Wortschatz) über ein
// zusätzliches `phaseLocked`-Flag, das UNABHÄNGIG von der eigentlichen,
// korrekt kurs-scoped isUnlockedIn-Prüfung war. Diese Kette wurde entfernt —
// die einzige verbleibende Unlock-Quelle je Kurs ist
// isUnlockedIn(course.lessons, ownProgress, lessonId), die per Definition
// nur vom EIGENEN Storage-Key abhängt und keinen Zugriff auf andere Kurse
// oder den Kern-Lesen-Pfad hat.
describe('Kurs-Unlock ist themenscoped, nicht global-sequenziell', () => {
  const crossCourseIds = ['tajwid', 'grammar', 'madinah'];

  it('erste Lektion von Tajwid/Grammatik/Madinah-Arabisch ist ohne jeden eigenen Fortschritt sofort startbar', async () => {
    for (const id of crossCourseIds) {
      const course = (await loadCourse(id))!;
      expect(course.lessons.length).toBeGreaterThan(0);
      expect(isUnlockedIn(course.lessons, {}, course.lessons[0].id)).toBe(true);
    }
  });

  it('Startbarkeit von Tajwid/Grammatik/Madinah-Arabisch hängt nie vom Fortschritt eines ANDEREN Kurses ab', async () => {
    // isUnlockedIn nimmt bewusst nur die Lektionen + den Fortschritt EINES
    // Kurses entgegen - es existiert keine Möglichkeit, "vollständig
    // unbearbeiteter Wortschatz/Kern-Lesen-Pfad" als Sperrgrund für einen
    // anderen Kurs hineinzureichen. Diese leere Ausgangslage simuliert
    // exakt den User-Fund: kein einziger Kern-Lesen/Wortschatz-Fortschritt
    // vorhanden, trotzdem muss Tajwid Lektion 1 startbar sein.
    const noProgress: LearnProgress = {};
    for (const id of crossCourseIds) {
      const course = (await loadCourse(id))!;
      expect(isUnlockedIn(course.lessons, noProgress, course.lessons[0].id)).toBe(true);
    }
  });

  it('innerhalb eines Kurses bleibt die echte Lektion-für-Lektion-Progression bestehen', async () => {
    for (const id of crossCourseIds) {
      const course = (await loadCourse(id))!;
      if (course.lessons.length < 2) continue;
      const secondLessonId = course.lessons[1].id;
      expect(isUnlockedIn(course.lessons, {}, secondLessonId)).toBe(false);
      const passed = recordResult({}, course.lessons[0].id, 8, 8);
      expect(isPassed(passed, course.lessons[0].id)).toBe(true);
      expect(isUnlockedIn(course.lessons, passed, secondLessonId)).toBe(true);
    }
  });

  it('Course-Datenmodell kennt kein kurs-übergreifendes Sperr-Feld', () => {
    for (const course of COURSE_META) {
      expect(course).not.toHaveProperty('phaseLocked');
      expect(course).not.toHaveProperty('requiresCourseId');
    }
  });
});

// COURSE_DEFS.lessonCount (courses.ts) ist per Design hart hinterlegt, damit
// COURSE_META synchron ohne die schweren Kurs-JSONs verfügbar ist (siehe
// Kommentar dort). Dieser Test ist die Absicherung dagegen, dass diese Zahl
// bei einer künftigen Content-Änderung (Lektion hinzugefügt/entfernt)
// stillschweigend veraltet — er lädt jedes Kurs-JSON tatsächlich und
// vergleicht die reale Lektionsanzahl mit dem hinterlegten lessonCount.
describe('COURSE_META.lessonCount bleibt synchron mit den echten Kurs-JSONs', () => {
  it.each(COURSE_META.map((c) => c.id))('%s: lessonCount stimmt mit der geladenen Lektionsanzahl überein', async (id) => {
    const meta = COURSE_META.find((c) => c.id === id)!;
    const lessons = await loadCourseLessons(id);
    expect(lessons.length).toBe(meta.lessonCount);
  });
});

// Kursbeschreibungen (study.courses.*.desc) sind Werbetexte im Produkt — sie
// dürfen nicht mehr versprechen, als die Kursdaten liefern. Gefunden im Audit
// 2026-07-27: der Propheten-Kurs warb mit "Von Adam bis Isa", endete aber bei
// Musa; der Alltags-Arabisch-Kurs nannte "786 Vokabeln + 168 Alltagssätze",
// obwohl schon die Summe (954) nicht zu den ebenfalls genannten 869 passte.
// Beide Zahlenversprechen werden hier gegen die echten Daten gehalten.
describe('Kursbeschreibungen versprechen nicht mehr, als die Daten liefern', () => {
  const desc = de.study.courses as Record<string, { desc: string }>;

  /** Alle Zahlen einer Beschreibung, in Reihenfolge des Auftretens. */
  const numbersIn = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);

  it.each(COURSE_META.map((c) => c.id))(
    '%s: jede in der Beschreibung genannte Lektionszahl entspricht der echten',
    async (id) => {
      const lessons = await loadCourseLessons(id);
      const match = /(\d+)\s*(?:Lektion|Lektionen)/.exec(desc[id]?.desc ?? '');
      if (!match) return; // Beschreibung nennt keine Lektionszahl - nichts zu prüfen.
      expect(Number(match[1])).toBe(lessons.length);
    },
  );

  it('amau: die drei genannten Zahlen (gesamt, Vokabeln, Sätze) stimmen und gehen auf', async () => {
    const lessons = await loadCourseLessons('amau');
    const words = lessons.flatMap((lesson) => lesson.vocabWords ?? []);
    const sentenceLessons = lessons.filter((lesson) => /Alltagssätze/.test(lesson.title?.de ?? ''));
    const sentences = sentenceLessons.flatMap((lesson) => lesson.vocabWords ?? []);
    const vocab = words.length - sentences.length;

    const [total, claimedVocab, claimedSentences] = numbersIn(desc.amau.desc);
    expect(total).toBe(words.length);
    expect(claimedVocab).toBe(vocab);
    expect(claimedSentences).toBe(sentences.length);
    expect(claimedVocab + claimedSentences).toBe(total);
  });

  it('prophets: die Beschreibung "von Adam bis Isa" deckt sich mit erster und letzter Lektion', async () => {
    expect(desc.prophets.desc).toContain('Adam');
    expect(desc.prophets.desc).toContain('Isa');
    const lessons = await loadCourseLessons('prophets');
    expect(lessons[0].title?.de).toContain('Adam');
    expect(lessons[lessons.length - 1].title?.de).toContain('Isa');
  });
});

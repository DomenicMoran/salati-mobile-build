/**
 * Reine Baumaufbau-Logik der Satzstruktur-Ansicht (Satzebene der Wortanalyse,
 * siehe features/quran/analyse/satzstrukturModel.ts). Getestet gegen echte
 * Ausschnitte der Morphologie-Pipeline (__fixtures__/morphologie-*.json) wo
 * sinnvoll, sowie gegen handgebaute Fixtures für Zyklen (im echten Korpus
 * bislang nicht belegt, aber die Logik muss sie trotzdem sicher abfangen)
 * und sehr lange Ketten (Sure 2:282 hat über 100 Wörter).
 */
import sure1Fixture from '@/features/quran/__fixtures__/morphologie-1.json';
import sure2Fixture from '@/features/quran/__fixtures__/morphologie-2-verse-1-5.json';
import { abflachen, baueSatzbaum, direkterKopf } from '@/features/quran/analyse/satzstrukturModel';
import type { MorphologieDatei, MorphSyntax, MorphWord } from '@/features/quran/morphologieTypen';

const sure1 = sure1Fixture as unknown as MorphologieDatei;
const sure2 = sure2Fixture as unknown as MorphologieDatei;

function wort(position: number, text: string, syntax?: MorphSyntax): MorphWord {
  return { position, text, root: null, lemma: text, segments: [], syntax };
}

describe('baueSatzbaum / abflachen', () => {
  it('verschachtelt ein Kind korrekt unter seinem Elternwort (echte Fixture, Sure 1 Vers 2)', () => {
    // ٱلْحَمْدُ (1, root→1 Selbstbezug) · لِلَّهِ (2, gen→2 Selbstbezug) ·
    // رَبِّ (3, App→2) · ٱلْعَٰلَمِينَ (4, Poss→3) — siehe Kopf-Kommentar der
    // Wort-Sheet-Tests: dieselbe Verskette dient dort für die Badal-Relation.
    const words = sure1.verses['2'];
    const baum = baueSatzbaum(words);

    // Zwei Wurzeln: Wort 1 (echtes root) und Wort 2 (Selbstbezug, s. u.).
    expect(baum.map((k) => k.word.position).sort()).toEqual([1, 2]);

    const wurzel2 = baum.find((k) => k.word.position === 2)!;
    expect(wurzel2.tiefe).toBe(0);
    expect(wurzel2.kinder).toHaveLength(1);

    // Wort 3 (رَبِّ) hängt an Wort 2, direkt darunter eingerückt.
    const kind3 = wurzel2.kinder[0];
    expect(kind3.word.position).toBe(3);
    expect(kind3.tiefe).toBe(1);

    // Wort 4 (ٱلْعَٰلَمِينَ) hängt WIEDERUM an Wort 3 — zwei Ebenen tief.
    expect(kind3.kinder).toHaveLength(1);
    expect(kind3.kinder[0].word.position).toBe(4);
    expect(kind3.kinder[0].tiefe).toBe(2);

    // abflachen erhält die Lesereihenfolge (Vorordnung): 1, 2, 3, 4.
    expect(abflachen(baum).map((z) => z.word.position)).toEqual([1, 2, 3, 4]);
    expect(abflachen(baum).map((z) => z.tiefe)).toEqual([0, 0, 1, 2]);
  });

  it('behandelt ein Wort mit Selbstbezug (head === eigene Position) als Wurzel, nicht als eigenes Kind', () => {
    // لِّلْمُتَّقِينَ (2:2:7) — relation "gen", head:7 (Selbstbezug). Kommt im
    // Korpus nicht nur bei relation "root" vor (siehe Kopf-Kommentar
    // satzstrukturModel.ts) — die Prüfung muss also head===position generell
    // abfangen, nicht nur für ein bestimmtes Relationslabel.
    const words = sure2.verses['2'];
    const wortSieben = words.find((w) => w.position === 7)!;
    expect(wortSieben.syntax?.relation).toBe('gen');
    expect(wortSieben.syntax?.head).toBe(7);

    expect(direkterKopf(wortSieben, new Map(words.map((w) => [w.position, w])))).toBeNull();

    const baum = baueSatzbaum(words);
    const knoten7 = baum.find((k) => k.word.position === 7);
    expect(knoten7).toBeDefined();
    expect(knoten7!.tiefe).toBe(0);
    expect(knoten7!.kinder).toHaveLength(0);
  });

  it('markiert ein Wort mit head:null als Wurzel ohne Kinder-Beziehung (elidiertes/anderes-Vers-Bezugswort)', () => {
    // فِيهِ (2:2:5) — relation "link", head: null.
    const words = sure2.verses['2'];
    const wortFuenf = words.find((w) => w.position === 5)!;
    expect(wortFuenf.syntax?.head).toBeNull();

    const baum = baueSatzbaum(words);
    const knoten5 = baum.find((k) => k.word.position === 5);
    expect(knoten5).toBeDefined();
    expect(knoten5!.tiefe).toBe(0);
  });

  it('lässt ein Wort ohne jede syntax-Angabe als Wurzel auftauchen statt es zu verschlucken', () => {
    const words = [wort(1, 'كلمة', undefined), wort(2, 'ثانية', { relation: 'conj', relationAr: 'معطوف', head: 1 })];
    const baum = baueSatzbaum(words);
    expect(baum).toHaveLength(1);
    expect(baum[0].word.position).toBe(1);
    expect(baum[0].kinder.map((k) => k.word.position)).toEqual([2]);
  });

  it('kappt einen Zyklus zwischen zwei Wörtern, statt in eine Endlosschleife zu laufen — jedes Wort erscheint genau einmal', () => {
    const words = [
      wort(1, 'ا', { relation: 'conj', relationAr: 'معطوف', head: 2 }),
      wort(2, 'ب', { relation: 'conj', relationAr: 'معطوف', head: 1 }),
    ];

    const baum = baueSatzbaum(words);
    const zeilen = abflachen(baum);

    // Beide Wörter tauchen GENAU EINMAL auf (nichts verschwindet, nichts
    // dupliziert sich) und die Funktion kehrt überhaupt zurück (kein
    // Stack-Overflow durch unendliche Rekursion).
    expect(zeilen).toHaveLength(2);
    expect(zeilen.map((z) => z.word.position).sort()).toEqual([1, 2]);
    // Die Kante wird am zuerst wiederentdeckten Knoten gekappt: Wort 1 wird
    // Wurzel, Wort 2 hängt darunter (siehe Kopf-Kommentar der Trace-Logik).
    expect(zeilen.find((z) => z.word.position === 1)!.tiefe).toBe(0);
    expect(zeilen.find((z) => z.word.position === 2)!.tiefe).toBe(1);
  });

  it('kappt auch einen Zyklus auf sich selbst über einen Umweg, wenn ein Kopf-Wert außerhalb des Verses ins Leere zeigt', () => {
    // Defensiv: head zeigt auf eine im Vers nicht vorhandene Position.
    const words = [wort(1, 'ا', { relation: 'root', relationAr: 'جذر', head: 99 })];
    const baum = baueSatzbaum(words);
    expect(baum).toHaveLength(1);
    expect(baum[0].tiefe).toBe(0);
  });

  it('bleibt bei einer sehr langen Kopf-Kette (wie Sure 2:282 mit über 100 Wörtern) korrekt und ohne Absturz', () => {
    const ANZAHL = 150;
    const words: MorphWord[] = [wort(1, 'w1', { relation: 'root', relationAr: 'جذر', head: 1 })];
    for (let i = 2; i <= ANZAHL; i++) {
      words.push(wort(i, `w${i}`, { relation: 'conj', relationAr: 'معطوف', head: i - 1 }));
    }

    const baum = baueSatzbaum(words);
    expect(baum).toHaveLength(1);
    expect(baum[0].word.position).toBe(1);

    const zeilen = abflachen(baum);
    expect(zeilen).toHaveLength(ANZAHL);
    // Lesereihenfolge bleibt über die volle Kette erhalten.
    expect(zeilen.map((z) => z.word.position)).toEqual(Array.from({ length: ANZAHL }, (_, i) => i + 1));
    // Tiefe wächst linear mit der Kette (Wort N hängt an Wort N-1).
    expect(zeilen[ANZAHL - 1].tiefe).toBe(ANZAHL - 1);
  });
});

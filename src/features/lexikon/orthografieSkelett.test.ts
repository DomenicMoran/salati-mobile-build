/**
 * normalisiereOrthografieSkelett/skelettImKorpusBelegt — Normalisierung für
 * die Gegenprobe Handout-Drucksatz ↔ Qur'an-Korpus (siehe Kopf-Kommentar in
 * orthografieSkelett.ts und LUECKEN.md, Abschnitt "Korpus-Gegenprobe mit
 * Normalisierung"). Jeder hier abgedeckte Fall ist ein in LUECKEN.md/dem
 * Auftrag ausdrücklich benannter, belegter Unterschied zwischen den beiden
 * Orthografien — nicht nur ein generischer Diakritika-Test.
 */
import { normalisiereOrthografieSkelett, skelettImKorpusBelegt } from './orthografieSkelett';

describe('normalisiereOrthografieSkelett', () => {
  it('löst die Madda auf: جَآءَ (Korpus, mit Madda) == جَاءَ (Handout, Alif+Hamza getrennt)', () => {
    expect(normalisiereOrthografieSkelett('جَآءَ')).toBe(normalisiereOrthografieSkelett('جَاءَ'));
  });

  it('löst den Dagger-Alif auf: جَٰدَلَ (Korpus-Schreibung) == جَادَلَ (Handout, volles Alif) — empirisch am Bab-Muster جادل entdeckt', () => {
    // Ohne diese Regel würde der Dagger-Alif wie ein gewöhnliches Harakat-
    // Zeichen ersatzlos gestrichen (جَٰدَلَ -> جدل statt جادل) und dadurch
    // JEDE Korpusform der Wurzel جدل als vermeintliche Ausnahme durchfallen
    // (empirisch beim ersten Testlauf der Gegenprobe für
    // 'sarf-familie-2-jaadala' aufgefallen, siehe orthografieSkelett.ts).
    expect(normalisiereOrthografieSkelett('جَٰدَلَ')).toBe(normalisiereOrthografieSkelett('جَادَلَ'));
    expect(normalisiereOrthografieSkelett('جَٰدَلَ')).toBe('جادل');
  });

  it('vereinheitlicht alle Hamza-Träger (أ إ آ ٱ ؤ ئ) auf die Grundform', () => {
    const traeger = ['أ', 'إ', 'آ', 'ٱ', 'ؤ', 'ئ', 'ء'];
    const normalisiert = traeger.map((t) => normalisiereOrthografieSkelett(t));
    expect(new Set(normalisiert).size).toBe(1);
    expect(normalisiert[0]).toBe('ا');
  });

  it('vereinheitlicht Hamza-auf-Waw (ؤ) und Hamza-auf-Ya (ئ) mitten im Wort (Bab-Muda"af-Fall تَسَاؤُلًا/تَسَائُلًا)', () => {
    // Beide Formen sind im Handout selbst belegt (Aktiv- bzw. Passiv-Masdar
    // der fünften großen Familie, تفاعل) und weichen NUR im Hamza-Träger
    // voneinander ab — nach Harakat-Entfernung müssen sie skelettgleich sein.
    expect(normalisiereOrthografieSkelett('تَسَاؤُلًا')).toBe(normalisiereOrthografieSkelett('تَسَائُلًا'));
  });

  it('vereinheitlicht Alif maqsura (ى) und Ya (ي): مُوسَى == موسي', () => {
    expect(normalisiereOrthografieSkelett('مُوسَى')).toBe(normalisiereOrthografieSkelett('موسي'));
  });

  it('vereinheitlicht Ta marbuta (ة) und Ha (ه): رَحْمَة == رحمه', () => {
    expect(normalisiereOrthografieSkelett('رَحْمَة')).toBe(normalisiereOrthografieSkelett('رحمه'));
  });

  it('entfernt alle Harakat (Fatha/Damma/Kasra/Sukun/Tanwin/Shadda): كَتَبَ -> كتب', () => {
    expect(normalisiereOrthografieSkelett('كَتَبَ')).toBe('كتب');
    expect(normalisiereOrthografieSkelett('مُحَمَّدٌ')).toBe(normalisiereOrthografieSkelett('محمد'));
  });

  it('streicht Tatweel (ـ): كـتـب -> كتب', () => {
    expect(normalisiereOrthografieSkelett('كـتـب')).toBe(normalisiereOrthografieSkelett('كتب'));
  });

  it('normalisiert nach NFC, bevor Zeichen verglichen werden (komponiert vs. zerlegt)', () => {
    const komponiert = 'أحمد';
    const zerlegt = 'أحمد';
    expect(normalisiereOrthografieSkelett(komponiert)).toBe(normalisiereOrthografieSkelett(zerlegt));
  });

  it('verkraftet leere Eingaben', () => {
    expect(normalisiereOrthografieSkelett('')).toBe('');
  });

  it('lässt gewöhnliche Konsonanten ohne Hamza/Madda/Maqsura/Marbuta unverändert (bis auf Harakat-Entfernung)', () => {
    expect(normalisiereOrthografieSkelett('نَصَرَ')).toBe('نصر');
  });
});

describe('skelettImKorpusBelegt', () => {
  const korpusSkelette = [normalisiereOrthografieSkelett('نَصَرَ'), normalisiereOrthografieSkelett('يَنْصُرُ')];

  it('findet eine Handout-Form (mit Alif+Hamza) über ein Korpus-Skelett (mit Madda) wieder', () => {
    const korpus = [normalisiereOrthografieSkelett('جَآءَ')];
    expect(skelettImKorpusBelegt('جَاءَ', korpus)).toBe(true);
  });

  it('liefert false, wenn die Form in keinem Korpus-Skelett vorkommt', () => {
    expect(skelettImKorpusBelegt('قَرَأَ', korpusSkelette)).toBe(false);
  });

  it('liefert false für eine leere Form (kein "leere Eingabe matcht alles")', () => {
    expect(skelettImKorpusBelegt('', ['ا', 'ب'])).toBe(false);
  });
});

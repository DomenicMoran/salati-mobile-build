// Zakat al-Fitr: eigenständige Pro-Kopf-Pflichtabgabe zum Ende des Ramadan,
// fällig vor dem Eid-Gebet - fachlich GETRENNT von der Vermögens-Zakat
// (siehe calc.ts, dort 2,5 % oberhalb des Nisab). Zakat al-Fitr kennt keinen
// Nisab und kein Vermögen als Bemessungsgrundlage, sondern ist ein fester
// Betrag pro Haushaltsmitglied.
//
// Traditionell ca. 2,5-3 kg eines Grundnahrungsmittels (Weizen/Datteln/Reis/
// Gerste) bzw. dessen Geldgegenwert - die genaue Menge und die Umrechnung in
// einen Geldwert variiert nach Fiqh-Schule und lokaler Gemeinde/Land. Es gibt
// deshalb hier bewusst KEINEN vorgegebenen "offiziellen" Betrag; der Nutzer
// trägt den Geldwert pro Person selbst ein (idealerweise nach Rücksprache mit
// seiner lokalen Moschee).

export interface FitrInput {
  /** Anzahl Personen im Haushalt (inkl. Kinder und der eintragenden Person selbst). */
  householdSize: number;
  /** Geldwert pro Person in Landeswährung, vom Nutzer eingetragen. */
  amountPerPerson: number;
}

export interface FitrResult {
  householdSize: number;
  amountPerPerson: number;
  /**
   * true, wenn amountPerPerson (noch) nicht gesetzt ist. Analog zum
   * priceMissing-Muster der Vermögens-Zakat (Audit 2026-07-20): ein Default
   * von 0 würde fälschlich "0 fällig" statt "nicht berechenbar" anzeigen -
   * die UI muss diese beiden Fälle unterscheiden.
   */
  amountMissing: boolean;
  total: number;
}

export function calcZakatFitr(input: FitrInput): FitrResult {
  const householdSize = Math.max(
    0,
    Math.floor(Number.isFinite(input.householdSize) ? input.householdSize : 0),
  );
  const amountPerPerson = Math.max(
    0,
    Number.isFinite(input.amountPerPerson) ? input.amountPerPerson : 0,
  );
  const amountMissing = !(amountPerPerson > 0);
  const total = amountMissing ? 0 : householdSize * amountPerPerson;
  return { householdSize, amountPerPerson, amountMissing, total };
}

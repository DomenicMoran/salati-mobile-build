import AsyncStorage from '@react-native-async-storage/async-storage';

// Eigener Stand der Herausforderungen: der Zählerstand der selbst gezählten
// Ziele und der Zeitpunkt, zu dem eine Herausforderung erstmals erreicht war.
//
// WAS HIER NICHT LIEGT: der Fortschritt der automatisch gezählten Ziele. Der
// wird bei jedem Öffnen aus den vorhandenen Daten neu berechnet (fortschritt.ts,
// gleiches Prinzip wie bei den Abzeichen in features/achievements/badges.ts).
// Zwei Wahrheiten über denselben Fortschritt wären die sichere Quelle für
// Zahlen, die sich widersprechen.
//
// WOZU DANN `erreichtAm`: eine automatisch gezählte Herausforderung kann ihren
// Fortschritt wieder verlieren — die Gebets-Serie reißt, ein Fastentag wird
// versehentlich abgehakt und wieder entfernt. Das Erreichte soll dadurch nicht
// verschwinden; einmal geschafft bleibt geschafft. Der Zeitpunkt wird deshalb
// festgehalten, sobald das Ziel erstmals erreicht ist, und nie wieder entfernt.

export const CHALLENGES_STORAGE_KEY = 'salatibox:herausforderungen';

export interface HerausforderungStand {
  /** Nur für `quelle === 'manuell'`: wie oft der Nutzer hochgezählt hat. */
  zaehler?: number;
  /** Zeitstempel des ersten Erreichens (ms). Fehlt = noch nie erreicht. */
  erreichtAm?: number;
}

export type HerausforderungenStand = Record<string, HerausforderungStand>;

export const LEERER_STAND: HerausforderungenStand = {};

export function parseStand(raw: string | null): HerausforderungenStand {
  if (!raw) return LEERER_STAND;
  try {
    const roh = JSON.parse(raw) as unknown;
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return LEERER_STAND;
    const sauber: HerausforderungenStand = {};
    for (const [id, wert] of Object.entries(roh as Record<string, unknown>)) {
      if (!wert || typeof wert !== 'object') continue;
      const e = wert as HerausforderungStand;
      const eintrag: HerausforderungStand = {};
      if (typeof e.zaehler === 'number' && Number.isFinite(e.zaehler) && e.zaehler > 0) {
        eintrag.zaehler = Math.floor(e.zaehler);
      }
      if (typeof e.erreichtAm === 'number' && Number.isFinite(e.erreichtAm) && e.erreichtAm > 0) {
        eintrag.erreichtAm = e.erreichtAm;
      }
      if (eintrag.zaehler !== undefined || eintrag.erreichtAm !== undefined) sauber[id] = eintrag;
    }
    return sauber;
  } catch {
    return LEERER_STAND;
  }
}

/** Zähler um `delta` verschieben, nie unter 0. Reine Funktion. */
export function zaehle(stand: HerausforderungenStand, id: string, delta: number): HerausforderungenStand {
  const vorher = stand[id]?.zaehler ?? 0;
  const nachher = Math.max(0, vorher + delta);
  if (nachher === vorher) return stand;
  return { ...stand, [id]: { ...stand[id], zaehler: nachher } };
}

/**
 * Hält das erste Erreichen fest. Ein bereits gesetzter Zeitpunkt bleibt
 * unverändert — auch dann, wenn der Fortschritt später wieder unter das Ziel
 * fällt (s. Dateikopf).
 */
export function merkeErreicht(
  stand: HerausforderungenStand,
  id: string,
  jetzt: number = Date.now(),
): HerausforderungenStand {
  if (stand[id]?.erreichtAm) return stand;
  return { ...stand, [id]: { ...stand[id], erreichtAm: jetzt } };
}

export async function ladeStand(): Promise<HerausforderungenStand> {
  try {
    return parseStand(await AsyncStorage.getItem(CHALLENGES_STORAGE_KEY));
  } catch {
    return LEERER_STAND;
  }
}

export async function speichereStand(stand: HerausforderungenStand): Promise<void> {
  try {
    await AsyncStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(stand));
  } catch {
    // Ohne Speicher bleibt der Stand für diese Sitzung erhalten; ein
    // Schreibfehler darf die Oberfläche nicht abbrechen.
  }
}

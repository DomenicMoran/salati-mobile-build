// Suren-übergreifende Abschnitts-Wiedergabe (Al-Quran-Parität): "von Sure A
// Vers x bis Sure B Vers y" statt nur innerhalb der offenen Sure. Der
// Sure-Reader ([surah].tsx) kann pro Screen nur EINE Sure rendern — jede
// weitere Sure der Wiedergabe lädt deshalb als neue Screen-Instanz (Details
// dort). Diese Datei hält die reine Entscheidungslogik dafür, was nach dem
// natürlichen Ende einer Sure-Etappe als Nächstes passiert, getrennt von
// Navigation/Player-Seiteneffekten — testbar ohne React/expo-audio/expo-router.
export interface CrossSurahTarget {
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
  loop: boolean;
}

export interface CrossSurahLeg {
  surah: number;
  /** 1-basierte Vers-Nummer, ab der diese Etappe abgespielt werden soll. */
  playFrom: number;
}

/**
 * Nächste Sure-Etappe, nachdem `finishedSurah` natürlich zu Ende gespielt
 * wurde — null, wenn `finishedSurah` bereits die Zielsure war (Ende oder
 * Loop-Neustart, s. crossSurahCompletionLeg).
 */
export function nextCrossSurahLeg(target: CrossSurahTarget, finishedSurah: number): CrossSurahLeg | null {
  const nextSurah = finishedSurah + 1;
  if (nextSurah > target.endSurah) return null;
  return { surah: nextSurah, playFrom: 1 };
}

/** Etappe für den Loop-Neustart am Anfang des gesamten Bereichs. */
export function loopStartLeg(target: CrossSurahTarget): CrossSurahLeg {
  return { surah: target.startSurah, playFrom: target.startAyah };
}

/**
 * Was passiert, nachdem eine Sure-Etappe natürlich (nicht durch manuellen
 * Stop) zu Ende gespielt wurde: weiter zur nächsten Sure, zurück zum Anfang
 * (Loop) oder fertig (null = keine weitere Etappe).
 */
export function crossSurahCompletionLeg(target: CrossSurahTarget, finishedSurah: number): CrossSurahLeg | null {
  if (finishedSurah < target.endSurah) return nextCrossSurahLeg(target, finishedSurah);
  return target.loop ? loopStartLeg(target) : null;
}

/**
 * 0-basierter End-Index innerhalb der GERADE geladenen Sure für die
 * playRange()-Etappe dieses Screens: bis zum Ende der Sure, außer diese Sure
 * IST bereits die Zielsure — dann bis zum Ziel-Vers (nie vor `fromIndex`,
 * falls der Nutzer einen widersprüchlichen Bereich gewählt hat).
 */
export function crossSurahLegEndIndex(
  target: CrossSurahTarget | null,
  surahNumber: number,
  fromIndex: number,
  lastAyahIndexInSurah: number,
): number {
  if (target && target.endSurah === surahNumber) {
    return Math.max(fromIndex, target.endAyah - 1);
  }
  return lastAyahIndexInSurah;
}

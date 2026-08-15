import {
  formatDuration,
  groupEpisodesBySeries,
  hasMultipleSeries,
  seriesNeighbors,
  sortEpisodesByLearningPath,
  type VideoEpisode,
} from './data';

function ep(episode_no: number, series?: string, series_title?: string): VideoEpisode {
  return {
    episode_no,
    title: `Folge ${episode_no}`,
    topics: [],
    duration_sec: 60,
    video_url: `https://example/${episode_no}.mp4`,
    cover_url: `https://example/${episode_no}.jpg`,
    ...(series !== undefined ? { series } : {}),
    ...(series_title !== undefined ? { series_title } : {}),
  };
}

describe('sortEpisodesByLearningPath', () => {
  // Der Video-Index bekam `series_order` erst 2026-07-28 (der Podcast hatte es
  // laengst) — vorher konnte die Videoliste gar nicht nach dem Lernweg
  // sortieren und haette die Lese-Reihe (63–68) selbst mit Videos ans Ende
  // gestellt statt an den Anfang.
  function mitOrder(episode_no: number, series: string, series_order: number): VideoEpisode {
    return { ...ep(episode_no, series, series), series_order };
  }

  it('sortiert nach Reihe (series_order), innerhalb der Reihe nach episode_no', () => {
    const sortiert = sortEpisodesByLearningPath([
      mitOrder(1, 'grammar', 3),
      mitOrder(64, 'lesen', 1),
      mitOrder(34, 'tajwid', 2),
      mitOrder(63, 'lesen', 1),
      mitOrder(15, 'grammar', 3),
    ]);
    expect(sortiert.map((e) => e.episode_no)).toEqual([63, 64, 34, 1, 15]);
  });

  it('haengt Eintraege ohne series_order (Tabellen-Videos) hinten an', () => {
    const sortiert = sortEpisodesByLearningPath([
      ep(1000, 'tabellen', 'Grammatik-Tabellen'),
      mitOrder(57, 'pruefung', 10),
      mitOrder(63, 'lesen', 1),
    ]);
    expect(sortiert.map((e) => e.episode_no)).toEqual([63, 57, 1000]);
  });

  it('verhaelt sich ohne das Feld exakt wie die alte Sortierung nach episode_no', () => {
    const sortiert = sortEpisodesByLearningPath([ep(9), ep(2), ep(40)]);
    expect(sortiert.map((e) => e.episode_no)).toEqual([2, 9, 40]);
  });

  it('sortiert eine Kopie (kein Seiteneffekt auf die Eingabe)', () => {
    const eingabe = [mitOrder(1, 'grammar', 3), mitOrder(63, 'lesen', 1)];
    sortEpisodesByLearningPath(eingabe);
    expect(eingabe.map((e) => e.episode_no)).toEqual([1, 63]);
  });
});

describe('formatDuration', () => {
  it('formatiert mm:ss mit führender Null bei den Sekunden', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('zählt über 60 Minuten hinaus weiter in Minuten (kein Stunden-Feld)', () => {
    expect(formatDuration(3600)).toBe('60:00');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('schneidet Bruchsekunden ab', () => {
    expect(formatDuration(59.9)).toBe('0:59');
  });
});

describe('groupEpisodesBySeries', () => {
  it('gruppiert nach Reihe in Erst-Auftritts-Reihenfolge', () => {
    const groups = groupEpisodesBySeries([
      ep(1, 'grammar', 'Grammatik'),
      ep(2, 'tajwid', 'Tadschwid'),
      ep(3, 'grammar', 'Grammatik'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['grammar', 'tajwid']);
    expect(groups[0].episodes.map((e) => e.episode_no)).toEqual([1, 3]);
    expect(groups[0].title).toBe('Grammatik');
  });

  it('legt Folgen ohne Reihe in EINE Default-Gruppe ohne Titel', () => {
    const groups = groupEpisodesBySeries([ep(1), ep(2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
    expect(groups[0].episodes).toHaveLength(2);
  });

  it('fällt ohne series_title auf die Reihen-Kennung zurück', () => {
    expect(groupEpisodesBySeries([ep(1, 'madinah')])[0].title).toBe('madinah');
  });

  it('holt den Reihen-Titel nach, wenn ihn erst eine spätere Folge trägt', () => {
    const groups = groupEpisodesBySeries([ep(1, 'vocab'), ep(2, 'vocab', 'Vokabeln')]);
    expect(groups[0].title).toBe('Vokabeln');
  });

  it('behandelt leere/whitespace-Reihen wie "keine Reihe"', () => {
    const groups = groupEpisodesBySeries([ep(1, '   '), ep(2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
  });

  it('liefert für eine leere Liste keine Gruppen', () => {
    expect(groupEpisodesBySeries([])).toEqual([]);
  });

  it('verliert keine Folge', () => {
    const episodes = [ep(1, 'a'), ep(2), ep(3, 'b'), ep(4, 'a')];
    const grouped = groupEpisodesBySeries(episodes).flatMap((g) => g.episodes);
    expect(grouped).toHaveLength(episodes.length);
  });
});

describe('hasMultipleSeries', () => {
  it('ist false bei nur einer Reihe und bei gar keiner', () => {
    expect(hasMultipleSeries([])).toBe(false);
    expect(hasMultipleSeries([ep(1), ep(2)])).toBe(false);
    expect(hasMultipleSeries([ep(1, 'a'), ep(2, 'a')])).toBe(false);
  });

  it('ist true, sobald zwei verschiedene Reihen vorkommen', () => {
    expect(hasMultipleSeries([ep(1, 'a'), ep(2, 'b')])).toBe(true);
  });

  it('zählt "keine Reihe" als eigene Reihe', () => {
    expect(hasMultipleSeries([ep(1, 'a'), ep(2)])).toBe(true);
  });
});

describe('seriesNeighbors', () => {
  const episodes = [ep(1, 'a'), ep(2, 'b'), ep(3, 'a'), ep(5, 'a'), ep(1000, 'tables')];

  it('bleibt innerhalb der eigenen Reihe (Auto-Play springt nicht in die Tabellen)', () => {
    const { prev, next } = seriesNeighbors(episodes, 3);
    expect(prev?.episode_no).toBe(1);
    expect(next?.episode_no).toBe(5);
  });

  it('hat am Reihen-Anfang kein prev und am Reihen-Ende kein next', () => {
    expect(seriesNeighbors(episodes, 1).prev).toBeUndefined();
    expect(seriesNeighbors(episodes, 5).next).toBeUndefined();
  });

  it('liefert für eine einzelne Folge in ihrer Reihe gar keine Nachbarn', () => {
    expect(seriesNeighbors(episodes, 2)).toEqual({ prev: undefined, next: undefined });
  });

  it('liefert {} für eine unbekannte Folgen-Nummer', () => {
    expect(seriesNeighbors(episodes, 999)).toEqual({});
  });

  it('sortiert nach episode_no, unabhängig von der Listen-Reihenfolge', () => {
    const shuffled = [ep(5, 'a'), ep(1, 'a'), ep(3, 'a')];
    expect(seriesNeighbors(shuffled, 3).prev?.episode_no).toBe(1);
    expect(seriesNeighbors(shuffled, 3).next?.episode_no).toBe(5);
  });
});

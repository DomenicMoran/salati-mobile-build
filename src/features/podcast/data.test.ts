// Sortier- und Gruppierlogik des Podcast-Index. Der Index wird von
// podcast/scripts/upload.py erzeugt; `series_order` ist dort die Position der
// REIHE im Lernweg. Getestet wird vor allem die Rueckwaertskompatibilitaet:
// ein Index OHNE das Feld muss sich exakt wie frueher verhalten (episode_no).
import {
  groupEpisodesBySeries,
  hasMultipleSeries,
  sortEpisodesByLearningPath,
  type PodcastEpisode,
} from './data';

function folge(over: Partial<PodcastEpisode> & { episode_no: number }): PodcastEpisode {
  return {
    title: `Folge ${over.episode_no}`,
    topics: [],
    duration_sec: 60,
    audio_url: `https://example.test/${over.episode_no}.mp3`,
    cover_url: '',
    transcript: [],
    ...over,
  };
}

/** Auszug aus dem echten Index: Reihe -> (series_order, Folgennummern). */
const LERNWEG: [string, number, number[]][] = [
  ['lesen', 1, [63, 64, 65, 66, 67, 68]],
  ['tajwid', 2, [34, 35, 36, 37]],
  ['grammar', 3, [1, 2, 3]],
  ['madinah', 4, [16, 17, 48, 49]],
  ['pruefung', 10, [57, 58]],
];

function lernwegFolgen(): PodcastEpisode[] {
  return LERNWEG.flatMap(([series, order, nos]) =>
    nos.map((n) => folge({ episode_no: n, series, series_order: order, series_title: series })),
  );
}

describe('sortEpisodesByLearningPath', () => {
  it('sortiert nach series_order und innerhalb der Reihe nach episode_no', () => {
    const gemischt = [
      folge({ episode_no: 57, series: 'pruefung', series_order: 10 }),
      folge({ episode_no: 2, series: 'grammar', series_order: 3 }),
      folge({ episode_no: 64, series: 'lesen', series_order: 1 }),
      folge({ episode_no: 1, series: 'grammar', series_order: 3 }),
      folge({ episode_no: 63, series: 'lesen', series_order: 1 }),
    ];
    expect(sortEpisodesByLearningPath(gemischt).map((e) => e.episode_no)).toEqual([
      63, 64, 1, 2, 57,
    ]);
  });

  it('haengt Folgen OHNE series_order hinten an, nach episode_no sortiert', () => {
    const eps = [
      folge({ episode_no: 99 }),
      folge({ episode_no: 70 }),
      folge({ episode_no: 34, series: 'tajwid', series_order: 2 }),
    ];
    expect(sortEpisodesByLearningPath(eps).map((e) => e.episode_no)).toEqual([34, 70, 99]);
  });

  it('verhaelt sich ohne das Feld exakt wie die alte Sortierung (nur episode_no)', () => {
    const alt = [68, 34, 1, 57, 16].map((n) => folge({ episode_no: n }));
    expect(sortEpisodesByLearningPath(alt).map((e) => e.episode_no)).toEqual([1, 16, 34, 57, 68]);
  });

  it('ignoriert kaputte series_order-Werte (NaN/Infinity/Nicht-Zahl)', () => {
    const eps = [
      folge({ episode_no: 5, series_order: Number.NaN }),
      folge({ episode_no: 4, series_order: Number.POSITIVE_INFINITY }),
      folge({ episode_no: 3, series_order: '2' as unknown as number }),
      folge({ episode_no: 60, series_order: 1 }),
    ];
    // Nur die 60 hat einen gueltigen Wert -> vorne; der Rest nach episode_no.
    expect(sortEpisodesByLearningPath(eps).map((e) => e.episode_no)).toEqual([60, 3, 4, 5]);
  });

  it('laesst die Eingabe unveraendert (sortiert eine Kopie)', () => {
    const eps = [folge({ episode_no: 2, series_order: 2 }), folge({ episode_no: 1, series_order: 1 })];
    const kopie = [...eps];
    sortEpisodesByLearningPath(eps);
    expect(eps).toEqual(kopie);
  });

  it('bringt die echten Reihen in die Lernweg-Reihenfolge', () => {
    const sortiert = sortEpisodesByLearningPath(lernwegFolgen());
    expect(sortiert[0].episode_no).toBe(63);
    expect(sortiert.map((e) => e.episode_no)).toEqual([
      63, 64, 65, 66, 67, 68, 34, 35, 36, 37, 1, 2, 3, 16, 17, 48, 49, 57, 58,
    ]);
  });
});

describe('groupEpisodesBySeries nach der neuen Sortierung', () => {
  it('liefert die Reihen in Lernweg-Reihenfolge, madinah 16-17 + 48-49 in EINER Gruppe', () => {
    const gruppen = groupEpisodesBySeries(sortEpisodesByLearningPath(lernwegFolgen()));
    expect(gruppen.map((g) => g.key)).toEqual([
      'lesen',
      'tajwid',
      'grammar',
      'madinah',
      'pruefung',
    ]);
    const madinah = gruppen.find((g) => g.key === 'madinah');
    expect(madinah?.episodes.map((e) => e.episode_no)).toEqual([16, 17, 48, 49]);
  });

  it('ohne series-Feld entsteht genau EINE Default-Gruppe ohne Header', () => {
    const gruppen = groupEpisodesBySeries([folge({ episode_no: 1 }), folge({ episode_no: 2 })]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].title).toBeNull();
    expect(hasMultipleSeries([folge({ episode_no: 1 }), folge({ episode_no: 2 })])).toBe(false);
  });
});

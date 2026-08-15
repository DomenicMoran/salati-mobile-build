// 8-Wind-Himmelsrichtung für ein Bearing — als Locale-Key-Suffix
// (qibla.dir.*), damit "137°" auch als Wort ("Südost") lesbar ist.
const DIRS = ['n', 'no', 'o', 'so', 's', 'sw', 'w', 'nw'] as const;

export function cardinalKey(bearing: number): (typeof DIRS)[number] {
  const idx = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return DIRS[idx];
}

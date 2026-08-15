// Ordnet die von quran.com auf Wort-Ebene gelieferten Tajwid-Regel-Namen
// (siehe parseWordTajweedRules in api.ts) einer kleinen Zahl verständlicher
// "Familien" zu, für die es je eine kurze Ausspracheerklärung gibt (i18n-Key
// quran.wordInfo.rules.<familie>). Live gegen die API verifiziert (Sure
// 2/2026-07-17): dies ist die vollständige auf Wort-Ebene beobachtete Menge
// an Regel-Namen (plus madda_obligatory als Vers-Ebene-Variante, siehe
// TAJWEED_COLORS in api.ts, zur Sicherheit mit aufgenommen).
export const TAJWEED_RULE_FAMILY: Record<string, string> = {
  ghunnah: 'ghunnah',
  idgham_ghunnah: 'idghamGhunnah',
  idgham_shafawi: 'idghamGhunnah',
  idgham_wo_ghunnah: 'idghamNoGhunnah',
  idgham_mutajanisayn: 'idghamNoGhunnah',
  ikhafa: 'ikhafa',
  ikhafa_shafawi: 'ikhafa',
  iqlab: 'iqlab',
  qalaqah: 'qalqalah',
  madda_normal: 'madd',
  madda_permissible: 'madd',
  madda_necessary: 'madd',
  madda_obligatory: 'madd',
  madda_obligatory_monfasel: 'madd',
  madda_obligatory_mottasel: 'madd',
  laam_shamsiyah: 'sunLetter',
  ham_wasl: 'hamzatWasl',
  slnt: 'silentLetter',
};

/** Distinct Regel-"Familien" für ein Wort, in Auftrittsreihenfolge, unbekannte
 * Regel-Namen werden übersprungen statt eine falsche Erklärung zu erfinden. */
export function wordTajweedRuleFamilies(rules: string[] | undefined): string[] {
  if (!rules || rules.length === 0) return [];
  const out: string[] = [];
  for (const r of rules) {
    const family = TAJWEED_RULE_FAMILY[r];
    if (family && !out.includes(family)) out.push(family);
  }
  return out;
}

import policyJson from './release-policy.json';

export interface AudiobookReleasePolicy {
  blockedPflichtwissenLocales: readonly string[];
  blockedGrammarLocales: readonly string[];
}

/** Runtime-Policy; JSON-Arrays bleiben `string[]` auch wenn die Datei leer ist. */
export const releasePolicy: AudiobookReleasePolicy = {
  blockedPflichtwissenLocales: policyJson.blockedPflichtwissenLocales,
  blockedGrammarLocales: policyJson.blockedGrammarLocales,
};

export default releasePolicy;

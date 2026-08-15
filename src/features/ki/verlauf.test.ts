import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearErrorLog, getErrorLog } from '@/lib/errorLog';
import { ladeVerlauf, loescheVerlauf, MAX_NACHRICHTEN, merkeFeedback, speichereVerlauf } from './verlauf';

describe('KI-Verlauf', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearErrorLog();
  });

  it('gibt ohne gespeicherten Verlauf eine leere Liste zurück', async () => {
    expect(await ladeVerlauf()).toEqual([]);
  });

  it('speichert und lädt Nachrichten samt Quellen-IDs', async () => {
    await speichereVerlauf([
      { role: 'du', text: 'Was ist Ischa?' },
      { role: 'ki', text: 'Ischa ist …', quellen: ['w-gebet-ischa'] },
    ]);
    const geladen = await ladeVerlauf();
    expect(geladen).toHaveLength(2);
    expect(geladen[1]!.quellen).toEqual(['w-gebet-ischa']);
  });

  it('behält höchstens MAX_NACHRICHTEN Einträge — die jüngsten', async () => {
    const viele = Array.from({ length: MAX_NACHRICHTEN + 10 }, (_, i) => ({
      role: 'du' as const,
      text: `Frage ${i}`,
    }));
    await speichereVerlauf(viele);
    const geladen = await ladeVerlauf();
    expect(geladen).toHaveLength(MAX_NACHRICHTEN);
    expect(geladen[geladen.length - 1]!.text).toBe(`Frage ${MAX_NACHRICHTEN + 9}`);
  });

  it('wirft kaputte Einträge weg, statt den Verlauf unbrauchbar zu machen', async () => {
    await AsyncStorage.setItem(
      'salatibox:ki-verlauf',
      JSON.stringify([{ role: 'ki', text: 'ok' }, { text: 'ohne rolle' }, null, 'quatsch']),
    );
    expect(await ladeVerlauf()).toEqual([{ role: 'ki', text: 'ok' }]);
  });

  it('löscht den Verlauf', async () => {
    await speichereVerlauf([{ role: 'du', text: 'x' }]);
    await loescheVerlauf();
    expect(await ladeVerlauf()).toEqual([]);
  });
});

describe('KI-Feedback', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearErrorLog();
  });

  it('legt Feedback nur lokal im Fehler-Log ab (Export über die bestehende Funktion)', async () => {
    await merkeFeedback('Was ist Ischa?', 'schlecht', ['Salati-Wissen: Ischa']);
    const log = await getErrorLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.context).toBe('ki-feedback');
    expect(log[0]!.message).toContain('nicht hilfreich');
    expect(log[0]!.message).toContain('Was ist Ischa?');
  });
});

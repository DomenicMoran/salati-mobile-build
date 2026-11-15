import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultMosqueAdminDraft } from './schema';
import { loadMosqueAdminDraft, saveMosqueAdminDraft } from './mosqueAdminDraftStore';

describe('mosqueAdminDraftStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists draft per tv id', async () => {
    const draft = { ...defaultMosqueAdminDraft(), profile: { ...defaultMosqueAdminDraft().profile, name: 'X' } };
    await saveMosqueAdminDraft('192.168.1.5', draft);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(draft));
    const loaded = await loadMosqueAdminDraft('192.168.1.5');
    expect(loaded?.profile.name).toBe('X');
  });
});
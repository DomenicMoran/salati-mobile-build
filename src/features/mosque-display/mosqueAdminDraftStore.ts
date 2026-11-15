import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultMosqueAdminDraft, type MosqueAdminDraft } from './schema';

const KEY_PREFIX = 'salati-mosque-admin-draft-v1';

function storageKey(tvId: string | null): string {
  const id = (tvId ?? 'local').replace(/[^\w.-]/g, '_').slice(0, 64);
  return `${KEY_PREFIX}:${id}`;
}

export async function loadMosqueAdminDraft(tvId: string | null): Promise<MosqueAdminDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(tvId));
    if (!raw) return null;
    const p = JSON.parse(raw) as MosqueAdminDraft;
    return { ...defaultMosqueAdminDraft(), ...p, profile: { ...defaultMosqueAdminDraft().profile, ...p.profile } };
  } catch {
    return null;
  }
}

export async function saveMosqueAdminDraft(tvId: string | null, draft: MosqueAdminDraft): Promise<void> {
  await AsyncStorage.setItem(storageKey(tvId), JSON.stringify(draft));
}
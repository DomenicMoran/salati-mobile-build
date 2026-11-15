import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { AppSettings } from '@/features/settings/types';

import type { MosqueAdminDraft } from './schema';

export type MosqueBackupFile = {
  v: 1;
  savedAt: string;
  draft: MosqueAdminDraft;
  flags: { mosqueDisplayEnabled: boolean; khutbaLiveEnabled: boolean };
};

export function buildMosqueBackup(draft: MosqueAdminDraft, settings: AppSettings): MosqueBackupFile {
  const { pinHash: _omit, ...draftSansPin } = draft;
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    draft: { ...draftSansPin, pinHash: null },
    flags: {
      mosqueDisplayEnabled: settings.mosqueDisplayEnabled === true,
      khutbaLiveEnabled: settings.khutbaLiveEnabled === true,
    },
  };
}

export async function shareMosqueBackup(draft: MosqueAdminDraft, settings: AppSettings): Promise<void> {
  const json = JSON.stringify(buildMosqueBackup(draft, settings), null, 2);
  const path = `${FileSystem.cacheDirectory}salati-mosque-backup.json`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  const can = await Sharing.isAvailableAsync();
  if (!can) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Moschee-Konfiguration',
    UTI: 'public.json',
  });
}

export async function pickMosqueBackup(): Promise<MosqueBackupFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  const raw = await FileSystem.readAsStringAsync(res.assets[0].uri);
  const p = JSON.parse(raw) as MosqueBackupFile;
  if (!p || p.v !== 1 || !p.draft) throw new Error('invalid_backup');
  return p;
}

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTranslation } from '@/lib/i18n';
import {
  defaultMosqueAdminDraft,
  mosqueConfigMessage,
  type LayoutTemplate,
  type DisplayRole,
} from '@/features/mosque-display/schema';
import { mosqueFlagsFromSettings } from '@/features/mosque-display/flags';
import { pickMosqueBackup, shareMosqueBackup } from '@/features/mosque-display/mosqueBackup';
import { hashAdminPin } from '@/features/mosque-display/pin';
import { useSettings } from '@/features/settings/store';
import { useTvConnection } from '@/features/tv/pairing-client';

const LAYOUTS: LayoutTemplate[] = ['classic', 'compact', 'tickerFocus'];
const ROLES: DisplayRole[] = ['main', 'women', 'entrance', 'custom'];

export default function MosqueAdminScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const flags = mosqueFlagsFromSettings(settings);
  const { status, sendMosqueConfig, sendDisplayRole, sendAdminUnlock } = useTvConnection();
  const [draft, setDraft] = useState(() => ({
    ...defaultMosqueAdminDraft(),
    profile: { ...defaultMosqueAdminDraft().profile, name: settings.location.label },
    iqamaOffsets: { ...settings.iqamaOffsets },
  }));
  const [pinInput, setPinInput] = useState('');
  const [pinUnlock, setPinUnlock] = useState('');
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(), []);

  if (!flags.mosqueDisplayEnabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t('mosqueAdmin.title')} variant="modal" onBack={() => router.back()} />
        <ThemedView style={styles.box}>
          <ThemedText type="subtitle">{t('mosqueAdmin.gatedTitle')}</ThemedText>
          <ThemedText>{t('mosqueAdmin.gatedBody')}</ThemedText>
          <Pressable
            style={styles.btn}
            onPress={() => update({ mosqueDisplayEnabled: true, khutbaLiveEnabled: false })}>
            <ThemedText type="smallBold">{t('mosqueAdmin.enableExperimental')}</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const pushToTv = () => {
    if (status !== 'connected') return;
    sendMosqueConfig(mosqueConfigMessage(draft).patch);
    sendDisplayRole(draft.role, draft.customRoleLabel);
  };

  const savePin = async () => {
    if (!pinInput.trim()) {
      setDraft((d) => ({ ...d, pinHash: null }));
      return;
    }
    try {
      const pinHash = await hashAdminPin(pinInput);
      setDraft((d) => ({ ...d, pinHash }));
      setPinInput('');
    } catch {
      setBackupMsg(t('mosqueAdmin.pinInvalid'));
    }
  };

  const unlockTv = () => {
    if (status !== 'connected' || !pinUnlock.trim()) return;
    sendAdminUnlock(pinUnlock.trim());
    setPinUnlock('');
  };

  const exportBackup = async () => {
    try {
      await shareMosqueBackup(draft, settings);
      setBackupMsg(t('mosqueAdmin.backupExported'));
    } catch {
      setBackupMsg(t('mosqueAdmin.backupFailed'));
    }
  };

  const importBackup = async () => {
    try {
      const file = await pickMosqueBackup();
      if (!file) return;
      setDraft(file.draft);
      await update({
        mosqueDisplayEnabled: file.flags.mosqueDisplayEnabled,
        khutbaLiveEnabled: file.flags.khutbaLiveEnabled,
      });
      setBackupMsg(t('mosqueAdmin.backupImported'));
    } catch {
      setBackupMsg(t('mosqueAdmin.backupFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={t('mosqueAdmin.title')} variant="modal" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText style={styles.hint}>{t('mosqueAdmin.hint')}</ThemedText>
        <ThemedText style={styles.privacy}>{t('mosqueAdmin.privacy')}</ThemedText>

        <ThemedText type="subtitle">{t('mosqueAdmin.profile')}</ThemedText>
        <TextInput
          style={styles.input}
          value={draft.profile.name}
          onChangeText={(name) => setDraft((d) => ({ ...d, profile: { ...d.profile, name } }))}
          placeholder={t('mosqueAdmin.namePh')}
        />
        <TextInput
          style={styles.input}
          value={draft.profile.address}
          onChangeText={(address) => setDraft((d) => ({ ...d, profile: { ...d.profile, address } }))}
          placeholder={t('mosqueAdmin.addressPh')}
        />
        <TextInput
          style={styles.input}
          value={draft.tickerText}
          onChangeText={(tickerText) => setDraft((d) => ({ ...d, tickerText }))}
          placeholder={t('mosqueAdmin.tickerPh')}
        />

        <ThemedText type="subtitle">{t('mosqueAdmin.layout')}</ThemedText>
        <View style={styles.row}>
          {LAYOUTS.map((layout) => (
            <Pressable
              key={layout}
              style={[styles.chip, draft.layout === layout && styles.chipOn]}
              onPress={() => setDraft((d) => ({ ...d, layout }))}>
              <ThemedText type="smallBold">{t(`mosqueAdmin.layout_${layout}`)}</ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="subtitle">{t('mosqueAdmin.role')}</ThemedText>
        <View style={styles.row}>
          {ROLES.map((role) => (
            <Pressable
              key={role}
              style={[styles.chip, draft.role === role && styles.chipOn]}
              onPress={() => setDraft((d) => ({ ...d, role }))}>
              <ThemedText type="smallBold">{t(`mosqueAdmin.role_${role}`)}</ThemedText>
            </Pressable>
          ))}
        </View>
        {draft.role === 'custom' ? (
          <TextInput
            style={styles.input}
            value={draft.customRoleLabel}
            onChangeText={(customRoleLabel) => setDraft((d) => ({ ...d, customRoleLabel }))}
            placeholder={t('mosqueAdmin.customRolePh')}
          />
        ) : null}

        <ThemedText type="subtitle">{t('mosqueAdmin.tickerLocales')}</ThemedText>
        <TextInput
          style={styles.input}
          value={draft.tickerLocalesCsv}
          onChangeText={(tickerLocalesCsv) => setDraft((d) => ({ ...d, tickerLocalesCsv }))}
          placeholder="de,en,ar"
        />
        <TextInput
          style={styles.input}
          value={draft.tickerDe}
          onChangeText={(tickerDe) => setDraft((d) => ({ ...d, tickerDe }))}
          placeholder={t('mosqueAdmin.tickerDe')}
        />
        <TextInput
          style={styles.input}
          value={draft.tickerEn}
          onChangeText={(tickerEn) => setDraft((d) => ({ ...d, tickerEn }))}
          placeholder={t('mosqueAdmin.tickerEn')}
        />

        <ThemedText type="subtitle">{t('mosqueAdmin.schedules')}</ThemedText>
        <View style={styles.switchRow}>
          <ThemedText>{t('mosqueAdmin.quietSalah')}</ThemedText>
          <Switch
            value={draft.schedules.quietDuringSalah}
            onValueChange={(quietDuringSalah) =>
              setDraft((d) => ({ ...d, schedules: { ...d.schedules, quietDuringSalah } }))
            }
          />
        </View>
        <View style={styles.switchRow}>
          <ThemedText>{t('mosqueAdmin.quietKhutba')}</ThemedText>
          <Switch
            value={draft.schedules.quietDuringKhutba}
            onValueChange={(quietDuringKhutba) =>
              setDraft((d) => ({ ...d, schedules: { ...d.schedules, quietDuringKhutba } }))
            }
          />
        </View>

        <ThemedText type="subtitle">{t('mosqueAdmin.seasonal')}</ThemedText>
        <TextInput
          style={styles.input}
          value={draft.eidTimesCsv}
          onChangeText={(eidTimesCsv) => setDraft((d) => ({ ...d, eidTimesCsv }))}
          placeholder={t('mosqueAdmin.eidPh')}
        />
        <TextInput
          style={styles.input}
          value={draft.taraweehSlotsCsv}
          onChangeText={(taraweehSlotsCsv) => setDraft((d) => ({ ...d, taraweehSlotsCsv }))}
          placeholder={t('mosqueAdmin.taraweehPh')}
        />
        <View style={styles.switchRow}>
          <ThemedText>{t('mosqueAdmin.ramadanIftar')}</ThemedText>
          <Switch
            value={draft.ramadan.iftar}
            onValueChange={(iftar) => setDraft((d) => ({ ...d, ramadan: { ...d.ramadan, iftar } }))}
          />
        </View>
        <View style={styles.switchRow}>
          <ThemedText>{t('mosqueAdmin.adhkarAfterIqama')}</ThemedText>
          <Switch
            value={draft.adhkarAfterIqama}
            onValueChange={(adhkarAfterIqama) => setDraft((d) => ({ ...d, adhkarAfterIqama }))}
          />
        </View>

        <ThemedText type="subtitle">{t('mosqueAdmin.jumuah')}</ThemedText>
        <TextInput
          style={styles.input}
          value={draft.jumuahSlots[0]?.time ?? '13:00'}
          onChangeText={(time) =>
            setDraft((d) => ({ ...d, jumuahSlots: [{ ...d.jumuahSlots[0], time }] }))
          }
          placeholder="13:00"
        />

        <ThemedText type="subtitle">{t('mosqueAdmin.pin')}</ThemedText>
        <TextInput
          style={styles.input}
          value={pinInput}
          onChangeText={setPinInput}
          placeholder={t('mosqueAdmin.pinPh')}
          secureTextEntry
          keyboardType="number-pad"
        />
        <Pressable style={styles.btnSecondary} onPress={() => void savePin()}>
          <ThemedText type="smallBold">{t('mosqueAdmin.pinSave')}</ThemedText>
        </Pressable>
        <TextInput
          style={styles.input}
          value={pinUnlock}
          onChangeText={setPinUnlock}
          placeholder={t('mosqueAdmin.pinUnlockPh')}
          secureTextEntry
          keyboardType="number-pad"
        />
        <Pressable style={styles.btnSecondary} onPress={unlockTv}>
          <ThemedText type="smallBold">{t('mosqueAdmin.pinUnlockTv')}</ThemedText>
        </Pressable>

        <ThemedText type="subtitle">{t('mosqueAdmin.backup')}</ThemedText>
        <View style={styles.row}>
          <Pressable style={styles.btnSecondary} onPress={() => void exportBackup()}>
            <ThemedText type="smallBold">{t('mosqueAdmin.backupExport')}</ThemedText>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => void importBackup()}>
            <ThemedText type="smallBold">{t('mosqueAdmin.backupImport')}</ThemedText>
          </Pressable>
        </View>
        {backupMsg ? <ThemedText style={styles.msg}>{backupMsg}</ThemedText> : null}

        <Pressable style={[styles.btn, status !== 'connected' && styles.btnDisabled]} onPress={pushToTv}>
          <ThemedText type="smallBold">
            {status === 'connected' ? t('mosqueAdmin.push') : t('mosqueAdmin.needTv')}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => router.push('/khutba-live' as never)}>
          <ThemedText type="link">{t('mosqueAdmin.openKhutba')}</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: { padding: 16, gap: 10, paddingBottom: 40 },
    box: { flex: 1, padding: 16, gap: 12, justifyContent: 'center' },
    hint: { opacity: 0.8, marginBottom: 4 },
    privacy: { fontSize: 12, opacity: 0.75, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: '#555',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: '#fff',
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { padding: 10, borderRadius: 10, backgroundColor: '#2a2a2a' },
    chipOn: { borderWidth: 1, borderColor: '#c9a227' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    btn: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: '#c9a227',
      alignItems: 'center',
    },
    btnSecondary: { padding: 12, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' },
    btnDisabled: { opacity: 0.5 },
    linkBtn: { marginTop: 8, alignItems: 'center' },
    msg: { fontSize: 13, opacity: 0.9 },
    jsonHint: { fontSize: 10, opacity: 0.4, marginTop: 16 },
  });
}

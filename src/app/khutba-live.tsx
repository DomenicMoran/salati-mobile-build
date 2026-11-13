import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { router } from 'expo-router';
import { startWhisperRecording, whisperSupported } from '@/features/hifz/whisperCheck';
import { istWhisperModellHeruntergeladen } from '@/features/hifz/whisperModel';
import { mosqueFlagsFromSettings } from '@/features/mosque-display/flags';
import {
  captionShareUrl,
  isCaptionShareRunning,
  resolveShareHost,
  setCaptionShareState,
  startCaptionShareServer,
  stopCaptionShareServer,
} from '@/features/mosque-display/captionShareServer';
import {
  appendKhutbaLine,
  endKhutbaSession,
  listKhutbaSessions,
  searchSessions,
  sessionExportText,
  startKhutbaSession,
  type KhutbaSession,
} from '@/features/mosque-display/khutbaSession';
import { useSettings } from '@/features/settings/store';
import { useTvConnection } from '@/features/tv/pairing-client';
import { useTranslation } from '@/lib/i18n';

export default function KhutbaLiveScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const flags = mosqueFlagsFromSettings(settings);
  const { status, sendKhutbaCaption } = useTvConnection();
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<KhutbaSession[]>([]);
  const [search, setSearch] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareOn, setShareOn] = useState(false);
  const [whisperOn, setWhisperOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [whisperReady, setWhisperReady] = useState(false);
  const recorderRef = useRef<Awaited<ReturnType<typeof startWhisperRecording>> | null>(null);
  const styles = useMemo(() => makeStyles(), []);

  const refreshSessions = useCallback(() => {
    void listKhutbaSessions().then(setSessions);
  }, []);

  useEffect(() => {
    refreshSessions();
    void istWhisperModellHeruntergeladen().then(setWhisperReady);
  }, [refreshSessions]);

  useEffect(() => {
    return () => {
      stopCaptionShareServer();
    };
  }, []);

  useEffect(() => {
    setCaptionShareState(text, t('khutbaLive.title'), t('khutbaLive.disclaimer'));
  }, [text, t]);

  const relayLine = useCallback(
    async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      setText(trimmed);
      if (status === 'connected') sendKhutbaCaption(trimmed);
      let sid = sessionId;
      if (!sid) {
        const s = await startKhutbaSession();
        sid = s.id;
        setSessionId(sid);
      }
      await appendKhutbaLine(sid, trimmed);
      refreshSessions();
    },
    [sessionId, refreshSessions, sendKhutbaCaption, status],
  );

  const relay = () => {
    void relayLine(text);
  };

  const toggleShare = async () => {
    if (shareOn) {
      stopCaptionShareServer();
      setShareOn(false);
      setShareUrl(null);
      return;
    }
    try {
      await startCaptionShareServer();
      const host = await resolveShareHost();
      if (!host) throw new Error('no_host');
      setShareUrl(captionShareUrl(host));
      setShareOn(true);
    } catch {
      setShareOn(false);
      setShareUrl(null);
    }
  };

  const startMic = async () => {
    if (!whisperSupported() || !whisperReady) return;
    setRecording(true);
    try {
      const rec = await startWhisperRecording();
      recorderRef.current = rec;
    } catch {
      setRecording(false);
    }
  };

  const stopMic = async () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (!rec) return;
    const lines = await rec.stop().catch(() => [] as string[]);
    const joined = lines.join(' ').trim();
    if (joined) await relayLine(joined);
  };

  const endSession = async () => {
    if (sessionId) await endKhutbaSession(sessionId);
    setSessionId(null);
    refreshSessions();
  };

  const exportSession = async (s: KhutbaSession) => {
    const body = sessionExportText(s);
    const path = `${FileSystem.cacheDirectory}khutba-${s.id}.txt`;
    await FileSystem.writeAsStringAsync(path, body, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: t('khutbaLive.exportSession') });
    }
  };

  const filtered = useMemo(() => searchSessions(sessions, search), [sessions, search]);

  if (!flags.khutbaLiveEnabled) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title={t('khutbaLive.title')} variant="modal" onBack={() => router.back()} />
        <View style={styles.box}>
          <ThemedText type="subtitle">{t('khutbaLive.gatedTitle')}</ThemedText>
          <ThemedText>{t('khutbaLive.gatedBody')}</ThemedText>
          <Pressable
            style={styles.btnSecondary}
            onPress={() => update({ khutbaLiveEnabled: true })}
            accessibilityRole="button">
            <ThemedText type="smallBold">{t('khutbaLive.enableExperimental')}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={t('khutbaLive.title')} variant="modal" onBack={() => router.back()} />
      <View style={styles.box}>
        <ThemedText style={styles.disclaimer}>{t('khutbaLive.disclaimer')}</ThemedText>

        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          placeholder={t('khutbaLive.placeholder')}
        />
        <Pressable style={[styles.btn, status !== 'connected' && styles.btnDisabled]} onPress={relay}>
          <ThemedText type="smallBold">
            {status === 'connected' ? t('khutbaLive.send') : t('khutbaLive.needTv')}
          </ThemedText>
        </Pressable>

        <Pressable style={[styles.btnSecondary, shareOn && styles.btnOn]} onPress={() => void toggleShare()}>
          <ThemedText type="smallBold">
            {shareOn ? t('khutbaLive.shareStop') : t('khutbaLive.shareStart')}
          </ThemedText>
        </Pressable>
        {shareUrl ? (
          <View style={styles.qrBlock}>
            <QRCode value={shareUrl} size={160} />
            <ThemedText style={styles.shareUrl} selectable>
              {t('khutbaLive.shareUrl').replace('{url}', shareUrl)}
            </ThemedText>
            <ThemedText style={styles.shareSteps}>{t('khutbaLive.shareSteps')}</ThemedText>
          </View>
        ) : null}
        {shareOn && !shareUrl ? <ThemedText>{t('khutbaLive.shareNoLan')}</ThemedText> : null}

        {whisperSupported() && whisperReady ? (
          <View style={styles.whisperRow}>
            <Pressable style={styles.chip} onPress={() => setWhisperOn((v) => !v)}>
              <ThemedText type="smallBold">
                {whisperOn ? t('khutbaLive.whisperOn') : t('khutbaLive.whisperOff')}
              </ThemedText>
            </Pressable>
            {whisperOn ? (
              recording ? (
                <Pressable style={styles.btnDanger} onPress={() => void stopMic()}>
                  <ThemedText type="smallBold">{t('khutbaLive.whisperStop')}</ThemedText>
                </Pressable>
              ) : (
                <Pressable style={styles.btnSecondary} onPress={() => void startMic()}>
                  <ThemedText type="smallBold">{t('khutbaLive.whisperRecord')}</ThemedText>
                </Pressable>
              )
            ) : null}
            {recording ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
          </View>
        ) : (
          <ThemedText style={styles.whisperHook}>{t('khutbaLive.whisperNeedModel')}</ThemedText>
        )}

        <Pressable style={styles.linkBtn} onPress={() => void endSession()} disabled={!sessionId}>
          <ThemedText type="link">{t('khutbaLive.endSession')}</ThemedText>
        </Pressable>

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('khutbaLive.searchSessions')}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.sessionRow}>
              <ThemedText>{new Date(item.startedAt).toLocaleString()}</ThemedText>
              <ThemedText numberOfLines={2}>{item.lines.at(-1)?.text ?? '—'}</ThemedText>
              <Pressable onPress={() => void exportSession(item)}>
                <ThemedText type="link">{t('khutbaLive.exportSession')}</ThemedText>
              </Pressable>
            </View>
          )}
        />
        {isCaptionShareRunning() ? null : null}
      </View>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    safe: { flex: 1 },
    box: { flex: 1, padding: 16, gap: 10 },
    disclaimer: { fontSize: 13, opacity: 0.85 },
    input: {
      minHeight: 100,
      borderWidth: 1,
      borderColor: '#555',
      borderRadius: 12,
      padding: 12,
      color: '#fff',
      textAlignVertical: 'top',
    },
    search: {
      borderWidth: 1,
      borderColor: '#444',
      borderRadius: 10,
      padding: 10,
      color: '#fff',
    },
    btn: { padding: 14, borderRadius: 12, backgroundColor: '#c9a227', alignItems: 'center' },
    btnSecondary: { padding: 12, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' },
    btnDanger: { padding: 12, borderRadius: 12, backgroundColor: '#8b2e2e', alignItems: 'center' },
    btnOn: { borderWidth: 1, borderColor: '#c9a227' },
    btnDisabled: { opacity: 0.5 },
    whisperRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    chip: { padding: 10, borderRadius: 10, backgroundColor: '#2a2a2a' },
    whisperHook: { fontSize: 12, opacity: 0.7 },
    qrBlock: { alignItems: 'center', gap: 8, marginVertical: 8 },
    shareUrl: { fontSize: 12, fontFamily: 'monospace' },
    shareSteps: { fontSize: 12, opacity: 0.8, textAlign: 'center' },
    linkBtn: { alignItems: 'center' },
    list: { maxHeight: 220 },
    sessionRow: { gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#333' },
  });
}

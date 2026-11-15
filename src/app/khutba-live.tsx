import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { router } from 'expo-router';
import { istWhisperModellHeruntergeladen } from '@/features/hifz/whisperModel';
import { whisperSupported } from '@/features/hifz/whisperCheck';
import {
  khutbaRecognizerSupported,
  startKhutbaStreamingRecognizer,
  type KhutbaSourceLang,
  type KhutbaStreamHandle,
} from '@/features/mosque-display/khutbaRecognizer';
import {
  ensureTranslateModels,
  estimateModelBytes,
  khutbaTranslateSupported,
  translateKhutbaLine,
  type KhutbaTranslateLang,
} from '@/features/mosque-display/khutbaTranslate';
import { mosqueFlagsFromSettings } from '@/features/mosque-display/flags';
import {
  captionShareUrl,
  isCaptionShareRunning,
  resolveShareHost,
  setCaptionShareState,
  startCaptionShareServer,
  stopCaptionShareServer,
} from '@/features/mosque-display/captionShareServer';
import { startKhutbaMicForeground, stopKhutbaMicForeground } from '@/features/mosque-display/khutbaForeground';
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
import { useTheme } from '@/hooks/use-theme';
import { NEARBY_PEER_REASON_DE } from '@/features/mosque-display/nearbyPeerGrenze';

export default function KhutbaLiveScreen() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const flags = mosqueFlagsFromSettings(settings);
  const {
    status,
    sendKhutbaCaption,
    sendKhutbaSchedule,
    sendKhutbaPreload,
    sendKhutbaSlide,
    sendKhutbaControl,
    sendKhutbaClear,
    sendCaptionStyle,
    sendCaptionLang,
  } = useTvConnection();
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<KhutbaSession[]>([]);
  const [search, setSearch] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareOn, setShareOn] = useState(false);
  const [streamOn, setStreamOn] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [whisperReady, setWhisperReady] = useState(false);
  const [sourceLang, setSourceLang] = useState<KhutbaSourceLang>('ar');
  const [targetLang, setTargetLang] = useState<KhutbaTranslateLang>('de');
  const [fontScale, setFontScale] = useState<0.75 | 1 | 1.25 | 1.5>(1);
  const [modelsReady, setModelsReady] = useState(false);
  const [preText, setPreText] = useState('');
  const [slidesCsv, setSlidesCsv] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const streamRef = useRef<KhutbaStreamHandle | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const canSend = text.trim().length > 0;

  const refreshSessions = useCallback(() => {
    void listKhutbaSessions().then(setSessions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshSessions();
    void istWhisperModellHeruntergeladen().then(setWhisperReady);
    if (khutbaTranslateSupported() && sourceLang !== targetLang) {
      void ensureTranslateModels(sourceLang as KhutbaTranslateLang, targetLang)
        .then(() => {
          if (!cancelled) setModelsReady(true);
        })
        .catch(() => {
          if (!cancelled) setModelsReady(false);
        });
    } else {
      void Promise.resolve().then(() => {
        if (!cancelled) setModelsReady(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [refreshSessions, sourceLang, targetLang]);

  useEffect(() => {
    return () => {
      void streamRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCaptionShareServer();
    };
  }, []);

  useEffect(() => {
    setCaptionShareState(text, t('khutbaLive.title'), t('khutbaLive.disclaimer'), {
      de: targetLang === 'de' ? text : undefined,
      en: targetLang === 'en' ? text : undefined,
      tr: targetLang === 'tr' ? text : undefined,
      ar: targetLang === 'ar' ? text : undefined,
    });
  }, [text, t, targetLang]);

  const relayLine = useCallback(
    async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const original = trimmed;
      let translation = '';
      const translateSource: KhutbaTranslateLang =
        sourceLang === 'auto' ? 'ar' : (sourceLang as KhutbaTranslateLang);
      if (khutbaTranslateSupported() && translateSource !== targetLang && modelsReady) {
        try {
          translation = await translateKhutbaLine(trimmed, translateSource, targetLang);
        } catch {
          translation = '';
        }
      }
      const display = translation ? `${original}\n${translation}` : original;
      setText(display);
      if (status === 'connected') sendKhutbaCaption(display, original, translation);
      let sid = sessionId;
      if (!sid) {
        const s = await startKhutbaSession();
        sid = s.id;
        setSessionId(sid);
      }
      await appendKhutbaLine(sid, display);
      refreshSessions();
    },
    [sessionId, refreshSessions, sendKhutbaCaption, status, sourceLang, targetLang, modelsReady],
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
    if (!khutbaRecognizerSupported() || !whisperReady) return;
    setStreaming(true);
    startKhutbaMicForeground();
    if (status === 'connected') sendKhutbaControl('start');
    try {
      const rec = await startKhutbaStreamingRecognizer({
        language: sourceLang,
        onLine: (line) => relayLine(line),
      });
      streamRef.current = rec;
      setStreamOn(true);
    } catch {
      setStreaming(false);
    }
  };

  const stopMic = async () => {
    const rec = streamRef.current;
    streamRef.current = null;
    setStreamOn(false);
    setStreaming(false);
    if (status === 'connected') {
      sendKhutbaControl('stop');
      sendKhutbaClear();
    }
    stopKhutbaMicForeground();
    if (!rec) return;
    await rec.stop().catch(() => undefined);
  };

  const pauseMic = () => {
    streamRef.current?.pause();
    if (status === 'connected') sendKhutbaControl('pause');
  };

  const applyCaptionStyle = () => {
    if (status !== 'connected') return;
    sendCaptionStyle({ fontScale, lines: 2, showOriginal: true, position: 'bottom' });
    sendCaptionLang([targetLang]);
  };

  const pushSchedule = () => {
    if (status !== 'connected' || !scheduledAt.trim()) return;
    const slides = slidesCsv
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    sendKhutbaSchedule(new Date(scheduledAt).toISOString(), preText.trim(), slides);
  };

  const pushPreload = () => {
    if (status !== 'connected') return;
    const slides = slidesCsv
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    sendKhutbaPreload(preText.trim(), slides);
  };

  const endSession = async () => {
    if (status === 'connected') {
      sendKhutbaClear();
      sendKhutbaControl('stop');
    }
    await stopMic();
    setText('');
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
        <Pressable style={[styles.btn, !canSend && styles.btnDisabled]} onPress={relay} disabled={!canSend}>
          <ThemedText type="smallBold">
            {status === 'connected' ? t('khutbaLive.sendTvAndLocal') : t('khutbaLive.sendLocal')}
          </ThemedText>
        </Pressable>
        {status !== 'connected' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('khutbaLive.needTv')}
          </ThemedText>
        ) : null}

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
            <ThemedText style={styles.shareSteps}>{NEARBY_PEER_REASON_DE}</ThemedText>
          </View>
        ) : null}
        {shareOn && !shareUrl ? <ThemedText>{t('khutbaLive.shareNoLan')}</ThemedText> : null}

        <View style={styles.whisperRow}>
          {(['ar', 'de', 'tr', 'en', 'auto'] as KhutbaSourceLang[]).map((code) => (
            <Pressable
              key={code}
              style={[styles.chip, sourceLang === code && styles.btnOn]}
              onPress={() => setSourceLang(code)}>
              <ThemedText type="smallBold">{code}</ThemedText>
            </Pressable>
          ))}
        </View>
        <View style={styles.whisperRow}>
          {(['de', 'en', 'tr', 'ar'] as KhutbaTranslateLang[]).map((code) => (
            <Pressable
              key={code}
              style={[styles.chip, targetLang === code && styles.btnOn]}
              onPress={() => setTargetLang(code)}>
              <ThemedText type="smallBold">{code}</ThemedText>
            </Pressable>
          ))}
          {khutbaTranslateSupported() ? (
            <ThemedText style={styles.whisperHook}>
              ~{Math.round(estimateModelBytes(sourceLang as KhutbaTranslateLang, targetLang) / (1024 * 1024))} MB
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.whisperRow}>
          {([0.75, 1, 1.25, 1.5] as const).map((scale) => (
            <Pressable key={scale} style={[styles.chip, fontScale === scale && styles.btnOn]} onPress={() => setFontScale(scale)}>
              <ThemedText type="smallBold">{scale}x</ThemedText>
            </Pressable>
          ))}
          <Pressable style={styles.chip} onPress={applyCaptionStyle}>
            <ThemedText type="smallBold">TV style</ThemedText>
          </Pressable>
        </View>
        {whisperSupported() && whisperReady ? (
          <View style={styles.whisperRow}>
            {streamOn ? (
              <>
                <Pressable style={styles.btnDanger} onPress={() => void stopMic()}>
                  <ThemedText type="smallBold">{t('khutbaLive.whisperStop')}</ThemedText>
                </Pressable>
                <Pressable style={styles.btnSecondary} onPress={pauseMic}>
                  <ThemedText type="smallBold">Pause</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.btnSecondary} onPress={() => void startMic()}>
                <ThemedText type="smallBold">{t('khutbaLive.whisperRecord')}</ThemedText>
              </Pressable>
            )}
            {streaming ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
          </View>
        ) : (
          <ThemedText style={styles.whisperHook}>{t('khutbaLive.whisperNeedModel')}</ThemedText>
        )}
        <TextInput
          style={styles.search}
          value={scheduledAt}
          onChangeText={setScheduledAt}
          placeholder="Schedule ISO / 2026-11-14T13:00:00"
        />
        <TextInput style={styles.input} multiline value={preText} onChangeText={setPreText} placeholder="Khutba pre-text" />
        <TextInput style={styles.input} multiline value={slidesCsv} onChangeText={setSlidesCsv} placeholder="Slides (one per line)" />
        <View style={styles.whisperRow}>
          <Pressable style={styles.btnSecondary} onPress={pushPreload}>
            <ThemedText type="smallBold">Preload TV</ThemedText>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={pushSchedule}>
            <ThemedText type="smallBold">Schedule</ThemedText>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => status === 'connected' && sendKhutbaSlide(1)}>
            <ThemedText type="smallBold">Slide +</ThemedText>
          </Pressable>
        </View>

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

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    box: { flex: 1, padding: 16, gap: 10 },
    disclaimer: { fontSize: 13, opacity: 0.85 },
    input: {
      minHeight: 100,
      borderWidth: 1,
      borderColor: theme.separator,
      borderRadius: 12,
      padding: 12,
      color: theme.text,
      backgroundColor: theme.groupedCard,
      textAlignVertical: 'top',
    },
    search: {
      borderWidth: 1,
      borderColor: theme.separator,
      borderRadius: 10,
      padding: 10,
      color: theme.text,
      backgroundColor: theme.groupedCard,
    },
    btn: { padding: 14, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center' },
    btnSecondary: { padding: 12, borderRadius: 12, backgroundColor: theme.backgroundElement, alignItems: 'center' },
    btnDanger: { padding: 12, borderRadius: 12, backgroundColor: '#8b2e2e', alignItems: 'center' },
    btnOn: { borderWidth: 1, borderColor: theme.accent },
    btnDisabled: { opacity: 0.45 },
    whisperRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    chip: { padding: 10, borderRadius: 10, backgroundColor: theme.backgroundElement },
    whisperHook: { fontSize: 12, opacity: 0.7 },
    qrBlock: { alignItems: 'center', gap: 8, marginVertical: 8 },
    shareUrl: { fontSize: 12, fontFamily: 'monospace' },
    shareSteps: { fontSize: 12, opacity: 0.8, textAlign: 'center' },
    linkBtn: { alignItems: 'center' },
    list: { maxHeight: 220 },
    sessionRow: { gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.separator },
  });
}

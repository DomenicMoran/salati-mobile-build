import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MODELL_GROESSE_BYTES,
  aktuelleModellGroesse,
  clearAppCache,
  deleteKiModel,
  deleteWhisperModel,
  formatBytes,
  getStorageOverview,
  type StorageOverview,
} from '@/features/settings/storage';
import { whisperDownloadLaeuft, whisperModellHerunterladen } from '@/features/hifz/whisperModel';
import { deleteAllPodcastDownloads, deleteEpisodeDownload } from '@/features/podcast/downloads';
import { deleteAllVideoDownloads, deleteVideoDownload } from '@/features/video/downloads';
import { deleteFullMushafAudio } from '@/features/quran/offline-audio';
import { editionDisplayName } from '@/features/quran/EditionPicker';
import { useAudioEditions } from '@/features/quran/hooks';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

// Zentrale Speicherverwaltung: Übersicht über alle lokalen Speicherverbraucher
// (Rezitator-Audio, KI-Modelle, Cache) mit gezielten Lösch-Aktionen. Bewusst
// eine eigene Sub-Seite statt Teil von settings.tsx (das ist mit >1400 Zeilen
// bereits sehr groß) - erreichbar über einen neuen Eintrag dort. Lösch-Logik
// für Rezitator-Audio/Modelle liegt weiterhin in offline-audio.ts/model.ts/
// whisperModel.ts, hier nur Größenberechnung (features/settings/storage.ts)
// + UI, die diese bestehenden Funktionen aufruft.

export default function StorageScreen() {
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { data: audioEditions } = useAudioEditions();

  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Download-Fortschritt fürs Whisper-Modell (0..100), null = kein Download.
  const [whisperDlPct, setWhisperDlPct] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setOverview(await getStorageOverview());
  }, []);

  // Direktes .then() im Effekt-Body statt refresh() aufzurufen (obwohl
  // funktional identisch) - React-Compiler-Lint meldet sonst "setState
  // synchronously within an effect", weil es refresh() bis zum setOverview
  // hinein verfolgt. Gleiches Muster wie die bestehenden Lade-Effekte in
  // app/settings.tsx (z. B. countDownloadedSurahs/listDownloadedReciters).
  useEffect(() => {
    let cancelled = false;
    getStorageOverview().then((o) => {
      if (!cancelled) setOverview(o);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function reciterName(reciter: string): string {
    const edition = audioEditions?.find((e) => e.identifier === reciter);
    return edition ? editionDisplayName(edition) : reciter;
  }

  function confirmDeleteReciter(reciter: string) {
    const name = reciterName(reciter);
    Alert.alert(
      t('settings.reciterAudioPack.deleteConfirmTitle'),
      t('settings.reciterAudioPack.deleteConfirmBody').replace('{reciter}', name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.reciterAudioPack.deleteAction'),
          style: 'destructive',
          onPress: async () => {
            setBusy(`reciter:${reciter}`);
            await deleteFullMushafAudio(reciter);
            await refresh();
            setBusy(null);
          },
        },
      ],
    );
  }

  function confirmDeleteKiModel() {
    const size = formatBytes(MODELL_GROESSE_BYTES);
    Alert.alert(t('ki.deleteModel'), t('ki.deleteModelConfirm').replace('{size}', size), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ki.deleteModel'),
        style: 'destructive',
        onPress: async () => {
          setBusy('kiModel');
          await deleteKiModel();
          await refresh();
          setBusy(null);
        },
      },
    ]);
  }

  function confirmDeleteWhisperModel() {
    const size = formatBytes(aktuelleModellGroesse());
    Alert.alert(t('settings.storage.whisperModel.delete'), t('settings.storage.whisperModel.deleteConfirm').replace('{size}', size), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.storage.whisperModel.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy('whisperModel');
          await deleteWhisperModel();
          await refresh();
          setBusy(null);
        },
      },
    ]);
  }

  function confirmDeletePodcastEpisode(episodeNo: number, title: string) {
    Alert.alert(
      t('podcast.deleteDownloadConfirmTitle'),
      `${title}\n\n${t('podcast.deleteDownloadConfirmBody')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('podcast.deleteDownload'),
          style: 'destructive',
          onPress: async () => {
            setBusy(`podcast:${episodeNo}`);
            await deleteEpisodeDownload(episodeNo);
            await refresh();
            setBusy(null);
          },
        },
      ],
    );
  }

  function confirmDeleteAllPodcasts() {
    Alert.alert(t('settings.storage.podcast.deleteAllConfirmTitle'), t('settings.storage.podcast.deleteAllConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.storage.podcast.deleteAll'),
        style: 'destructive',
        onPress: async () => {
          setBusy('podcastAll');
          await deleteAllPodcastDownloads();
          await refresh();
          setBusy(null);
        },
      },
    ]);
  }

  function confirmDeleteVideoEpisode(episodeNo: number, title: string) {
    Alert.alert(
      t('video.deleteDownloadConfirmTitle'),
      `${title}\n\n${t('video.deleteDownloadConfirmBody')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('video.deleteDownload'),
          style: 'destructive',
          onPress: async () => {
            setBusy(`video:${episodeNo}`);
            await deleteVideoDownload(episodeNo);
            await refresh();
            setBusy(null);
          },
        },
      ],
    );
  }

  function confirmDeleteAllVideos() {
    Alert.alert(t('settings.storage.video.deleteAllConfirmTitle'), t('settings.storage.video.deleteAllConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.storage.video.deleteAll'),
        style: 'destructive',
        onPress: async () => {
          setBusy('videoAll');
          await deleteAllVideoDownloads();
          await refresh();
          setBusy(null);
        },
      },
    ]);
  }

  // Modell VORAB aus den Einstellungen laden (User-Wunsch): bisher startete der
  // Download erst beim ersten Aufnehmen in der Aufsage-Übung. Lädt das aktuell
  // gewählte Modell (base/turbo, s. settings.recitationModel).
  async function downloadWhisperModel() {
    setBusy('whisperModel');
    setWhisperDlPct(0);
    try {
      await whisperModellHerunterladen((p) => setWhisperDlPct(Math.round(p.anteil * 100)));
      await refresh();
    } catch {
      Alert.alert(t('settings.storage.whisperModel.title'), t('hifz.micError'));
    } finally {
      setWhisperDlPct(null);
      setBusy(null);
    }
  }

  // Läuft schon ein Download (z. B. auf einem anderen Screen gestartet), beim
  // Betreten des Speicher-Screens automatisch wieder anzeigen — der Download
  // wird NICHT neu gestartet (Singleton), nur mit-beobachtet.
  useEffect(() => {
    if (!whisperDownloadLaeuft()) return;
    // Microtask, um synchrones setState im Effekt-Body zu vermeiden
    // (React-Compiler-Lint); downloadWhisperModel joint den Singleton und
    // bekommt den aktuellen Fortschritt sofort per Callback.
    void Promise.resolve().then(() => downloadWhisperModel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirmClearCache() {
    Alert.alert(t('settings.storage.cache.clearConfirmTitle'), t('settings.storage.cache.clearConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.storage.cache.clearAction'),
        style: 'destructive',
        onPress: async () => {
          setBusy('cache');
          await clearAppCache();
          await refresh();
          setBusy(null);
        },
      },
    ]);
  }

  return (
    <ThemedView type="groupedBackground" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('settings.storage.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('settings.storage.subtitle')}
          </ThemedText>

          {overview === null && (
            <View style={styles.centerBox}>
              <ThemedActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary" style={styles.loadingLabel}>
                {t('settings.storage.loading')}
              </ThemedText>
            </View>
          )}

          {overview !== null && !overview.supported && (
            <ThemedView type="groupedCard" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('settings.storage.unsupported')}
              </ThemedText>
            </ThemedView>
          )}

          {overview !== null && overview.supported && (
            <>
              <ThemedView type="groupedCard" style={styles.totalCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('settings.storage.total')}
                </ThemedText>
                <ThemedText type="title" style={styles.totalValue}>
                  {formatBytes(overview.totalBytes)}
                </ThemedText>
              </ThemedView>

              <Section label={t('settings.storage.reciterAudio.title')}>
                {overview.reciterAudio.reciters.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                    {t('settings.storage.reciterAudio.empty')}
                  </ThemedText>
                ) : (
                  overview.reciterAudio.reciters.map((pack) => (
                    <View key={pack.reciter} style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                      <View style={styles.itemLabel}>
                        <ThemedText type="default" style={rtl && styles.rtlText}>
                          {reciterName(pack.reciter)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                          {formatBytes(pack.bytes)} ·{' '}
                          {t('settings.reciterAudioPack.packStatus').replace('{n}', String(pack.surahCount))}
                        </ThemedText>
                      </View>
                      <DeleteButton
                        busy={busy === `reciter:${pack.reciter}`}
                        onPress={() => confirmDeleteReciter(pack.reciter)}
                        color={colors.accent}
                        label={t('settings.reciterAudioPack.deleteAction')}
                      />
                    </View>
                  ))
                )}
              </Section>

              <Section label={t('settings.storage.offlineQuran.title')}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                  {t('settings.storage.offlineQuran.hint')}
                </ThemedText>
                <View style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                  <View style={styles.itemLabel}>
                    <ThemedText type="default" style={rtl && styles.rtlText}>
                      {overview.offlineQuran.surahCount === 0
                        ? t('settings.storage.offlineQuran.empty')
                        : formatBytes(overview.offlineQuran.bytes)}
                    </ThemedText>
                    {overview.offlineQuran.surahCount > 0 && (
                      <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                        {t('settings.storage.offlineQuran.surahs').replace(
                          '{n}',
                          String(overview.offlineQuran.surahCount),
                        )}
                      </ThemedText>
                    )}
                  </View>
                </View>
              </Section>

              <Section label={t('settings.storage.podcast.title')}>
                {overview.podcast.episodes.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                    {t('settings.storage.podcast.empty')}
                  </ThemedText>
                ) : (
                  <>
                    {overview.podcast.episodes.map((ep) => (
                      <View key={ep.episodeNo} style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                        <View style={styles.itemLabel}>
                          <ThemedText type="default" style={rtl && styles.rtlText} numberOfLines={2}>
                            {ep.episodeNo}. {ep.title}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                            {formatBytes(ep.bytes)}
                          </ThemedText>
                        </View>
                        <DeleteButton
                          busy={busy === `podcast:${ep.episodeNo}`}
                          onPress={() => confirmDeletePodcastEpisode(ep.episodeNo, ep.title)}
                          color={colors.accent}
                          label={t('podcast.deleteDownload')}
                        />
                      </View>
                    ))}
                    <Pressable
                      onPress={confirmDeleteAllPodcasts}
                      disabled={busy === 'podcastAll'}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.storage.podcast.deleteAll')}
                      style={({ pressed }) => [
                        styles.deleteAllWrap,
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedView type="backgroundSelected" style={styles.clearChip}>
                        {busy === 'podcastAll' ? (
                          <ThemedActivityIndicator size="small" />
                        ) : (
                          <>
                            <IconSymbol name="trash-outline" size={14} color={colors.accent} />
                            <ThemedText type="smallBold" themeColor="accent">
                              {t('settings.storage.podcast.deleteAll')}
                            </ThemedText>
                          </>
                        )}
                      </ThemedView>
                    </Pressable>
                  </>
                )}
              </Section>

              <Section label={t('settings.storage.video.title')}>
                {overview.video.episodes.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                    {t('settings.storage.video.empty')}
                  </ThemedText>
                ) : (
                  <>
                    {overview.video.episodes.map((ep) => (
                      <View key={ep.episodeNo} style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                        <View style={styles.itemLabel}>
                          <ThemedText type="default" style={rtl && styles.rtlText} numberOfLines={2}>
                            {ep.episodeNo}. {ep.title}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                            {formatBytes(ep.bytes)}
                          </ThemedText>
                        </View>
                        <DeleteButton
                          busy={busy === `video:${ep.episodeNo}`}
                          onPress={() => confirmDeleteVideoEpisode(ep.episodeNo, ep.title)}
                          color={colors.accent}
                          label={t('video.deleteDownload')}
                        />
                      </View>
                    ))}
                    <Pressable
                      onPress={confirmDeleteAllVideos}
                      disabled={busy === 'videoAll'}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.storage.video.deleteAll')}
                      style={({ pressed }) => [
                        styles.deleteAllWrap,
                        Platform.OS === 'web' ? styles.pressableWeb : undefined,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedView type="backgroundSelected" style={styles.clearChip}>
                        {busy === 'videoAll' ? (
                          <ThemedActivityIndicator size="small" />
                        ) : (
                          <>
                            <IconSymbol name="trash-outline" size={14} color={colors.accent} />
                            <ThemedText type="smallBold" themeColor="accent">
                              {t('settings.storage.video.deleteAll')}
                            </ThemedText>
                          </>
                        )}
                      </ThemedView>
                    </Pressable>
                  </>
                )}
              </Section>

              <Section label={t('settings.storage.kiModel.title')}>
                <View style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                  <View style={styles.itemLabel}>
                    <ThemedText type="default" style={rtl && styles.rtlText}>
                      {t('settings.storage.kiModel.title')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                      {overview.kiModel.downloaded
                        ? formatBytes(overview.kiModel.bytes)
                        : t('settings.storage.kiModel.notDownloaded')}
                    </ThemedText>
                  </View>
                  {overview.kiModel.downloaded && (
                    <DeleteButton
                      busy={busy === 'kiModel'}
                      onPress={confirmDeleteKiModel}
                      color={colors.accent}
                      label={t('ki.deleteModel')}
                    />
                  )}
                </View>
              </Section>

              <Section label={t('settings.storage.whisperModel.title')}>
                <View style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                  <View style={styles.itemLabel}>
                    <ThemedText type="default" style={rtl && styles.rtlText}>
                      {t('settings.storage.whisperModel.title')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={rtl && styles.rtlText}>
                      {overview.whisperModel.downloaded
                        ? formatBytes(overview.whisperModel.bytes)
                        : whisperDlPct !== null
                          ? `${t('hifz.modelDownload').replace('{p}', String(whisperDlPct))}`
                          : `${t('settings.storage.whisperModel.notDownloaded')} · ${formatBytes(aktuelleModellGroesse())}`}
                    </ThemedText>
                  </View>
                  {overview.whisperModel.downloaded ? (
                    <DeleteButton
                      busy={busy === 'whisperModel'}
                      onPress={confirmDeleteWhisperModel}
                      color={colors.accent}
                      label={t('settings.storage.whisperModel.delete')}
                    />
                  ) : (
                    <Pressable
                      onPress={downloadWhisperModel}
                      disabled={busy === 'whisperModel'}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.storage.whisperModel.download')}
                      style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                      <ThemedView type="backgroundSelected" style={styles.clearChip}>
                        {busy === 'whisperModel' ? (
                          <ThemedActivityIndicator size="small" />
                        ) : (
                          <>
                            <IconSymbol name="download-outline" size={14} color={colors.accent} />
                            <ThemedText type="smallBold" themeColor="accent">
                              {t('settings.storage.whisperModel.download')}
                            </ThemedText>
                          </>
                        )}
                      </ThemedView>
                    </Pressable>
                  )}
                </View>
              </Section>

              <Section label={t('settings.storage.cache.title')}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                  {t('settings.storage.cache.hint')}
                </ThemedText>
                <View style={[styles.itemRow, rtl && styles.itemRowRtl]}>
                  <View style={styles.itemLabel}>
                    <ThemedText type="default" style={rtl && styles.rtlText}>
                      {formatBytes(overview.cache.bytes)}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={confirmClearCache}
                    disabled={busy === 'cache'}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.storage.cache.clear')}
                    style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                    <ThemedView type="backgroundSelected" style={styles.clearChip}>
                      {busy === 'cache' ? (
                        <ThemedActivityIndicator size="small" />
                      ) : (
                        <>
                          <IconSymbol name="trash-outline" size={14} color={colors.accent} />
                          <ThemedText type="smallBold" themeColor="accent">
                            {t('settings.storage.cache.clear')}
                          </ThemedText>
                        </>
                      )}
                    </ThemedView>
                  </Pressable>
                </View>
              </Section>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DeleteButton({
  onPress,
  busy,
  color,
  label,
}: {
  onPress: () => void;
  busy: boolean;
  color: string;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
      <ThemedView type="backgroundSelected" style={styles.iconChip}>
        {busy ? <ThemedActivityIndicator size="small" /> : <IconSymbol name="trash-outline" size={16} color={color} />}
      </ThemedView>
    </Pressable>
  );
}

/**
 * Gruppe der Speicher-Uebersicht — gleiche Grammatik wie in den Einstellungen
 * (Audit 2026-07-29): kleiner grauer Kopf in Gemischtschrift ohne Symbol, die
 * Karte in groupedCard vor dem dunkleren Seitengrund, ohne Schatten.
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  const { locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  return (
    <View style={styles.section}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        accessibilityRole="header"
        style={[styles.sectionLabel, rtl && styles.rtlText]}>
        {label}
      </ThemedText>
      <View style={[styles.sectionBody, { backgroundColor: theme.groupedCard }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  centerBox: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  loadingLabel: {},
  card: { padding: Spacing.four, borderRadius: 20 },
  totalCard: { padding: Spacing.four, borderRadius: 20, alignItems: 'center', gap: Spacing.one },
  totalValue: { fontSize: 34, lineHeight: 40 },
  section: { gap: Spacing.two },
  sectionLabel: { paddingHorizontal: Spacing.three },
  sectionBody: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  emptyHint: {},
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  itemRowRtl: { flexDirection: 'row-reverse' },
  itemLabel: { flex: 1, gap: 2 },
  rtlText: { textAlign: 'right' },
  // Tap-Ziel: 40x40 plus hitSlop statt der frueheren 32x32.
  iconChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deleteAllWrap: { alignSelf: 'flex-start', marginTop: Spacing.one },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});

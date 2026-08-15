// Playlist-Verwaltung: eigene Video-Playlists anlegen, umbenennen, loeschen und
// abspielen (rein lokal, playlists.ts / AsyncStorage). Aufklappbare Karten
// (Akkordeon): der Kopf zeigt Name, Anzahl und Aktionen (alle abspielen,
// umbenennen, loeschen); aufgeklappt die enthaltenen Videos mit Cover/Titel/
// Dauer. Antippen eines Videos oeffnet den Player mit dem `list`-Parameter,
// sodass „Weiter/Zurueck" + Auto-Play innerhalb der Playlist laufen. Die
// Video-Metadaten kommen aus demselben gecachten Index wie Liste/Player.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/screen-header';
import { fetchVideoIndex, formatDuration, type VideoEpisode } from '@/features/video/data';
import { useVideoPlaylists, type VideoPlaylist } from '@/features/video/playlists';
import { hapticLight } from '@/lib/haptics';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export default function PlaylistsScreen() {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { playlists, create, rename, remove } = useVideoPlaylists();

  const { data } = useQuery({ queryKey: ['video', 'index'], queryFn: fetchVideoIndex, staleTime: 60 * 60 * 1000 });
  const episodes = data?.episodes ?? [];
  const byNo = new Map(episodes.map((e) => [e.episode_no, e]));

  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function onCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const pl = await create(trimmed);
    setNewName('');
    setExpanded(pl.id);
    hapticLight();
  }

  function confirmDelete(pl: VideoPlaylist) {
    Alert.alert(t('video.deletePlaylistConfirmTitle'), t('video.deletePlaylistConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('video.deletePlaylist'), style: 'destructive', onPress: () => void remove(pl.id) },
    ]);
  }

  function startRename(pl: VideoPlaylist) {
    setEditingId(pl.id);
    setEditName(pl.name);
  }

  async function saveRename(pl: VideoPlaylist) {
    await rename(pl.id, editName);
    setEditingId(null);
  }

  function playFrom(pl: VideoPlaylist, episodeNo: number) {
    router.push({ pathname: '/videos/[episode]', params: { episode: episodeNo, list: pl.id } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('video.playlists')} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
              <IconSymbol name="albums" size={34} color={colors.background} />
            </View>
          </View>

          {/* Neue Playlist anlegen */}
          <View style={styles.createRow}>
            <ThemedView type="backgroundElement" style={styles.inputBox}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder={t('video.newPlaylist')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
                returnKeyType="done"
                onSubmitEditing={onCreate}
                maxLength={60}
              />
            </ThemedView>
            <Pressable
              onPress={onCreate}
              disabled={!newName.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('video.createPlaylist')}
              style={[styles.createBtn, { backgroundColor: colors.accent }, !newName.trim() && styles.disabled]}>
              <IconSymbol name="add" size={24} color={colors.background} />
            </Pressable>
          </View>

          {playlists.length === 0 ? (
            <View style={styles.empty}>
              <IconSymbol name="albums-outline" size={40} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('video.noPlaylists')}
              </ThemedText>
            </View>
          ) : (
            playlists.map((pl) => {
              const open = expanded === pl.id;
              const items = pl.episodeNos.map((n) => byNo.get(n)).filter((e): e is VideoEpisode => !!e);
              const first = items[0];
              return (
                <ThemedView key={pl.id} type="backgroundElement" style={styles.plCard}>
                  <View style={styles.plHead}>
                    {editingId === pl.id ? (
                      <>
                        <ThemedView type="backgroundSelected" style={styles.editBox}>
                          <TextInput
                            value={editName}
                            onChangeText={setEditName}
                            autoFocus
                            style={[styles.input, { color: colors.text }]}
                            returnKeyType="done"
                            onSubmitEditing={() => saveRename(pl)}
                            maxLength={60}
                          />
                        </ThemedView>
                        <Pressable onPress={() => saveRename(pl)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.save')} style={styles.headBtn}>
                          <IconSymbol name="checkmark" size={22} color={colors.accent} />
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setExpanded(open ? null : pl.id)}
                          style={styles.plTitleWrap}
                          accessibilityRole="button">
                          <ThemedText type="default" numberOfLines={1}>
                            {pl.name}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {pl.episodeNos.length} {t('video.videos')}
                          </ThemedText>
                        </Pressable>
                        {first && (
                          <Pressable onPress={() => playFrom(pl, first.episode_no)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('video.playAll')} style={styles.headBtn}>
                            <IconSymbol name="play-circle" size={28} color={colors.accent} />
                          </Pressable>
                        )}
                        <Pressable onPress={() => startRename(pl)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('video.renamePlaylist')} style={styles.headBtn}>
                          <IconSymbol name="create-outline" size={20} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable onPress={() => confirmDelete(pl)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('video.deletePlaylist')} style={styles.headBtn}>
                          <IconSymbol name="trash-outline" size={20} color={colors.textSecondary} />
                        </Pressable>
                      </>
                    )}
                  </View>

                  {open && (
                    <View style={styles.plBody}>
                      {items.length === 0 ? (
                        <ThemedText type="small" themeColor="textSecondary" style={styles.plEmpty}>
                          {t('video.playlistEmpty')}
                        </ThemedText>
                      ) : (
                        items.map((ep) => (
                          <PressableCard
                            key={ep.episode_no}
                            onPress={() => playFrom(pl, ep.episode_no)}
                            type="backgroundSelected"
                            style={styles.vidRow}>
                            <View style={styles.thumbWrap}>
                              {ep.cover_url ? (
                                <Image source={ep.cover_url} style={styles.thumb} contentFit="cover" transition={150} />
                              ) : (
                                <ThemedView type="backgroundElement" style={[styles.thumb, styles.thumbFallback]}>
                                  <IconSymbol name="videocam" size={16} color={colors.accent} />
                                </ThemedView>
                              )}
                              <View style={styles.playOverlay}>
                                <IconSymbol name="play" size={14} color="#FFFFFF" />
                              </View>
                            </View>
                            <View style={styles.vidText}>
                              <ThemedText type="small" numberOfLines={2}>
                                {ep.title}
                              </ThemedText>
                              <ThemedText type="small" themeColor="accent">
                                {formatDuration(ep.duration_sec)}
                              </ThemedText>
                            </View>
                          </PressableCard>
                        ))
                      )}
                    </View>
                  )}
                </ThemedView>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.two, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  header: { alignItems: 'center', gap: Spacing.one, paddingBottom: Spacing.three, paddingTop: Spacing.two },
  headerIcon: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  inputBox: { flex: 1, borderRadius: 14, paddingHorizontal: Spacing.three, height: 50, justifyContent: 'center' },
  input: { fontSize: 16, padding: 0 },
  createBtn: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  emptyText: { textAlign: 'center', paddingHorizontal: Spacing.four },
  plCard: { borderRadius: 16, padding: Spacing.two },
  plHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  plTitleWrap: { flex: 1, minWidth: 0, paddingVertical: Spacing.one, paddingHorizontal: Spacing.one, gap: 2 },
  headBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  editBox: { flex: 1, borderRadius: 12, paddingHorizontal: Spacing.two, height: 44, justifyContent: 'center' },
  plBody: { marginTop: Spacing.one, gap: Spacing.one },
  plEmpty: { padding: Spacing.two },
  vidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.one },
  thumbWrap: { width: 72, height: 48 },
  thumb: { width: 72, height: 48, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  vidText: { flex: 1, minWidth: 0, gap: 2 },
});

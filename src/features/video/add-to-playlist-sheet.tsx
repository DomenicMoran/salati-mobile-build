// „Zu Playlist hinzufuegen"-Sheet: modales Bottom-Sheet (gleiche Optik wie das
// Podcast-Einstellungen-Sheet). Zeigt alle Playlists mit Haekchen (enthaelt die
// Folge oder nicht) und schaltet die Mitgliedschaft per Tippen um; oben laesst
// sich direkt eine neue Playlist anlegen. Rein lokal (playlists.ts / AsyncStorage)
// und plattformunabhaengig (auch Web).
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useVideoPlaylists } from '@/features/video/playlists';
import { hapticLight } from '@/lib/haptics';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

export function AddToPlaylistSheet({
  visible,
  onClose,
  episodeNo,
}: {
  visible: boolean;
  onClose: () => void;
  episodeNo: number;
}) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { playlists, create, add, removeVideo } = useVideoPlaylists();
  const [name, setName] = useState('');

  async function onCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pl = await create(trimmed);
    setName('');
    await add(pl.id, episodeNo);
    hapticLight();
  }

  function toggle(id: string, contains: boolean) {
    if (contains) void removeVideo(id, episodeNo);
    else void add(id, episodeNo);
    hapticLight();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView type="backgroundElement" style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
            {t('video.addToPlaylist').toUpperCase()}
          </ThemedText>

          {/* Neue Playlist anlegen */}
          <View style={styles.createRow}>
            <ThemedView type="backgroundSelected" style={styles.inputBox}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('video.playlistNamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
                returnKeyType="done"
                onSubmitEditing={onCreate}
                maxLength={60}
              />
            </ThemedView>
            <Pressable
              onPress={onCreate}
              disabled={!name.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('video.createPlaylist')}
              style={[styles.createBtn, { backgroundColor: colors.accent }, !name.trim() && styles.disabled]}>
              <IconSymbol name="add" size={22} color={colors.background} />
            </Pressable>
          </View>

          {/* Vorhandene Playlists */}
          {playlists.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {t('video.noPlaylists')}
            </ThemedText>
          ) : (
            playlists.map((pl) => {
              const contains = pl.episodeNos.includes(episodeNo);
              return (
                <PressableCard
                  key={pl.id}
                  onPress={() => toggle(pl.id, contains)}
                  type="backgroundSelected"
                  style={styles.plRow}>
                  <IconSymbol
                    name={contains ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={contains ? colors.accent : colors.textSecondary}
                  />
                  <View style={styles.plText}>
                    <ThemedText type="default" numberOfLines={1}>
                      {pl.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {pl.episodeNos.length} {t('video.videos')}
                    </ThemedText>
                  </View>
                </PressableCard>
              );
            })
          )}

          <Pressable onPress={onClose} style={[styles.doneBtn, { backgroundColor: colors.accent }]}>
            <ThemedText type="smallBold" style={{ color: colors.background }}>
              {t('common.done')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Spacing.five,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', marginTop: Spacing.two },
  content: { padding: Spacing.four, gap: Spacing.two, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  label: { textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.one },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  inputBox: { flex: 1, borderRadius: 14, paddingHorizontal: Spacing.three, height: 48, justifyContent: 'center' },
  input: { fontSize: 16, padding: 0 },
  createBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  empty: { paddingVertical: Spacing.three, textAlign: 'center' },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, marginTop: Spacing.one },
  plText: { flex: 1, minWidth: 0 },
  doneBtn: { marginTop: Spacing.four, paddingVertical: Spacing.three, borderRadius: 999, alignItems: 'center' },
});

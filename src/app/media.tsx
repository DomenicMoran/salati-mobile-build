// Medien-Hub: eine Zwischenebene, die Podcast, Videos und Reels unter einem
// gemeinsamen Dach buendelt (vorher lagen die drei einzeln im Lernen-Tab).
// Jeder Eintrag oeffnet die bestehende Liste/Route — hier wird nichts
// dupliziert, nur navigiert. Web-Fallbacks der Ziele (reels/index.web.tsx,
// videos/[episode].web.tsx) bleiben unangetastet.
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type IconName } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list';
import { NavTile } from '@/components/ui/nav-tile';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

const MEDIA_TILES = [
  { href: '/podcast', labelKey: 'podcast.title', icon: 'headset' },
  { href: '/videos', labelKey: 'video.title', icon: 'videocam' },
  { href: '/reels', labelKey: 'reels.title', icon: 'film' },
  { href: '/handouts', labelKey: 'handouts.title', icon: 'document-text' },
] as const satisfies readonly { href: string; labelKey: string; icon: IconName }[];

export default function MediaHubScreen() {
  const { t } = useTranslation();
  return (
    <ThemedView type="groupedBackground" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('media.title')} subtitle={t('media.subtitle')} />
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <ListCard>
            {MEDIA_TILES.map((item, index) => (
              <NavTile
                key={item.href}
                index={index}
                label={t(item.labelKey)}
                icon={item.icon}
                onPress={() => router.push(item.href)}
              />
            ))}
          </ListCard>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  list: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
});

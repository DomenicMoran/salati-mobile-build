// Erklärungs-Sheet für Übungstypen: "Was du machst" + "Warum das hilft" - da
// die App keine Videos/Tutorials hat, ersetzt dieser Text die sonst übliche
// Onboarding-Animation (User-Feedback, siehe useExerciseIntro). Struktur
// bewusst analog zu features/quran/WordInfoSheet.tsx (etabliertes Sheet-Muster).
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

interface IntroSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  what: string;
  why: string;
}

export function IntroSheet({ visible, onClose, title, what, why }: IntroSheetProps) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}
        onPress={onClose}
      />
      <ThemedView style={styles.sheet} accessibilityViewIsModal importantForAccessibility="yes">
        <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              {title}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.close')}
              style={Platform.OS === 'web' ? styles.pressableWeb : undefined}>
              <IconSymbol name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('practice.intro.whatLabel')}
            </ThemedText>
            <ThemedText type="default">{what}</ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              {t('practice.intro.whyLabel')}
            </ThemedText>
            <ThemedText type="default">{why}</ThemedText>
          </View>

          <PressableCard onPress={onClose} type="backgroundSelected" style={styles.gotItButton}>
            <ThemedText type="smallBold" themeColor="accent">
              {t('practice.intro.gotIt')}
            </ThemedText>
          </PressableCard>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,13,0.45)' },
  sheet: {
    maxHeight: '80%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, opacity: 0.4, marginBottom: Spacing.two },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.one },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  title: { flex: 1 },
  section: { marginTop: Spacing.three, gap: Spacing.one },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 1 },
  gotItButton: { alignItems: 'center', marginTop: Spacing.five, padding: Spacing.three, borderRadius: Spacing.three },
  pressableWeb: { cursor: 'pointer' },
});

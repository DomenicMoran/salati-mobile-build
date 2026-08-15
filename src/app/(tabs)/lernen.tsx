// „Lernen"-Tab (Studium): prominenter Einstieg fuer die Lerninhalte. Das Raster
// ist jetzt EINHEITLICH mit dem „Mehr"-Tab (gemeinsame NavTile-Komponente,
// gleiche Kachelgroesse/Icon-Badge/Padding/Spalten) und speist sich aus EINER
// gemeinsamen Liste (lib/lernenNav.ts), sodass dieselben Eintraege auch im
// „Mehr"-Tab als Verknuepfung erscheinen. Podcast/Videos/Reels liegen nicht
// mehr einzeln hier, sondern gebuendelt hinter der ersten „Medien"-Kachel, die
// den Medien-Hub (/media) oeffnet.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCard } from '@/components/ui/list';
import { NavTile } from '@/components/ui/nav-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { splitSequential, useLayout } from '@/hooks/use-layout';
import { useRtl } from '@/hooks/use-rtl';
import { LERNEN_NAV } from '@/lib/lernenNav';
import { useTranslation } from '@/lib/i18n';

export default function LernenScreen() {
  const { t } = useTranslation();
  // Breitbild: die elf Einstiege standen auf 800 dp untereinander und endeten
  // bei 45 % der Fensterhoehe (Gerätebefund 2026-07-29). Auf Tablets stehen
  // sie in zwei Karten nebeneinander.
  const { sectionColumns, contentWidth } = useLayout();
  const rtl = useRtl();
  const spalten = splitSequential(LERNEN_NAV, sectionColumns, () => 1);
  let laufIndex = 0;

  return (
    <ThemedView type="groupedBackground" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t('nav.lernen')}
        </ThemedText>

        <ScrollView
          contentContainerStyle={[styles.list, { maxWidth: contentWidth }]}
          showsVerticalScrollIndicator={false}>
          <View style={sectionColumns > 1 ? [styles.columnsRow, rtl && styles.columnsRowRtl] : undefined}>
            {spalten.map((spalte, spaltenIndex) => (
              <View key={spaltenIndex} style={sectionColumns > 1 ? styles.column : undefined}>
                <ListCard>
                  {spalte.map((item) => (
                    <NavTile
                      key={item.href}
                      index={laufIndex++}
                      label={t(item.labelKey)}
                      icon={item.icon}
                      onPress={() => router.push(item.href)}
                    />
                  ))}
                </ListCard>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.three },
  title: { textAlign: 'center', marginBottom: Spacing.three },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  columnsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  columnsRowRtl: { flexDirection: 'row-reverse' },
  column: { flex: 1, minWidth: 0 },
});

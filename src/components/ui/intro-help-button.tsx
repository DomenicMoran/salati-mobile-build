// "?"-Icon zum erneuten Öffnen des Erklärungs-Sheets (siehe IntroSheet) -
// die Erklärung selbst poppt nur beim ERSTEN Besuch automatisch auf
// (useExerciseIntro), dieser Button ist der bewusste Re-Einstieg danach.
import { Platform, Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTranslation } from '@/lib/i18n';

interface IntroHelpButtonProps {
  onPress: () => void;
  color: string;
}

export function IntroHelpButton({ onPress, color }: IntroHelpButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('practice.intro.reopenA11y')}
      style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
      <IconSymbol name="help-circle-outline" size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableWeb: { cursor: 'pointer' },
  pressed: { opacity: 0.6 },
});

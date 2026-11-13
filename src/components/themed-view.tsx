import { View, type ViewProps } from 'react-native';

import { Colors, ThemeColor } from '@/constants/theme';
import { useSettingsMaybe } from '@/features/settings/store';
import { amoledThemeOverlay, useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const base = useTheme();
  const settingsCtx = useSettingsMaybe();
  const theme =
    settingsCtx?.settings.uiAmoledBlack && base.background === Colors.dark.background
      ? amoledThemeOverlay(base)
      : base;

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}

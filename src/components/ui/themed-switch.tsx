import { Platform, Switch, type SwitchProps } from 'react-native';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// react-native-web färbt den EINGESCHALTETEN Daumen über das web-only-Prop
// `activeThumbColor` (Default: Teal) - `thumbColor` gilt dort nur für den
// AUS-Zustand. Live auf salati.pro verifiziert: ohne dieses Prop blieb der
// Ein-Daumen türkis, obwohl der Track schon Gold war.
const webThumbFix = Platform.OS === 'web' ? ({ activeThumbColor: '#ffffff' } as object) : {};

/**
 * Switch in Markenfarben: aktiver Track in Brand-Gold statt des türkisen
 * RN-Defaults (einziger systemfarbener Fremdkörper in der App, Audit
 * 2026-07-19 B1). Gold ist hier dekorative Fläche, kein Text — daher
 * Brand.gold direkt statt der kontrastverstärkten accent-Variante.
 */
export function ThemedSwitch(props: SwitchProps) {
  const theme = useTheme();

  return (
    <Switch
      trackColor={{ false: theme.backgroundSelected, true: Brand.gold }}
      thumbColor="#ffffff"
      {...webThumbFix}
      {...props}
    />
  );
}

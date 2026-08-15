// Faengt Render-Fehler ab, die sonst die App komplett weiss/leer liesen
// (React entfernt bei einem ungefangenen Fehler den kompletten Baum). Zeigt
// stattdessen einen Wiederherstellungs-Screen mit Kopieren-Button fuer den
// lokalen Fehler-Log (kein Sentry — reines On-Device-Debugging fuer Support-
// Mails, siehe lib/errorLog.ts).
import * as Clipboard from 'expo-clipboard';
import * as Localization from 'expo-localization';
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { formatErrorReport, getErrorLog, logError } from '@/lib/errorLog';

// WICHTIG: Diese Komponente wrappt in _layout.tsx den kompletten App-Baum
// INKLUSIVE SettingsProvider ("<ErrorBoundary><SettingsProvider>…</SettingsProvider>
// </ErrorBoundary>") - ein Fehler IRGENDWO in der App unmountet dadurch auch
// SettingsProvider, bevor dieser Fallback rendert. ThemedView/ThemedText
// (useTheme -> useResolvedScheme -> useSettings) wuerden hier mit
// "useSettings must be used within SettingsProvider" selbst crashen und den
// eigentlich hilfreichen Recovery-Screen durch einen zweiten, kryptischeren
// Crash ersetzen (live im Android-Emulator gefunden: Deep-Link auf einen
// defekten Screen zeigte statt "Etwas ist schiefgelaufen" nur einen rohen
// LogBox-Fehler). Deshalb bewusst NUR RN-Grundbausteine + Colors-Konstante +
// das systemweite useColorScheme (kein App-Context noetig) - dieser Fallback
// muss unter allen Umstaenden rendern koennen.
function ErrorFallback({ onCopy, onReload, copied }: { onCopy: () => void; onReload: () => void; copied: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const t = textFor();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, styles.center, { color: colors.text }]}>{t.title}</Text>
      <Text style={[styles.body, styles.center, { color: colors.textSecondary }]}>{t.body}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onCopy} style={styles.button}>
          <Text style={[styles.buttonText, { color: colors.accent }]}>{copied ? t.copied : t.copy}</Text>
        </Pressable>
        <Pressable onPress={onReload} style={styles.button}>
          <Text style={[styles.buttonText, { color: colors.accent }]}>{t.reload}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const TEXT: Record<string, { title: string; body: string; copy: string; copied: string; reload: string }> = {
  de: {
    title: 'Etwas ist schiefgelaufen',
    body: 'Die App ist auf einen Fehler gestoßen. Du kannst den Fehlerbericht kopieren und uns per Mail schicken.',
    copy: 'Fehlerbericht kopieren',
    copied: 'Kopiert',
    reload: 'Neu laden',
  },
  en: {
    title: 'Something went wrong',
    body: 'The app hit an error. You can copy the error report and send it to us by email.',
    copy: 'Copy error report',
    copied: 'Copied',
    reload: 'Reload',
  },
};

function textFor(): (typeof TEXT)['de'] {
  const lang = Localization.getLocales()[0]?.languageCode ?? 'de';
  return TEXT[lang] ?? TEXT.de;
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, copied: false };

  static getDerivedStateFromError(): State {
    return { hasError: true, copied: false };
  }

  componentDidCatch(error: Error): void {
    logError(error, 'render');
  }

  reload = (): void => {
    this.setState({ hasError: false, copied: false });
  };

  copyReport = async (): Promise<void> => {
    const entries = await getErrorLog();
    await Clipboard.setStringAsync(formatErrorReport(entries));
    this.setState({ copied: true });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback onCopy={this.copyReport} onReload={this.reload} copied={this.state.copied} />;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 14 },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  button: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  buttonText: { fontSize: 16 },
});

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconName } from '@/components/ui/icon-symbol';
import { PressableCard } from '@/components/ui/pressable-card';
import { ThemedActivityIndicator } from '@/components/themed-activity-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import { fetchProductByBarcode, type ScannedProduct } from '@/features/halal-scanner/api';
import { classifyIngredients, type ClassificationResult } from '@/features/halal-scanner/matcher';
import type { HalalStatus } from '@/features/halal-scanner/classification';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useTranslation } from '@/lib/i18n';

// Barcode-Scan per Kamera funktioniert auf Web nicht wie nativ (kein
// verlässlicher BarcodeDetector in allen Browsern, anderes Permission-Modell)
// - gleiches Gating-Prinzip wie mosques.tsx (Platform.OS + Fallback-UI), hier
// aber ohne extra app.config-Flag, weil es (anders als beim Google-Maps-Key)
// keinen Crash-Fall gibt, den ein Flag absichern müsste. Web bekommt
// stattdessen eine manuelle Barcode-Eingabe.
const nativeScanAvailable = Platform.OS !== 'web';

const STATUS_COLORS: Record<HalalStatus, string> = {
  halal: '#16a34a',
  haram: '#dc2626',
  mashbooh: '#d97706',
  unknown: '#6b7280',
};

const STATUS_ICONS: Record<HalalStatus, IconName> = {
  halal: 'checkmark-circle',
  haram: 'close-circle',
  mashbooh: 'warning',
  unknown: 'help-circle',
};

type ScanState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error' }
  | { kind: 'result'; product: ScannedProduct; classification: ClassificationResult };

export default function HalalScannerScreen() {
  const { t, locale } = useTranslation();
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];

  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const [manualBarcode, setManualBarcode] = useState('');
  const lastScannedRef = useRef<string | null>(null);

  async function runLookup(barcode: string) {
    setState({ kind: 'loading' });
    try {
      const product = await fetchProductByBarcode(barcode, locale);
      if (!product) {
        setState({ kind: 'notFound' });
        return;
      }
      const classification = classifyIngredients(product.ingredientsText);
      setState({ kind: 'result', product, classification });
    } catch {
      setState({ kind: 'error' });
    }
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (lastScannedRef.current === result.data || state.kind === 'loading') return;
    lastScannedRef.current = result.data;
    runLookup(result.data);
  }

  function scanAgain() {
    lastScannedRef.current = null;
    setManualBarcode('');
    setState({ kind: 'idle' });
  }

  const showCamera = nativeScanAvailable && state.kind === 'idle';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('scanner.title')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('scanner.subtitle')}
          </ThemedText>

          <ThemedView type="backgroundSelected" style={styles.disclaimer} testID="scanner-disclaimer">
            <View style={styles.disclaimerHeader}>
              <IconSymbol name="information-circle" size={16} color={colors.accent} />
              <ThemedText type="smallBold" themeColor="accent">
                {t('scanner.disclaimerTitle')}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimerBody}>
              {t('scanner.disclaimerBody')}
            </ThemedText>
          </ThemedView>

          {!nativeScanAvailable && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.webNotice}>
              {t('scanner.webNotice')}
            </ThemedText>
          )}

          {showCamera && <CameraPane onScanned={handleBarcodeScanned} t={t} />}

          {!nativeScanAvailable && state.kind === 'idle' && (
            <View style={styles.manualBox}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.manualLabel}>
                {t('scanner.manualEntryLabel')}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.inputBox}>
                <TextInput
                  value={manualBarcode}
                  onChangeText={setManualBarcode}
                  placeholder={t('scanner.manualEntryPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  style={[styles.textInput, { color: colors.text }]}
                />
              </ThemedView>
              <Pressable
                onPress={() => runLookup(manualBarcode.trim())}
                disabled={manualBarcode.trim().length === 0}
                style={styles.primaryButton}>
                <ThemedView type="backgroundSelected" style={styles.primaryButtonInner}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {t('scanner.checkButton')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          )}

          {state.kind === 'loading' && (
            <View style={styles.center}>
              <ThemedActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary">
                {t('scanner.loading')}
              </ThemedText>
            </View>
          )}

          {state.kind === 'notFound' && (
            <View style={styles.center}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {t('scanner.notFound')}
              </ThemedText>
              <ScanAgainButton t={t} onPress={scanAgain} colors={colors} />
            </View>
          )}

          {state.kind === 'error' && (
            <View style={styles.center}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {t('scanner.fetchError')}
              </ThemedText>
              <ScanAgainButton t={t} onPress={scanAgain} colors={colors} />
            </View>
          )}

          {state.kind === 'result' && (
            <ResultView
              product={state.product}
              classification={state.classification}
              t={t}
              colors={colors}
              onScanAgain={scanAgain}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ScanAgainButton({
  t,
  onPress,
  colors,
}: {
  t: (key: string) => string;
  onPress: () => void;
  colors: Record<ThemeColor, string>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <ThemedView type="backgroundSelected" style={styles.primaryButtonInner}>
        <ThemedText type="smallBold" themeColor="accent">
          {t('scanner.scanAgain')}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// useCameraPermissions() lebt bewusst HIER (nicht im Eltern-Screen), damit der
// Hook auf Web nie aufgerufen wird - CameraPane wird dort nie gemountet
// (showCamera ist immer false), ruft also nie in eine Browser-Permission-API,
// die während der Hydration inkonsistent laufen könnte.
function CameraPane({ onScanned, t }: { onScanned: (result: BarcodeScanningResult) => void; t: (key: string) => string }) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return (
      <View style={styles.center}>
        <ThemedActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    // Dauerhaft verweigert (Audit 2026-07-27, N9): ein erneutes
    // requestPermission() zeigt dann keinen Systemdialog mehr und bewirkt
    // nichts — der einzige Ausweg sind die Systemeinstellungen.
    const blocked = !permission.canAskAgain;
    return (
      <View style={styles.center}>
        {blocked && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {t('scanner.cameraPermissionDenied')}
          </ThemedText>
        )}
        {/* Beschriftung „Weiter"/„Continue" statt „Kamerazugriff erlauben"
            (Apple-Ablehnung 1.33.0, Guideline 5.1.1(iv)): Ein eigener Knopf
            VOR der Systemabfrage darf deren Wortlaut nicht vorwegnehmen — er
            führt nur zum Systemdialog, entscheiden tut dort das System.
            Ausnahme bleibt der dauerhaft verweigerte Fall (blocked): dann
            erscheint KEIN Systemdialog mehr, und „Systemeinstellungen öffnen"
            beschreibt exakt, was der Knopf tut. */}
        <Pressable
          onPress={() => (blocked ? void Linking.openSettings() : void requestPermission())}
          accessibilityRole="button"
          accessibilityLabel={blocked ? t('common.openSettings') : t('common.continue')}
          style={styles.primaryButton}>
          <ThemedView type="backgroundSelected" style={styles.primaryButtonInner}>
            <ThemedText type="smallBold" themeColor="accent">
              {blocked ? t('common.openSettings') : t('common.continue')}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.cameraOverlay} pointerEvents="none">
        <ThemedView type="backgroundSelected" style={styles.scanHint}>
          <ThemedText type="small" themeColor="accent">
            {t('scanner.scanPrompt')}
          </ThemedText>
        </ThemedView>
      </View>
    </View>
  );
}

function ResultView({
  product,
  classification,
  t,
  colors,
  onScanAgain,
}: {
  product: ScannedProduct;
  classification: ClassificationResult;
  t: (key: string) => string;
  colors: Record<ThemeColor, string>;
  onScanAgain: () => void;
}) {
  const statusColor = STATUS_COLORS[classification.status];

  return (
    <View style={styles.resultBox}>
      <ThemedText type="default" style={styles.productName}>
        {product.name || t('scanner.productNameFallback')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('scanner.barcodeLabel').replace('{code}', product.barcode)}
      </ThemedText>

      <View style={[styles.badge, { backgroundColor: statusColor }]}>
        <IconSymbol name={STATUS_ICONS[classification.status]} size={18} color="#ffffff" />
        <ThemedText type="smallBold" style={styles.badgeText}>
          {t(`scanner.statuses.${classification.status}`)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statusHint}>
        {t(`scanner.statusHints.${classification.status}`)}
      </ThemedText>

      {classification.matches.length > 0 && (
        <View style={styles.matchesSection}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.matchesTitle}>
            {t('scanner.matchedIngredientsTitle').toUpperCase()}
          </ThemedText>
          {classification.matches.map((m) => (
            <PressableCard key={m.categoryId} type="backgroundElement" style={styles.matchRow} disabled>
              <ThemedText type="small">{t(`scanner.reasons.${m.categoryId}`)}</ThemedText>
            </PressableCard>
          ))}
        </View>
      )}

      <ScanAgainButton t={t} onPress={onScanAgain} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingBottom: Spacing.six,
  },
  subtitle: { textAlign: 'center', lineHeight: 20 },
  disclaimer: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  disclaimerBody: { lineHeight: 18 },
  webNotice: { textAlign: 'center', lineHeight: 18 },
  cameraWrap: { borderRadius: Spacing.three, overflow: 'hidden', height: 320 },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', bottom: Spacing.three, alignSelf: 'center' },
  scanHint: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  manualBox: { gap: Spacing.two },
  manualLabel: { marginLeft: Spacing.one },
  inputBox: { borderRadius: Spacing.two, padding: Spacing.three },
  textInput: { fontSize: 16 },
  primaryButton: { alignSelf: 'flex-start' },
  primaryButtonInner: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    minWidth: 140,
    alignItems: 'center',
  },
  center: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  centerText: { textAlign: 'center', lineHeight: 20 },
  resultBox: { gap: Spacing.two },
  productName: { fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    marginTop: Spacing.one,
  },
  badgeText: { color: '#ffffff' },
  statusHint: { lineHeight: 18 },
  matchesSection: { gap: Spacing.two, marginTop: Spacing.two },
  matchesTitle: { textTransform: 'uppercase', letterSpacing: 1, marginLeft: Spacing.one },
  matchRow: { padding: Spacing.three },
});

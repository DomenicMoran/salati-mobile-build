import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  applyBackupData,
  collectBackupData,
  parseBackupFile,
  writeBackupFile,
  type BackupData,
} from '@/features/settings/backup';
import { isActiveSavedLocation } from '@/features/settings/savedLocations';
import type { AppSettings } from '@/features/settings/types';
import { getTravelStatus } from '@/features/prayer-times/travelMode';
import { buildWeekRows } from '@/features/prayer-times/week';
import { useWeekTimings } from '@/features/prayer-times/hooks';
import { buildPrintablePrayerWeekHtml } from '@/features/expansion/printWeekHtml';
import { MOSQUE_PACK_LICENSE_NOTE, readMosquePackStats } from '@/features/expansion/mosquePack';
import {
  DEFAULT_SUNNAH_FASTING,
  syncSunnahFastingReminders,
  type SunnahFastingPrefs,
} from '@/features/expansion/sunnahFasting';
import { loadHabits, saveHabits, streakDays, toggleHabitDay, type HabitId } from '@/features/expansion/habits';
import type { ExpansionStub } from '@/features/expansion/stubs';
import { useTranslation } from '@/lib/i18n';

const SUNNAH_PREFS_KEY = 'salatibox:expansion-sunnah-fasting';

type Props = {
  stub: ExpansionStub;
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
};

function ActionRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

export function ExpansionFeatureBody({ stub, settings, update }: Props) {
  const { t, locale } = useTranslation();

  switch (stub.id) {
    case 'multi-locations':
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.multiLocationsBody')}</ThemedText>
          {settings.savedLocations.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('expansion.multiLocationsEmpty')}
            </ThemedText>
          ) : (
            settings.savedLocations.map((loc) => (
              <Pressable
                key={loc.id}
                style={styles.rowCard}
                onPress={() =>
                  update({
                    location: { lat: loc.lat, lon: loc.lon, label: loc.label, city: loc.city, country: loc.country },
                  })
                }>
                <ThemedText type="smallBold">{loc.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {loc.label}
                  {isActiveSavedLocation(loc, settings.location) ? ` · ${t('expansion.activeNow')}` : ''}
                </ThemedText>
              </Pressable>
            ))
          )}
          <ActionRow label={t('expansion.openLocationSettings')} onPress={() => router.push('/settings' as never)} />
        </View>
      );

    case 'qasr-jam': {
      const travel = getTravelStatus(
        settings.homeLocation ? { lat: settings.homeLocation.lat, lon: settings.homeLocation.lon } : null,
        { lat: settings.location.lat, lon: settings.location.lon },
      );
      const madhhabs = ['hanafi', 'maliki', 'shafii', 'hanbali', 'unsure'] as const;
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.qasrBody')}</ThemedText>
          <View style={styles.switchRow}>
            <ThemedText>{t('expansion.travelConfirmed')}</ThemedText>
            <Switch
              value={settings.expansionTravelUserConfirmed}
              onValueChange={(v) => update({ expansionTravelUserConfirmed: v })}
            />
          </View>
          <View style={styles.switchRow}>
            <ThemedText>{t('settings.travel.enable')}</ThemedText>
            <Switch value={settings.travelModeEnabled} onValueChange={(v) => update({ travelModeEnabled: v })} />
          </View>
          <ThemedText type="smallBold">{t('expansion.madhhab')}</ThemedText>
          <View style={styles.chips}>
            {madhhabs.map((m) => (
              <Pressable
                key={m}
                style={[styles.chip, settings.expansionQasrMadhhab === m && styles.chipOn]}
                onPress={() => update({ expansionQasrMadhhab: m })}>
                <ThemedText type="small">{t(`expansion.madhhab_${m}`)}</ThemedText>
              </Pressable>
            ))}
          </View>
          {settings.expansionTravelUserConfirmed && settings.travelModeEnabled && travel.isTraveling ? (
            <ThemedText type="small" themeColor="accent">
              {t('prayer.travel.banner').replace('{km}', String(Math.round(travel.distanceKm)))}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('expansion.qasrIdle')}
            </ThemedText>
          )}
        </View>
      );
    }

    case 'sunnah-fasting':
      return <SunnahFastingPanel locale={locale} blockOn={settings.expansionSunnahFastingReminders} />;

    case 'habit':
      return <HabitPanel locale={locale} />;

    case 'voice-quran':
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.voiceQuranBody')}</ThemedText>
          <ActionRow label={t('expansion.openQuranSearch')} onPress={() => router.push('/search' as never)} />
          <ActionRow label={t('expansion.openHifzWhisper')} onPress={() => router.push('/hifz' as never)} />
        </View>
      );

    case 'personal-backup':
      return <PersonalBackupPanel />;

    case 'mosque-pack':
      return <MosquePackPanel locale={locale} />;

    case 'amoled':
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.amoledBody')}</ThemedText>
          <View style={styles.switchRow}>
            <ThemedText>{t('expansion.amoledBlack')}</ThemedText>
            <Switch
              value={settings.uiAmoledBlack}
              onValueChange={(v) => {
                update({ uiAmoledBlack: v, ...(v ? { themeOverride: 'dark' as const } : {}) });
              }}
            />
          </View>
          <View style={styles.switchRow}>
            <ThemedText>{t('quran.sepia')}</ThemedText>
            <Switch value={settings.readerSepia} onValueChange={(v) => update({ readerSepia: v })} />
          </View>
        </View>
      );

    case 'family':
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.familyBody')}</ThemedText>
          <View style={styles.switchRow}>
            <ThemedText>{t('expansion.familyShellOn')}</ThemedText>
            <Switch value={settings.familyModeShell} onValueChange={(v) => update({ familyModeShell: v })} />
          </View>
          {settings.familyModeShell ? (
            <>
              <ActionRow label={t('nav.tasbih')} onPress={() => router.push('/tasbih' as never)} />
              <ActionRow label={t('expansion.familyShortSurah')} onPress={() => router.push('/quran/112' as never)} />
              <ActionRow label={t('nav.duas')} onPress={() => router.push('/duas' as never)} />
            </>
          ) : null}
        </View>
      );

    case 'ar-qibla':
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.arQiblaBody')}</ThemedText>
          <ActionRow label={t('expansion.openQiblaAr')} onPress={() => router.push('/qibla' as never)} />
        </View>
      );

    case 'qada':
      return (
        <View style={styles.gap}>
          <ThemedText>{t('expansion.qadaBody')}</ThemedText>
          <ActionRow label={t('expansion.openQadaTracker')} onPress={() => router.push('/tracker' as never)} />
        </View>
      );

    case 'print-week':
      return <PrintWeekPanel settings={settings} locale={locale} />;

    default:
      return <ThemedText themeColor="textSecondary">{t('expansion.gated')}</ThemedText>;
  }
}

function SunnahFastingPanel({ locale, blockOn }: { locale: string; blockOn: boolean }) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<SunnahFastingPrefs>(DEFAULT_SUNNAH_FASTING);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(SUNNAH_PREFS_KEY);
      if (!raw) return;
      try {
        const p = JSON.parse(raw) as Partial<SunnahFastingPrefs>;
        setPrefs({ ...DEFAULT_SUNNAH_FASTING, ...p });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const save = useCallback(
    async (next: SunnahFastingPrefs) => {
      setPrefs(next);
      await AsyncStorage.setItem(SUNNAH_PREFS_KEY, JSON.stringify(next));
      if (blockOn) await syncSunnahFastingReminders(true, next, locale);
    },
    [blockOn, locale],
  );

  const toggle = (key: keyof SunnahFastingPrefs) => {
    void save({ ...prefs, [key]: !prefs[key] });
  };

  useEffect(() => {
    if (blockOn) void syncSunnahFastingReminders(true, prefs, locale);
  }, [blockOn, prefs, locale]);

  const rows: { key: keyof SunnahFastingPrefs; label: string }[] = [
    { key: 'monThu', label: t('expansion.fastMonThu') },
    { key: 'whiteDays', label: t('expansion.fastWhiteDays') },
    { key: 'arafah', label: t('expansion.fastArafah') },
    { key: 'ashura', label: t('expansion.fastAshura') },
    { key: 'shawwal6', label: t('expansion.fastShawwal') },
  ];

  return (
    <View style={styles.gap}>
      <ThemedText>{t('expansion.sunnahFastingBody')}</ThemedText>
      {rows.map((r) => (
        <View key={r.key} style={styles.switchRow}>
          <ThemedText style={styles.flex}>{r.label}</ThemedText>
          <Switch value={prefs[r.key]} onValueChange={() => toggle(r.key)} />
        </View>
      ))}
    </View>
  );
}

function HabitPanel({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof loadHabits>>>([]);

  useEffect(() => {
    void loadHabits().then(setEntries);
  }, []);

  const toggle = (id: HabitId) => {
    void (async () => {
      const next = toggleHabitDay(await loadHabits(), id);
      await saveHabits(next);
      setEntries(next);
    })();
  };

  return (
    <View style={styles.gap}>
      <ThemedText>{t('expansion.habitBody')}</ThemedText>
      {entries.map((e) => (
        <Pressable key={e.id} style={styles.rowCard} onPress={() => toggle(e.id)}>
          <ThemedText type="smallBold">{e.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('expansion.habitStreak').replace('{n}', String(streakDays(e.doneOn)))}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function PersonalBackupPanel() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await collectBackupData();
      const uri = await writeBackupFile(data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: t('expansion.personalBackupTitle') });
      }
    } catch {
      Alert.alert(t('expansion.personalBackupTitle'), t('settings.backup.exportError'));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    const pick = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (pick.canceled || !pick.assets?.[0]?.uri) return;
    setBusy(true);
    try {
      const json = await FileSystem.readAsStringAsync(pick.assets[0].uri);
      const parsed = parseBackupFile(json);
      if (!parsed.ok) {
        Alert.alert(t('expansion.personalBackupTitle'), t('settings.backup.importError'));
        return;
      }
      await applyBackupData(parsed.data as BackupData);
      Alert.alert(t('expansion.personalBackupTitle'), t('settings.backup.importSuccess'));
    } catch {
      Alert.alert(t('expansion.personalBackupTitle'), t('settings.backup.importError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <ThemedText>{t('expansion.personalBackupBody')}</ThemedText>
      <ActionRow label={t('settings.backup.exportButton')} onPress={() => void onExport()} />
      <ActionRow label={t('settings.backup.importButton')} onPress={() => void onImport()} />
    </View>
  );
}

function MosquePackPanel({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{ mosqueEntries: number; halalEntries: number; approxBytes: number } | null>(null);
  useEffect(() => {
    void readMosquePackStats().then(setStats);
  }, []);
  const note = locale === 'de' ? MOSQUE_PACK_LICENSE_NOTE.de : MOSQUE_PACK_LICENSE_NOTE.en;
  const kb = stats ? Math.round(stats.approxBytes / 1024) : 0;
  return (
    <View style={styles.gap}>
      <ThemedText>{t('expansion.mosquePackBody')}</ThemedText>
      {stats ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('expansion.mosquePackStats')
            .replace('{m}', String(stats.mosqueEntries))
            .replace('{h}', String(stats.halalEntries))
            .replace('{kb}', String(kb))}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {note}
      </ThemedText>
      <ActionRow label={t('nav.mosques')} onPress={() => router.push('/mosques' as never)} />
    </View>
  );
}

function PrintWeekPanel({ settings, locale }: { settings: AppSettings; locale: string }) {
  const { t } = useTranslation();
  const { data } = useWeekTimings();
  const rows = buildWeekRows(data ?? []);
  const onShare = async () => {
    if (!rows.length) return;
    const html = buildPrintablePrayerWeekHtml(rows, {
      locale: locale === 'de' ? 'de' : 'en',
      timeFormat: settings.timeFormat,
      locationLabel: settings.location.label || settings.location.city || '',
    });
    const uri = `${FileSystem.cacheDirectory}salati-prayer-week.html`;
    await FileSystem.writeAsStringAsync(uri, html);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/html', dialogTitle: t('expansion.printWeekTitle') });
    }
  };
  return (
    <View style={styles.gap}>
      <ThemedText>{t('expansion.printWeekBody')}</ThemedText>
      <ActionRow label={t('expansion.sharePrintWeek')} onPress={() => void onShare()} />
      <ActionRow label={t('expansion.openWeekTable')} onPress={() => router.push('/prayer-times-week' as never)} />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  flex: { flex: 1 },
  rowCard: { paddingVertical: Spacing.two, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.25)' },
  action: { paddingVertical: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(128,128,128,0.35)' },
  chipOn: { borderColor: '#785A00' },
});

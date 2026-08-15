import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwitchRow } from '@/components/settings/switch-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListNote, ListRowFrame, ListSection, NavRow } from '@/components/ui/list';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { rescheduleAdhkarReminders } from '@/features/duas/adhkarNotifications';
import {
  notificationPermissionBlocked,
  requestNotificationPermission,
} from '@/features/prayer-times/notifications';
import { useSettings } from '@/features/settings/store';
import {
  ADHKAR_EVENING_HOURS,
  ADHKAR_MORNING_HOURS,
  PRE_ADHAN_OFFSET_OPTIONS,
  REVIEW_REMINDER_HOUR_OPTIONS,
  VERSE_OF_DAY_HOUR_OPTIONS,
  type NotificationToggles,
} from '@/features/settings/types';
import { rescheduleVerseOfDayReminder } from '@/features/verseOfDay/notifications';
import { rescheduleWeeklySummary } from '@/features/weeklySummary/notifications';
import { useZakatReminder } from '@/features/zakat/reminder';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { logError } from '@/lib/errorLog';
import { useTranslation } from '@/lib/i18n';
import { isRtlLocale } from '@/lib/locale-detect';

// Zentrale Übersicht ALLER Notification-Toggles der App — bisher verstreut
// über settings.tsx (Gebetszeiten/Pre-Adhan/Jumu'ah/Sunnah/Adhkar/Vers-des-
// Tages/Wiederholungs-Erinnerung/Wochenzusammenfassung) und zakat.tsx
// (Zakat-Stichtag). Bewusst KEINE eigene State-Verwaltung: liest/schreibt
// dieselben AppSettings-Felder bzw. den bestehenden useZakatReminder-Hook,
// die die einzelnen Feature-Screens bereits nutzen — reine UI-Konsolidierung,
// kein Ersatz für die Toggles dort (die bleiben erhalten). Reschedule-Aufrufe
// spiegeln exakt das Muster aus settings.tsx: Erinnerungen, die nur von
// Uhrzeit/Sprache abhängen (Vers-des-Tages/Adhkar/Wochenzusammenfassung),
// werden hier sofort neu geplant; Erinnerungen, die echte Gebetszeiten
// brauchen (Jumu'ah/Sunnah/Pre-Adhan) planen wie bisher erst beim nächsten
// Besuch des Gebetszeiten-Screens neu (components/prayer-times-screen.tsx).
// Die Reisen-Erinnerung (features/themes/journeyReminder.ts) hat KEINEN
// Schalter — auch im Original nicht, sie aktiviert sich automatisch, sobald
// eine Vers-Reise offen ist (app/themes/journeys/[id].tsx) — hier daher nur
// ein informativer Hinweis statt eines erfundenen Toggles.
const PRAYER_TOGGLE_LABELS: { id: keyof NotificationToggles; label: string }[] = [
  { id: 'fajr', label: 'Fajr' },
  { id: 'dhuhr', label: 'Dhuhr' },
  { id: 'asr', label: 'Asr' },
  { id: 'maghrib', label: 'Maghrib' },
  { id: 'isha', label: 'Isha' },
];

export default function NotificationsOverviewScreen() {
  const { settings, update } = useSettings();
  const { t, locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  const scheme = useResolvedScheme();
  const colors = Colors[scheme];
  const { anchor: zakatAnchor, enabled: zakatEnabled, setEnabled: setZakatEnabled } = useZakatReminder(locale);
  // Ein fehlgeschlagenes Neu-Planen war fuer den Nutzer bisher NICHT von
  // "funktioniert" unterscheidbar — der Schalter blieb an, die Erinnerung kam
  // nie. Darum: sichtbarer Fehlerzustand mit Wiederholen-Knopf, und der Fehler
  // landet im lokalen Fehler-Log (Support-Bericht im Einstellungen-Screen).
  const [rescheduleFehler, setRescheduleFehler] = useState<{ wiederholen: () => void } | null>(null);
  // Audit 2026-07-27 (U5): bei dauerhaft verweigerter Benachrichtigungs-
  // Berechtigung sprang jeder Schalter hier wirkungslos zurueck — ohne
  // Erklaerung und ohne Ausweg. Der Zustand wird beim Fokussieren geprueft
  // (nicht nur beim Mounten), damit das Banner nach der Reparatur in den
  // Systemeinstellungen sofort wieder verschwindet.
  const [blockiert, setBlockiert] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let abgebrochen = false;
      void notificationPermissionBlocked().then((b) => {
        if (!abgebrochen) setBlockiert(b);
      });
      return () => {
        abgebrochen = true;
      };
    }, []),
  );

  /** Fuehrt ein Neu-Planen aus; bei Fehlschlag Log-Eintrag + Fehler-Banner. */
  function planeNeu(kontext: string, aktion: () => Promise<unknown>): void {
    const lauf = (): void => {
      aktion().then(
        () => setRescheduleFehler(null),
        (err: unknown) => {
          void logError(err, `notifications-overview:${kontext}`);
          setRescheduleFehler({ wiederholen: lauf });
        },
      );
    };
    lauf();
  }

  async function toggleZakatReminder(next: boolean) {
    if (next && Platform.OS !== 'web') {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setBlockiert(await notificationPermissionBlocked());
        return;
      }
      setBlockiert(false);
    }
    setZakatEnabled(next);
  }

  return (
    <ThemedView type="groupedBackground" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title={t('settings.notificationsOverview.title')} variant="modal" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {t('settings.notificationsOverview.subtitle')}
          </ThemedText>

          {blockiert && (
            <ThemedView type="backgroundSelected" style={[styles.errorBanner, rtl && styles.switchRowRtl]}>
              <IconSymbol name="notifications-off-outline" size={18} color={colors.accent} />
              <ThemedText type="small" style={[styles.errorText, rtl && styles.rtlText]}>
                {t('settings.notificationsOverview.blocked')}
              </ThemedText>
              <Pressable
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel={t('common.openSettings')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('common.openSettings')}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {rescheduleFehler && (
            <ThemedView type="backgroundSelected" style={[styles.errorBanner, rtl && styles.switchRowRtl]}>
              <IconSymbol name="alert-circle-outline" size={18} color={colors.accent} />
              <ThemedText type="small" style={[styles.errorText, rtl && styles.rtlText]}>
                {t('common.error')}
              </ThemedText>
              <Pressable
                onPress={rescheduleFehler.wiederholen}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="accent">
                  {t('common.retry')}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          <ListSection title={t('settings.notificationsOverview.groupPrayerTimes')}>
            {PRAYER_TOGGLE_LABELS.map((p) => (
              <SwitchRow
                key={p.id}
                label={p.label}
                hint={t('settings.notificationsOverview.prayerHint')}
                value={settings.notificationsEnabled[p.id]}
                onValueChange={(v) =>
                  update({ notificationsEnabled: { ...settings.notificationsEnabled, [p.id]: v } })
                }
              />
            ))}

            <SwitchRow
              label={t('settings.preAdhan.enable')}
              hint={t('settings.preAdhan.hint')}
              value={settings.preAdhanReminderEnabled}
              onValueChange={(v) => update({ preAdhanReminderEnabled: v })}
            />
            {settings.preAdhanReminderEnabled && (
              <ChipRow
                options={PRE_ADHAN_OFFSET_OPTIONS}
                selected={settings.preAdhanReminderOffset}
                onSelect={(min) => update({ preAdhanReminderOffset: min })}
                formatLabel={(min) => t('settings.preAdhan.minutes').replace('{n}', String(min))}
              />
            )}

            <SwitchRow
              label={t('settings.jumuah.enable')}
              hint={t('settings.jumuah.hint')}
              value={settings.jumuahReminderEnabled}
              onValueChange={(v) => update({ jumuahReminderEnabled: v })}
            />

            <SwitchRow
              label={t('settings.sunnah.duha')}
              hint={t('settings.sunnah.duhaHint')}
              value={settings.sunnahDuhaEnabled}
              onValueChange={(v) => update({ sunnahDuhaEnabled: v })}
            />
            <SwitchRow
              label={t('settings.sunnah.tahajjud')}
              hint={t('settings.sunnah.tahajjudHint')}
              value={settings.sunnahTahajjudEnabled}
              onValueChange={(v) => update({ sunnahTahajjudEnabled: v })}
            />
            <SwitchRow
              label={t('settings.sunnah.witr')}
              hint={t('settings.sunnah.witrHint')}
              value={settings.sunnahWitrEnabled}
              onValueChange={(v) => update({ sunnahWitrEnabled: v })}
            />
          </ListSection>

          <ListSection title={t('settings.notificationsOverview.groupQuran')}>
            <SwitchRow
              label={t('settings.verseOfDay.enable')}
              hint={t('settings.verseOfDay.hint')}
              value={settings.verseOfDayReminderEnabled}
              onValueChange={(v) => {
                update({ verseOfDayReminderEnabled: v });
                planeNeu('verseOfDay.toggle', () =>
                  rescheduleVerseOfDayReminder(
                    v,
                    settings.verseOfDayReminderHour,
                    settings.language,
                    settings.hadithLanguage,
                  ),
                );
              }}
            />
            {settings.verseOfDayReminderEnabled && (
              <ChipRow
                options={VERSE_OF_DAY_HOUR_OPTIONS}
                selected={settings.verseOfDayReminderHour}
                onSelect={(h) => {
                  update({ verseOfDayReminderHour: h });
                  planeNeu('verseOfDay.hour', () =>
                    rescheduleVerseOfDayReminder(true, h, settings.language, settings.hadithLanguage),
                  );
                }}
                formatLabel={(h) => `${h}:00`}
              />
            )}

            <SwitchRow
              label={t('settings.reviewReminder.enable')}
              hint={t('settings.reviewReminder.hint')}
              value={settings.reviewReminderEnabled}
              onValueChange={(v) => update({ reviewReminderEnabled: v })}
            />
            {settings.reviewReminderEnabled && (
              <ChipRow
                options={REVIEW_REMINDER_HOUR_OPTIONS}
                selected={settings.reviewReminderHour}
                onSelect={(hour) => update({ reviewReminderHour: hour })}
                formatLabel={(hour) => t(`settings.reviewReminder.hour${hour}`)}
              />
            )}

            <NavRow
              onPress={() => router.push('/themes')}
              label={t('settings.notificationsOverview.journeyTitle')}
              hint={t('settings.notificationsOverview.journeyHint')}
            />
          </ListSection>

          <ListSection title={t('settings.notificationsOverview.groupOther')}>
            <SwitchRow
              label={t('settings.adhkar.morning')}
              hint={t('settings.adhkar.morningHint')}
              value={settings.adhkarMorningEnabled}
              onValueChange={(v) => {
                update({ adhkarMorningEnabled: v });
                planeNeu('adhkar.morning.toggle', () =>
                  rescheduleAdhkarReminders({
                    morningEnabled: v,
                    morningHour: settings.adhkarMorningHour,
                    eveningEnabled: settings.adhkarEveningEnabled,
                    eveningHour: settings.adhkarEveningHour,
                    locale: settings.language,
                  }),
                );
              }}
            />
            {settings.adhkarMorningEnabled && (
              <ChipRow
                options={ADHKAR_MORNING_HOURS}
                selected={settings.adhkarMorningHour}
                onSelect={(h) => {
                  update({ adhkarMorningHour: h });
                  planeNeu('adhkar.morning.hour', () =>
                    rescheduleAdhkarReminders({
                      morningEnabled: settings.adhkarMorningEnabled,
                      morningHour: h,
                      eveningEnabled: settings.adhkarEveningEnabled,
                      eveningHour: settings.adhkarEveningHour,
                      locale: settings.language,
                    }),
                  );
                }}
                formatLabel={(h) => `${h}:00`}
              />
            )}

            <SwitchRow
              label={t('settings.adhkar.evening')}
              hint={t('settings.adhkar.eveningHint')}
              value={settings.adhkarEveningEnabled}
              onValueChange={(v) => {
                update({ adhkarEveningEnabled: v });
                planeNeu('adhkar.evening.toggle', () =>
                  rescheduleAdhkarReminders({
                    morningEnabled: settings.adhkarMorningEnabled,
                    morningHour: settings.adhkarMorningHour,
                    eveningEnabled: v,
                    eveningHour: settings.adhkarEveningHour,
                    locale: settings.language,
                  }),
                );
              }}
            />
            {settings.adhkarEveningEnabled && (
              <ChipRow
                options={ADHKAR_EVENING_HOURS}
                selected={settings.adhkarEveningHour}
                onSelect={(h) => {
                  update({ adhkarEveningHour: h });
                  planeNeu('adhkar.evening.hour', () =>
                    rescheduleAdhkarReminders({
                      morningEnabled: settings.adhkarMorningEnabled,
                      morningHour: settings.adhkarMorningHour,
                      eveningEnabled: settings.adhkarEveningEnabled,
                      eveningHour: h,
                      locale: settings.language,
                    }),
                  );
                }}
                formatLabel={(h) => `${h}:00`}
              />
            )}

            <SwitchRow
              label={t('zakat.reminder.title')}
              hint={t('zakat.reminder.desc')}
              value={zakatEnabled}
              onValueChange={toggleZakatReminder}
            />
            <NavRow
              onPress={() => router.push('/zakat')}
              label={t('settings.notificationsOverview.zakatManageLink')}
            />
            {!zakatAnchor && zakatEnabled && <ListNote text={t('zakat.reminder.noAnchor')} />}

            <SwitchRow
              label={t('settings.weeklySummary.enable')}
              hint={t('settings.weeklySummary.hint')}
              value={settings.weeklySummaryReminderEnabled}
              onValueChange={(v) => {
                update({ weeklySummaryReminderEnabled: v });
                planeNeu('weeklySummary.toggle', () => rescheduleWeeklySummary(v, settings.language));
              }}
            />
          </ListSection>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Chip-Auswahl (Uhrzeit/Minuten) innerhalb einer Karte — sitzt in einem
 * ListRowFrame, damit sie dieselben Seiteneinzüge wie die Zeilen darüber hat. */
function ChipRow<T extends number>({
  options,
  selected,
  onSelect,
  formatLabel,
}: {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  formatLabel: (value: T) => string;
}) {
  const { locale } = useTranslation();
  const rtl = isRtlLocale(locale);
  return (
    <ListRowFrame>
      <View style={[styles.hourRow, rtl && styles.hourRowRtl]}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === opt }}
            accessibilityLabel={formatLabel(opt)}
            style={({ pressed }) => [Platform.OS === 'web' ? styles.pressableWeb : undefined, pressed && styles.pressed]}>
            <ThemedView type={selected === opt ? 'backgroundSelected' : 'backgroundElement'} style={styles.hourChip}>
              <ThemedText type="small" themeColor={selected === opt ? 'accent' : 'text'}>
                {formatLabel(opt)}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>
    </ListRowFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Spacing.two },
  scroll: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  switchRowRtl: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right' },
  hourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  hourRowRtl: { flexDirection: 'row-reverse' },
  // Mindestens 40x40 statt der frueheren ~28px — Tap-Ziel-Vorgabe.
  hourChip: {
    minHeight: 40,
    minWidth: 40,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  errorText: { flex: 1 },
  rowPressed: { opacity: 0.6 },
  pressed: { opacity: 0.6 },
  pressableWeb: { cursor: 'pointer' },
});

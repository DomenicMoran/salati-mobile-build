import type { AppSettings } from '@/features/settings/types';
import type { NextPrayerResult, TimeFormat } from '@/features/prayer-times/next-prayer';
import type { HadithLang } from '@/features/hadith/api';

import { syncFridayKahfReminders } from './fridayReminder';
import { updateDailyIbadahOngoing } from './ongoing';
import { refreshWidgetVerseCache } from './widgetVerseCache';
import { syncTahajjudReminders } from './tahajjudReminder';
import { cancelFajrWakeAlarms, localDayKey, scheduleFajrWakeAlarm } from './fajrWakeAlarm';

export async function syncDailyIbadahExtras(
  settings: AppSettings,
  next: NextPrayerResult | null,
  locale: string,
  timeFormat: TimeFormat,
  hadithLang: HadithLang,
  maghribAt?: Date,
  fajrAt?: Date,
): Promise<void> {
  if (!settings.dailyIbadahExtrasEnabled) {
    await updateDailyIbadahOngoing(false, null, locale, timeFormat);
    await syncFridayKahfReminders(false, locale);
    await syncTahajjudReminders(false, maghribAt, fajrAt, locale);
    await cancelFajrWakeAlarms();
    return;
  }
  await updateDailyIbadahOngoing(
    settings.dailyIbadahOngoingNextPrayer,
    next,
    locale,
    timeFormat,
  );
  await syncFridayKahfReminders(settings.dailyIbadahFridayKahf, locale);
  if (settings.dailyIbadahTahajjudReminder && maghribAt && fajrAt) {
    await syncTahajjudReminders(true, maghribAt, fajrAt, locale);
  } else {
    await syncTahajjudReminders(false, maghribAt, fajrAt, locale);
  }
  if (settings.dailyIbadahVerseWidget) {
    void refreshWidgetVerseCache(locale, hadithLang);
  }
  if (settings.dailyIbadahFajrWakeAlarm && fajrAt && fajrAt.getTime() > Date.now()) {
    await cancelFajrWakeAlarms();
    await scheduleFajrWakeAlarm(fajrAt, locale, localDayKey(fajrAt));
  } else if (!settings.dailyIbadahFajrWakeAlarm) {
    await cancelFajrWakeAlarms();
  }
}

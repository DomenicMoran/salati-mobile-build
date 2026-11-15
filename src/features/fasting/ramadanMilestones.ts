import { parseTimeOn } from '@/features/prayer-times/next-prayer';
import type { Timings } from '@/features/prayer-times/api';

const IMSAK_MIN_BEFORE_FAJR = 10;

export type MobileRamadanKey = 'imsak' | 'suhur' | 'iftar' | 'taraweeh';

export type MobileRamadanMilestone = {
  key: MobileRamadanKey;
  labelKey: string;
  at: Date;
};

export function mobileRamadanMilestones(today: Timings, now: Date): MobileRamadanMilestone[] {
  const fajr = parseTimeOn(today.Fajr, now);
  const maghrib = parseTimeOn(today.Maghrib, now);
  const isha = parseTimeOn(today.Isha, now);
  const imsak = new Date(fajr.getTime() - IMSAK_MIN_BEFORE_FAJR * 60_000);
  const rows: MobileRamadanMilestone[] = [
    { key: 'imsak', labelKey: 'fasting.imsak', at: imsak },
    { key: 'suhur', labelKey: 'fasting.suhoor', at: fajr },
    { key: 'iftar', labelKey: 'fasting.iftar', at: maghrib },
    { key: 'taraweeh', labelKey: 'fasting.taraweeh', at: isha },
  ];
  return rows.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function nextMobileRamadanMilestone(
  milestones: MobileRamadanMilestone[],
  now: Date,
): MobileRamadanMilestone | null {
  return milestones.find((m) => m.at.getTime() > now.getTime()) ?? null;
}
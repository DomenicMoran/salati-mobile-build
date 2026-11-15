/** Moschee-Konfiguration — Patch zur TV-Kopplung (TV lib/mosque/schema.ts). */
export type MosqueAdminProfile = {
  name: string;
  address: string;
  contact: string;
  logoUri: string;
};

export type MosqueAdminEvent = { title: string; when: string };

export type MosqueAdminDonation = {
  text: string;
  iban: string;
  qrPayload: string;
};

export type DisplayRole = 'main' | 'women' | 'entrance' | 'custom';
export type LayoutTemplate = 'classic' | 'compact' | 'tickerFocus';

export type MosqueAdminDraft = {
  profile: MosqueAdminProfile;
  role: DisplayRole;
  customRoleLabel: string;
  layout: LayoutTemplate;
  tickerText: string;
  /** Kommagetrennte Locale-Codes, z. B. de,en,ar */
  tickerLocalesCsv: string;
  tickerDe: string;
  tickerEn: string;
  tickerAr: string;
  adhkarAfterIqama: boolean;
  iqamaOffsets: { fajr: number; dhuhr: number; asr: number; maghrib: number; isha: number };
  jumuahSlots: { time: string; khatib?: string }[];
  eidTimesCsv: string;
  taraweehSlotsCsv: string;
  ramadan: { imsak: boolean; suhur: boolean; iftar: boolean; taraweeh: boolean };
  schedules: {
    quietDuringSalah: boolean;
    quietDuringKhutba: boolean;
    screenWake: string;
    screenSleep: string;
  };
  tileOrderCsv: string;
  events: MosqueAdminEvent[];
  donation: MosqueAdminDonation;
  pinHash: string | null;
};

export function defaultMosqueAdminDraft(): MosqueAdminDraft {
  return {
    profile: { name: '', address: '', contact: '', logoUri: '' },
    role: 'main',
    customRoleLabel: '',
    layout: 'classic',
    tickerText: '',
    tickerLocalesCsv: 'de,en',
    tickerDe: '',
    tickerEn: '',
    tickerAr: '',
    adhkarAfterIqama: false,
    iqamaOffsets: { fajr: 20, dhuhr: 15, asr: 15, maghrib: 10, isha: 15 },
    jumuahSlots: [{ time: '13:00' }],
    eidTimesCsv: '',
    taraweehSlotsCsv: '',
    ramadan: { imsak: true, suhur: false, iftar: true, taraweeh: true },
    schedules: {
      quietDuringSalah: true,
      quietDuringKhutba: true,
      screenWake: '',
      screenSleep: '',
    },
    tileOrderCsv: 'events,donation,contact',
    events: [],
    donation: { text: '', iban: '', qrPayload: '' },
    pinHash: null,
  };
}

function splitTimes(csv: string): string[] {
  return csv
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function splitLocales(csv: string): string[] {
  return csv
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);
}

/** Entwurf → TV-Patch (wird von patchMosqueConfig normalisiert). */
export function draftToMosquePatch(draft: MosqueAdminDraft): Record<string, unknown> {
  const tickerLocales = splitLocales(draft.tickerLocalesCsv);
  const tickerByLocale: Record<string, string> = {};
  if (draft.tickerDe.trim()) tickerByLocale.de = draft.tickerDe.trim();
  if (draft.tickerEn.trim()) tickerByLocale.en = draft.tickerEn.trim();
  if (draft.tickerAr.trim()) tickerByLocale.ar = draft.tickerAr.trim();
  return {
    profile: {
      ...draft.profile,
      logoUri: draft.profile.logoUri.trim() || null,
    },
    role: draft.role,
    customRoleLabel: draft.customRoleLabel,
    layout: draft.layout,
    tickerText: draft.tickerText,
    tickerLocales,
    tickerByLocale,
    adhkarAfterIqama: draft.adhkarAfterIqama,
    iqamaOffsets: draft.iqamaOffsets,
    jumuahSlots: draft.jumuahSlots,
    eidTimes: splitTimes(draft.eidTimesCsv),
    taraweehSlots: splitTimes(draft.taraweehSlotsCsv),
    ramadan: draft.ramadan,
    schedules: {
      quietDuringSalah: draft.schedules.quietDuringSalah,
      quietDuringKhutba: draft.schedules.quietDuringKhutba,
      screenWake: draft.schedules.screenWake.trim() || null,
      screenSleep: draft.schedules.screenSleep.trim() || null,
    },
    tileOrder: splitLocales(draft.tileOrderCsv),
    events: draft.events.slice(0, 24),
    donation: draft.donation,
  };
}

export function mosqueConfigMessage(draft: MosqueAdminDraft) {
  return { t: 'mosqueConfig' as const, patch: draftToMosquePatch(draft) };
}

export function khutbaCaptionMessage(text: string, original?: string, translation?: string) {
  return { t: 'khutba' as const, action: 'caption' as const, text, original, translation };
}

export function khutbaScheduleMessage(at: string, text: string, slides?: string[]) {
  return { t: 'khutba' as const, action: 'schedule' as const, at, text, slides };
}

export function khutbaPreloadMessage(text: string, slides: string[]) {
  return { t: 'khutba' as const, action: 'preload' as const, text, slides };
}

export function khutbaSlideMessage(delta: number) {
  return { t: 'khutba' as const, action: 'slide' as const, delta };
}

export function khutbaControlMessage(action: 'start' | 'stop' | 'pause') {
  return { t: 'khutbaControl' as const, action };
}

export function khutbaClearMessage() {
  return { t: 'khutba' as const, action: 'clear' as const };
}

export function captionStyleMessage(style: Record<string, unknown>) {
  return { t: 'captionStyle' as const, style };
}

export function captionLangMessage(target: string[]) {
  return { t: 'captionLang' as const, target };
}

export function pinChangeMessage(oldPin: string, newPin: string | null) {
  return { t: 'pinChange' as const, oldPin, newPin };
}

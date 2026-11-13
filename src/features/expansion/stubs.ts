/** Phase-3/4-Routen hinter `expansionExtrasEnabled` (Defaults aus). */

export type ExpansionStub = {
  id: string;
  settingKey:
    | 'expansionMultiLocations'
    | 'expansionQasrJam'
    | 'expansionSunnahFastingReminders'
    | 'expansionHabitTracker'
    | 'expansionVoiceQuranSearch'
    | 'expansionPersonalBackup'
    | 'expansionOfflineMosquePack'
    | 'expansionAmoledSepia'
    | 'expansionFamilyMode'
    | 'expansionArQibla'
    | 'expansionQadaPlanner'
    | 'expansionPrintableWeek';
  route: string;
  titleKey: string;
  bodyKey: string;
};

export const EXPANSION_STUBS: ExpansionStub[] = [
  {
    id: 'multi-locations',
    settingKey: 'expansionMultiLocations',
    route: '/expansion/multi-locations',
    titleKey: 'expansion.multiLocationsTitle',
    bodyKey: 'expansion.multiLocationsBody',
  },
  {
    id: 'qasr-jam',
    settingKey: 'expansionQasrJam',
    route: '/expansion/qasr-jam',
    titleKey: 'expansion.qasrTitle',
    bodyKey: 'expansion.qasrBody',
  },
  {
    id: 'sunnah-fasting',
    settingKey: 'expansionSunnahFastingReminders',
    route: '/expansion/sunnah-fasting',
    titleKey: 'expansion.sunnahFastingTitle',
    bodyKey: 'expansion.sunnahFastingBody',
  },
  {
    id: 'habit',
    settingKey: 'expansionHabitTracker',
    route: '/expansion/habit-tracker',
    titleKey: 'expansion.habitTitle',
    bodyKey: 'expansion.habitBody',
  },
  {
    id: 'voice-quran',
    settingKey: 'expansionVoiceQuranSearch',
    route: '/expansion/voice-quran',
    titleKey: 'expansion.voiceQuranTitle',
    bodyKey: 'expansion.voiceQuranBody',
  },
  {
    id: 'personal-backup',
    settingKey: 'expansionPersonalBackup',
    route: '/expansion/personal-backup',
    titleKey: 'expansion.personalBackupTitle',
    bodyKey: 'expansion.personalBackupBody',
  },
  {
    id: 'mosque-pack',
    settingKey: 'expansionOfflineMosquePack',
    route: '/expansion/mosque-pack',
    titleKey: 'expansion.mosquePackTitle',
    bodyKey: 'expansion.mosquePackBody',
  },
  {
    id: 'amoled',
    settingKey: 'expansionAmoledSepia',
    route: '/expansion/amoled-sepia',
    titleKey: 'expansion.amoledTitle',
    bodyKey: 'expansion.amoledBody',
  },
  {
    id: 'family',
    settingKey: 'expansionFamilyMode',
    route: '/expansion/family-mode',
    titleKey: 'expansion.familyTitle',
    bodyKey: 'expansion.familyBody',
  },
  {
    id: 'ar-qibla',
    settingKey: 'expansionArQibla',
    route: '/expansion/ar-qibla',
    titleKey: 'expansion.arQiblaTitle',
    bodyKey: 'expansion.arQiblaBody',
  },
  {
    id: 'qada',
    settingKey: 'expansionQadaPlanner',
    route: '/expansion/qada-planner',
    titleKey: 'expansion.qadaTitle',
    bodyKey: 'expansion.qadaBody',
  },
  {
    id: 'print-week',
    settingKey: 'expansionPrintableWeek',
    route: '/expansion/print-week',
    titleKey: 'expansion.printWeekTitle',
    bodyKey: 'expansion.printWeekBody',
  },
];

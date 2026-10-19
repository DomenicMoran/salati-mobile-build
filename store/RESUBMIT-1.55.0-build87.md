# iOS 1.55.0 — Build 87 (Guideline 4 Berechtigungstexte)

> **Nachfolger:** Build 87 scheiterte an **ITMS-90683** (fehlendes `NSMotionUsageDescription`) → **`RESUBMIT-1.55.0-build88.md`**, `buildNumber` **88**.

Stand: 2026-09-24. Behebt ASC-Ablehnung: System-Berechtigungsdialoge waren nur auf Deutsch in `Info.plist`, während die App 14 UI-Sprachen hat.

## Was geändert wurde

- `ios-locales/*` + `locales` in `app.config.ts` → `InfoPlist.strings` pro Sprache (Standort, Kamera, Mikrofon).
- `buildNumber`: **87** (86 war abgelehnt).
- `versionString`: **1.55.0** (gleiche ASC-Version, neuer Build — Apple erlaubt das bei REJECTED).

## Rebuild (EAS)

```powershell
cd C:\Users\domen\Documents\Projekte\SalatiTech\apps\mobile
npm run check:ios-locales
eas build --platform ios --profile production --non-interactive
```

Nach `VALID` in App Store Connect:

```powershell
eas submit --platform ios --profile production --latest --non-interactive
```

Oder API-Einreichung (Release Notes bereits in `store/whatsnew-1.55.0.json`):

```powershell
node scripts/asc-release.mjs 1.55.0 87 store/whatsnew-1.55.0.json
```

## Vor dem Upload prüfen

```powershell
npm run check:ios-locales
npx jest src/lib/ios-info-plist-locales.test.ts
```

Native Änderung → **kein OTA**; nur neuer Store-Build.

## Offener Punkt (watchOS)

`targets/salati-watch/*.lproj/InfoPlist.strings` enthält nur **Standort** (Qibla-Kompass). Ob @bacons/apple-targets die Ordner ins Xcode-Ziel übernimmt, ist erst am Mac-/EAS-Prebuild verifizierbar. iPhone-Haupt-App ist vollständig lokalisiert.

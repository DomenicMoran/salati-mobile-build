# iOS 1.55.0 — Build 88 (ITMS-90683 Motion)

Stand: 2026-09-24. Behebt ASC **Binary Processing** nach Build 87:

- **ITMS-90683**: `NSMotionUsageDescription` fehlte — Qibla/Kompass nutzt Bewegungs-/Magnetometer-APIs; `motionUsagePermission: false` entfernte den Key.

## Was geändert wurde

- `ios.infoPlist.NSMotionUsageDescription` (DE-Default) + `expo-location` `motionUsagePermission` (deutscher Text).
- `ios-locales/catalog.json` + 14× `ios-locales/*.json` — Motion-Text in allen App-Sprachen (neben Standort/Kamera/Mikro von Build 87).
- `buildNumber`: **88** (87 scheiterte an Binary Processing, nicht Guideline 4).
- `versionString`: **1.55.0** (gleiche ASC-Version, neuer Build).

Build 87 (Guideline-4-Lokalisierung): siehe `RESUBMIT-1.55.0-build87.md`.

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
node scripts/asc-release.mjs 1.55.0 88 store/whatsnew-1.55.0.json
```

## Vor dem Upload prüfen

```powershell
npm run check:ios-locales
npx jest src/lib/ios-info-plist-locales.test.ts
```

Native Änderung → **kein OTA**; nur neuer Store-Build.
